import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsArray,
  IsOptional,
  IsEnum,
  ValidateNested,
  IsInt,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MediaType } from '@prisma/client';

export class CommentMediaDto {
  @ApiProperty({
    description: 'URL hoặc đường dẫn của file media',
    example: 'https://example.com/comment.jpg',
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

export class CreateCommentDto {
  @ApiProperty({
    description: 'ID của bài viết',
    example: 'uuid-string',
  })
  @IsString()
  @IsNotEmpty({ message: 'ID bài viết không được để trống' })
  postId: string;

  @ApiProperty({
    description: 'Nội dung bình luận',
    example: 'Mẹo này rất hay, tôi đã thử và thành công!',
  })
  @IsString()
  @IsNotEmpty({ message: 'Nội dung bình luận không được để trống' })
  content: string;

  @ApiProperty({
    description: 'ID bình luận cha (nếu là câu trả lời)',
    example: 1,
    required: false,
    type: Number,
  })
  @IsInt({ message: 'ID bình luận cha phải là số nguyên' })
  @IsOptional()
  parentId?: number;

  @ApiProperty({
    description: 'URL của media đính kèm (nếu đính kèm trực tiếp)',
    required: false,
    example: 'https://example.com/comment.jpg',
  })
  @IsString()
  @IsOptional()
  mediaUrl?: string;

  @ApiProperty({
    description: 'Loại media đính kèm (nếu đính kèm trực tiếp)',
    enum: MediaType,
    required: false,
    example: MediaType.IMAGE,
  })
  @IsEnum(MediaType)
  @IsOptional()
  mediaType?: MediaType;

  @ApiProperty({
    description: 'Danh sách media kèm theo bình luận (tối đa 1 phần tử)',
    required: false,
    type: [CommentMediaDto],
  })
  @IsArray({ message: 'Danh sách media phải là một mảng' })
  @ArrayMaxSize(1, {
    message: 'Bình luận chỉ được phép đính kèm tối đa 1 media',
  })
  @ValidateNested({ each: true })
  @Type(() => CommentMediaDto)
  @IsOptional()
  medias?: CommentMediaDto[];
}

export class ReplyCommentDto {
  @ApiProperty({
    description: 'Nội dung phản hồi',
    example: 'Tôi cũng nghĩ vậy!',
  })
  @IsString()
  @IsNotEmpty({ message: 'Nội dung phản hồi không được để trống' })
  content: string;

  @ApiProperty({
    description: 'URL của media đính kèm (nếu đính kèm trực tiếp)',
    required: false,
    example: 'https://example.com/reply.jpg',
  })
  @IsString()
  @IsOptional()
  mediaUrl?: string;

  @ApiProperty({
    description: 'Loại media đính kèm (nếu đính kèm trực tiếp)',
    enum: MediaType,
    required: false,
    example: MediaType.IMAGE,
  })
  @IsEnum(MediaType)
  @IsOptional()
  mediaType?: MediaType;

  @ApiProperty({
    description: 'Danh sách media kèm theo phản hồi (tối đa 1 phần tử)',
    required: false,
    type: [CommentMediaDto],
  })
  @IsArray({ message: 'Danh sách media phải là một mảng' })
  @ArrayMaxSize(1, {
    message: 'Phản hồi chỉ được phép đính kèm tối đa 1 media',
  })
  @ValidateNested({ each: true })
  @Type(() => CommentMediaDto)
  @IsOptional()
  medias?: CommentMediaDto[];
}

export class UpdateCommentDto {
  @ApiProperty({
    description: 'Nội dung bình luận mới',
    example: 'Mẹo này rất hay, tôi đã thử thành công (đã sửa)!',
    required: false,
  })
  @IsString()
  @IsNotEmpty({ message: 'Nội dung bình luận không được để trống' })
  @IsOptional()
  content?: string;

  @ApiProperty({
    description: 'URL của media đính kèm mới',
    required: false,
    example: 'https://example.com/comment.jpg',
  })
  @IsString()
  @IsOptional()
  mediaUrl?: string;

  @ApiProperty({
    description: 'Loại media đính kèm mới',
    enum: MediaType,
    required: false,
    example: MediaType.IMAGE,
  })
  @IsEnum(MediaType)
  @IsOptional()
  mediaType?: MediaType;

  @ApiProperty({
    description: 'Danh sách media kèm theo bình luận mới (tối đa 1 phần tử)',
    required: false,
    type: [CommentMediaDto],
  })
  @IsArray({ message: 'Danh sách media phải là một mảng' })
  @ArrayMaxSize(1, {
    message: 'Bình luận chỉ được phép đính kèm tối đa 1 media',
  })
  @ValidateNested({ each: true })
  @Type(() => CommentMediaDto)
  @IsOptional()
  medias?: CommentMediaDto[];
}
