export interface UploadResult {
  url: string;
  path: string;
}

export abstract class StorageService {
  abstract upload(
    visibility: 'public' | 'private' | 'temp',
    tenantKey: string,
    modulePath: string,
    filename: string,
    buffer: Buffer,
    mimetype: string,
    useDateNesting?: boolean,
  ): Promise<UploadResult>;

  abstract delete(path: string): Promise<void>;
}
