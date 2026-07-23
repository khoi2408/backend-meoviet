import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import type { StorageProvider } from './storage-provider.interface';
import * as path from 'path';

@Injectable()
export class MediaService {
  constructor(
    @Inject('STORAGE_PROVIDER')
    private readonly storageProvider: StorageProvider,
  ) {}

  private validateFile(file: Express.Multer.File) {
    if (!file || !file.originalname) {
      throw new BadRequestException('Tập tin không hợp lệ.');
    }

    const fileExt = path.extname(file.originalname).toLowerCase().replace('.', '');
    const allowedImages = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];
    const allowedVideos = ['mp4', 'mov', 'webm', 'mkv'];

    const isImage = allowedImages.includes(fileExt) && file.mimetype.startsWith('image/');
    const isVideo = allowedVideos.includes(fileExt) && file.mimetype.startsWith('video/');

    if (!isImage && !isVideo) {
      throw new BadRequestException(
        'Định dạng file không được hỗ trợ. Chỉ cho phép hình ảnh (jpg, jpeg, png, webp, gif, avif) hoặc video (mp4, mov, webm, mkv).'
      );
    }

    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

    if (isImage && file.size > MAX_IMAGE_SIZE) {
      throw new BadRequestException(`Dung lượng ảnh "${file.originalname}" quá lớn (tối đa 10MB).`);
    }

    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      throw new BadRequestException(`Dung lượng video "${file.originalname}" quá lớn (tối đa 50MB).`);
    }
  }

  async uploadAvatar(file: Express.Multer.File): Promise<{ url: string; type: 'IMAGE' | 'VIDEO' }> {
    this.validateFile(file);
    const url = await this.storageProvider.upload(file, 'avatars');
    return { url, type: 'IMAGE' };
  }

  async uploadPost(files: Express.Multer.File[]): Promise<{ url: string; type: 'IMAGE' | 'VIDEO' }[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('Vui lòng chọn các tập tin để tải lên.');
    }
    const results: { url: string; type: 'IMAGE' | 'VIDEO' }[] = [];
    for (const file of files) {
      this.validateFile(file);
      const url = await this.storageProvider.upload(file, 'posts');
      const fileExt = path.extname(file.originalname).toLowerCase().replace('.', '');
      const type = ['mp4', 'mov', 'webm', 'mkv'].includes(fileExt) ? 'VIDEO' : 'IMAGE';
      results.push({ url, type });
    }
    return results;
  }

  async uploadComment(file: Express.Multer.File): Promise<{ url: string; type: 'IMAGE' | 'VIDEO' }> {
    this.validateFile(file);
    const url = await this.storageProvider.upload(file, 'comments');
    const fileExt = path.extname(file.originalname).toLowerCase().replace('.', '');
    const type = ['mp4', 'mov', 'webm', 'mkv'].includes(fileExt) ? 'VIDEO' : 'IMAGE';
    return { url, type };
  }

  async deleteFile(fileUrl: string): Promise<void> {
    if (!fileUrl) return;
    await this.storageProvider.delete(fileUrl);
  }
}
