import { Injectable } from '@nestjs/common';
import { StorageProvider } from './storage-provider.interface';
import * as path from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class CDNStorageProvider implements StorageProvider {
  async upload(file: Express.Multer.File, folder: string): Promise<string> {
    const fileExt = path.extname(file.originalname).toLowerCase();
    const uniqueFilename = `${randomUUID()}${fileExt}`;
    const baseUrl = process.env.CDN_BASE_URL || 'https://cdn.meodangian.com';
    return `${baseUrl}/uploads/${folder}/${uniqueFilename}`;
  }

  async delete(fileUrl: string): Promise<void> {
    console.log(`[CDNStorageProvider] Simulated deletion of ${fileUrl}`);
  }
}
