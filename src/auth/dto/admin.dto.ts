import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role, UserStatus } from '@prisma/client';

export class GetUsersQueryDto {
  @ApiPropertyOptional({
    description: 'Trang hiện tại (bắt đầu từ 1)',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Số lượng kết quả trên mỗi trang',
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Tìm kiếm theo userName hoặc fullName' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Lọc theo vai trò (role)', enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái (status)',
    enum: UserStatus,
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    description: 'Trường sắp xếp (ví dụ: createdAt, userName, fullName)',
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Thứ tự sắp xếp (asc hoặc desc)',
    default: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'Họ và tên đầy đủ',
    example: 'Lê Minh Khôi',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng điền đầy đủ họ và tên' })
  fullName?: string;
}
