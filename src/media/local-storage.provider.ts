import { Injectable } from '@nestjs/common';
import { StorageProvider } from './storage-provider.interface';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  async upload(file: Express.Multer.File, folder: string): Promise<string> {
    const uploadDir = path.join(process.cwd(), 'uploads', folder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileExt = path.extname(file.originalname).toLowerCase();
    const uniqueFilename = `${randomUUID()}${fileExt}`;
    const filePath = path.join(uploadDir, uniqueFilename);

    await fs.promises.writeFile(filePath, file.buffer);

    const baseUrl = process.env.MEDIA_BASE_URL || 'http://localhost:5000';
    return `${baseUrl}/uploads/${folder}/${uniqueFilename}`;
  }

  async delete(fileUrl: string): Promise<void> {
    try {
      const baseUrl = process.env.MEDIA_BASE_URL || 'http://localhost:5000';
      if (!fileUrl.startsWith(baseUrl)) {
        return;
      }
      const relativePath = fileUrl.replace(baseUrl, '');
      const filePath = path.join(process.cwd(), relativePath);

      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (err) {
      console.error(`Failed to delete local file ${fileUrl}:`, err);
    }
  }
}
