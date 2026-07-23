import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum PostSortOption {
  NEWEST = 'newest',
  MOST_LIKED = 'most-liked',
  MOST_BOOKMARKED = 'most-bookmarked',
}

export class GetPostsQueryDto {
  @ApiPropertyOptional({ description: 'Số trang', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Số lượng bài viết trên mỗi trang',
    default: 10,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Tìm kiếm theo nội dung bài viết' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Danh sách ID danh mục (phân cách bằng dấu phẩy)',
  })
  @IsString()
  @IsOptional()
  categoryIds?: string;

  @ApiPropertyOptional({
    description: 'Sắp xếp theo',
    enum: PostSortOption,
    default: PostSortOption.NEWEST,
  })
  @IsEnum(PostSortOption)
  @IsOptional()
  sort?: PostSortOption = PostSortOption.NEWEST;
}
