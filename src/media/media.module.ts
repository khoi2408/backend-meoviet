import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { LocalStorageProvider } from './local-storage.provider';
import { CDNStorageProvider } from './cdn-storage.provider';
import { SupabaseStorageProvider } from './supabase-storage.provider';

@Module({
  controllers: [MediaController],
  providers: [
    MediaService,
    LocalStorageProvider,
    CDNStorageProvider,
    SupabaseStorageProvider,
    {
      provide: 'STORAGE_PROVIDER',
      useFactory: (
        local: LocalStorageProvider,
        cdn: CDNStorageProvider,
        supabase: SupabaseStorageProvider,
      ) => {
        const driver = process.env.MEDIA_DRIVER || 'supabase';
        if (driver === 'local') return local;
        if (driver === 'cdn') return cdn;
        return supabase;
      },
      inject: [LocalStorageProvider, CDNStorageProvider, SupabaseStorageProvider],
    },
  ],
  exports: [MediaService, 'STORAGE_PROVIDER'],
})
export class MediaModule {}
