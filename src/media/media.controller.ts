import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';

@ApiTags('Media')
@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload/avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Tải lên ảnh đại diện của người dùng (tối đa 10MB)' })
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn ảnh đại diện để tải lên.');
    }
    return this.mediaService.uploadAvatar(file);
  }

  @Post('upload/post')
  @UseInterceptors(FilesInterceptor('files'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Tải lên nhiều hình ảnh hoặc video cho bài viết' })
  async uploadPost(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất một tập tin để tải lên.');
    }
    return this.mediaService.uploadPost(files);
  }

  @Post('upload/comment')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Tải lên một hình ảnh hoặc video cho bình luận' })
  async uploadComment(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn tập tin bình luận để tải lên.');
    }
    return this.mediaService.uploadComment(file);
  }
}
