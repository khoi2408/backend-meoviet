import { IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({ description: 'Họ và tên', example: 'Nguyễn Văn A' })
  @IsString()
  @IsNotEmpty({ message: 'Họ và tên không được để trống' })
  @MinLength(2, { message: 'Họ và tên phải từ 2 ký tự trở lên' })
  fullName!: string;

  @ApiProperty({ description: 'Đường dẫn ảnh đại diện', required: false, example: 'http://...' })
  @IsString()
  @IsOptional()
  avatarUrl?: string;
}
