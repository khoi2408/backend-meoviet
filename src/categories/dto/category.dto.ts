import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsArray, ArrayNotEmpty } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Tên danh mục mới', example: 'Công nghệ' })
  @IsString()
  @IsNotEmpty({ message: 'Tên danh mục không được để trống' })
  name: string;
}

export class UpdateCategoryDto {
  @ApiProperty({
    description: 'Tên danh mục mới cần cập nhật',
    example: 'Lập trình',
  })
  @IsString()
  @IsNotEmpty({ message: 'Tên danh mục không được để trống' })
  name: string;
}

export class DeleteCategoriesDto {
  @ApiProperty({
    description: 'Danh sách ID danh mục cần xóa',
    example: ['uuid-1', 'uuid-2'],
    type: [String],
  })
  @IsArray({ message: 'Danh sách ID phải là một mảng' })
  @ArrayNotEmpty({ message: 'Danh sách ID không được để trống' })
  @IsString({ each: true, message: 'Mỗi ID danh mục phải là một chuỗi' })
  ids: string[];
}
