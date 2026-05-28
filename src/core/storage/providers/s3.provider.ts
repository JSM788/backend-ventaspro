import { Injectable, Logger } from '@nestjs/common';
import { StorageService, UploadResult } from '../storage.interface';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import * as path from 'path';

@Injectable()
export class S3Provider implements StorageService {
  private readonly logger = new Logger(S3Provider.name);
  private s3Client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = process.env.R2_BUCKET_NAME || process.env.S3_BUCKET_NAME || '';
    
    this.s3Client = new S3Client({
      region: process.env.R2_REGION || process.env.S3_REGION || 'auto',
      endpoint: process.env.R2_ENDPOINT || process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || '',
      },
    });

    if (!this.bucket) {
      this.logger.warn('Bucket name is not defined in environment variables (R2_BUCKET_NAME / S3_BUCKET_NAME)');
    }
  }

  async upload(
    visibility: 'public' | 'private' | 'temp',
    tenantKey: string,
    modulePath: string,
    filename: string,
    buffer: Buffer,
    mimetype: string,
    useDateNesting?: boolean,
  ): Promise<UploadResult> {
    const ext = this.getExtensionFromMimetype(mimetype) || path.extname(filename).slice(1) || 'bin';
    const finalName = filename.includes('.') ? filename : `${filename}.${ext}`;
    
    let key = `${visibility}/${tenantKey}/${modulePath}/`;
    
    if (useDateNesting) {
      const date = new Date();
      const year = date.getFullYear().toString();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      key += `${year}/${month}/${day}/${finalName}`;
    } else {
      key += finalName;
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      });

      await this.s3Client.send(command);

      // Si es S3/R2 público, construimos la URL usando el custom domain o public URL
      const publicDomain = process.env.R2_PUBLIC_DOMAIN || process.env.S3_PUBLIC_DOMAIN;
      const url = publicDomain 
        ? `${publicDomain}/${key}` 
        : `https://${this.bucket}.${new URL(process.env.R2_ENDPOINT || 'http://localhost').hostname}/${key}`;

      return {
        url,
        path: key,
      };
    } catch (error) {
      this.logger.error(`Error uploading to S3/R2 (Key: ${key}):`, error);
      throw new Error(`Failed to upload file to remote storage: ${error.message}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.s3Client.send(command);
    } catch (error) {
      this.logger.error(`Error deleting from S3/R2 (Key: ${key}):`, error);
    }
  }

  private getExtensionFromMimetype(mimetype: string): string | null {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'application/xml': 'xml',
      'text/xml': 'xml',
      'application/pdf': 'pdf',
      'application/zip': 'zip',
    };
    return map[mimetype] || null;
  }
}
