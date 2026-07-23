import { Express } from 'express';

export interface StorageProvider {
  upload(file: Express.Multer.File, folder: string): Promise<string>;
  delete(fileUrl: string): Promise<void>;
}
