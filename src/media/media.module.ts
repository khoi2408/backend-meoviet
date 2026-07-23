import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { LocalStorageProvider } from './local-storage.provider';
import { CDNStorageProvider } from './cdn-storage.provider';

@Module({
  controllers: [MediaController],
  providers: [
    MediaService,
    LocalStorageProvider,
    CDNStorageProvider,
    {
      provide: 'STORAGE_PROVIDER',
      useFactory: (local: LocalStorageProvider, cdn: CDNStorageProvider) => {
        const driver = process.env.MEDIA_DRIVER || 'local';
        return driver === 'cdn' ? cdn : local;
      },
      inject: [LocalStorageProvider, CDNStorageProvider],
    },
  ],
  exports: [MediaService, 'STORAGE_PROVIDER'],
})
export class MediaModule {}
