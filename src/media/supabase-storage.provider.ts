import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { StorageProvider } from './storage-provider.interface';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as path from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class SupabaseStorageProvider implements StorageProvider, OnModuleInit {
  private readonly logger = new Logger(SupabaseStorageProvider.name);
  private supabase: SupabaseClient | null = null;
  private bucketName: string = 'media';

  onModuleInit() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      '';
    this.bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'media';

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.ensureBucketExists();
    } else {
      this.logger.warn(
        'Supabase URL hoặc Key chưa được cấu hình. Vui lòng kiểm tra SUPABASE_URL và SUPABASE_KEY trong file .env.',
      );
    }
  }

  private async ensureBucketExists() {
    if (!this.supabase) return;
    try {
      const { data: buckets, error } = await this.supabase.storage.listBuckets();
      if (error) {
        this.logger.error(`Error checking Supabase buckets: ${error.message}`);
        return;
      }
      const bucketExists = buckets?.some((b) => b.name === this.bucketName);
      if (!bucketExists) {
        this.logger.log(`Bucket "${this.bucketName}" chưa tồn tại. Đang tự động tạo public bucket...`);
        const { error: createError } = await this.supabase.storage.createBucket(this.bucketName, {
          public: true,
        });
        if (createError) {
          this.logger.error(`Tạo bucket "${this.bucketName}" thất bại: ${createError.message}`);
        } else {
          this.logger.log(`Tạo public bucket "${this.bucketName}" thành công.`);
        }
      }
    } catch (err) {
      this.logger.error('Lỗi khi khởi tạo Supabase bucket:', err);
    }
  }

  async upload(file: Express.Multer.File, folder: string): Promise<string> {
    if (!this.supabase) {
      // Re-try initialization in case env variables were loaded later
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey =
        process.env.SUPABASE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        '';
      if (supabaseUrl && supabaseKey) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
      } else {
        throw new Error(
          'Supabase Client chưa được khởi tạo. Vui lòng kiểm tra SUPABASE_URL và SUPABASE_KEY/SUPABASE_ANON_KEY trong file .env.',
        );
      }
    }

    const fileExt = path.extname(file.originalname).toLowerCase();
    const uniqueFilename = `${randomUUID()}${fileExt}`;
    const filePath = `${folder}/${uniqueFilename}`;

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      this.logger.error(`Upload lên Supabase thất bại: ${error.message}`);
      throw new Error(`Upload file lên Supabase Storage thất bại: ${error.message}`);
    }

    const { data: publicUrlData } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  }

  async delete(fileUrl: string): Promise<void> {
    if (!this.supabase || !fileUrl) return;

    try {
      const publicPattern = `/storage/v1/object/public/${this.bucketName}/`;
      const signPattern = `/storage/v1/object/sign/${this.bucketName}/`;
      let filePath: string | null = null;

      if (fileUrl.includes(publicPattern)) {
        filePath = fileUrl.split(publicPattern)[1];
      } else if (fileUrl.includes(signPattern)) {
        filePath = fileUrl.split(signPattern)[1];
      }

      if (filePath) {
        // Strip query parameters and decode URL
        filePath = decodeURIComponent(filePath.split('?')[0]);
        const { error } = await this.supabase.storage.from(this.bucketName).remove([filePath]);
        if (error) {
          this.logger.error(`Lỗi khi xóa file "${filePath}" trên Supabase: ${error.message}`);
        } else {
          this.logger.log(`Đã xóa file "${filePath}" khỏi Supabase bucket "${this.bucketName}".`);
        }
      }
    } catch (err) {
      this.logger.error(`Lỗi khi xóa file ${fileUrl} khỏi Supabase:`, err);
    }
  }
}
