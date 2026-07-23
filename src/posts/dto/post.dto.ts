import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsArray,
  IsOptional,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MediaType } from '@prisma/client';

export class PostMediaDto {
  @ApiProperty({
    description: 'URL hoặc đường dẫn của file media',
    example: 'https://example.com/image.jpg',
  })
  @IsString()
  @IsNotEmpty({ message: 'URL media không được để trống' })
  url: string;

  @ApiProperty({
    description: 'Loại media (IMAGE hoặc VIDEO)',
    enum: MediaType,
    example: MediaType.IMAGE,
  })
  @IsEnum(MediaType, { message: 'Loại media phải là IMAGE hoặc VIDEO' })
  type: MediaType;
}

export class CreatePostDto {
  @ApiProperty({
    description: 'Nội dung bài viết',
    example: 'Mẹo chữa ho hiệu quả tại nhà...',
  })
  @IsString()
  @IsNotEmpty({ message: 'Nội dung bài viết không được để trống' })
  content: string;

  @ApiProperty({
    description: 'Danh sách ID danh mục của bài viết',
    example: ['uuid-1'],
    required: false,
    type: [String],
  })
  @IsArray({ message: 'Danh sách danh mục phải là một mảng' })
  @IsString({ each: true, message: 'ID danh mục phải là chuỗi' })
  @IsOptional()
  categoryIds?: string[];

  @ApiProperty({
    description: 'Danh sách media kèm theo bài viết',
    required: false,
    type: [PostMediaDto],
  })
  @IsArray({ message: 'Danh sách media phải là một mảng' })
  @ValidateNested({ each: true })
  @Type(() => PostMediaDto)
  @IsOptional()
  medias?: PostMediaDto[];
}

export class UpdatePostDto {
  @ApiProperty({
    description: 'Nội dung bài viết',
    example: 'Mẹo chữa ho đã chỉnh sửa...',
    required: false,
  })
  @IsString()
  @IsNotEmpty({ message: 'Nội dung bài viết không được để trống' })
  @IsOptional()
  content?: string;

  @ApiProperty({
    description: 'Danh sách ID danh mục của bài viết',
    example: ['uuid-1'],
    required: false,
    type: [String],
  })
  @IsArray({ message: 'Danh sách danh mục phải là một mảng' })
  @IsString({ each: true, message: 'ID danh mục phải là chuỗi' })
  @IsOptional()
  categoryIds?: string[];

  @ApiProperty({
    description: 'Danh sách media kèm theo bài viết',
    required: false,
    type: [PostMediaDto],
  })
  @IsArray({ message: 'Danh sách media phải là một mảng' })
  @ValidateNested({ each: true })
  @Type(() => PostMediaDto)
  @IsOptional()
  medias?: PostMediaDto[];
}
