import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LogsService {
  private readonly logDir = path.join(process.cwd(), 'logs');

  listFiles() {
    if (!fs.existsSync(this.logDir)) {
      return [];
    }
    const files = fs.readdirSync(this.logDir);
    return files
      .filter(f => f.endsWith('.log'))
      .map(filename => {
        const stats = fs.statSync(path.join(this.logDir, filename));
        return {
          filename,
          sizeBytes: stats.size,
          lastModified: stats.mtime,
        };
      })
      .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  }

  getFilePath(filename: string): string {
    // Validar que no haya directory traversal
    if (filename.includes('..') || filename.includes('/')) {
      throw new NotFoundException('Archivo inválido');
    }
    const filepath = path.join(this.logDir, filename);
    if (!fs.existsSync(filepath)) {
      throw new NotFoundException('Archivo de log no encontrado');
    }
    return filepath;
  }
}
