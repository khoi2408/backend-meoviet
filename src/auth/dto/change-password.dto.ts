import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Mật khẩu hiện tại', example: 'oldPassword123' })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng điền mật khẩu hiện tại' })
  currentPassword!: string;

  @ApiProperty({
    description: 'Mật khẩu mới (tối thiểu 8 ký tự)',
    minLength: 8,
    example: 'newPassword123',
  })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới phải từ 8 ký tự trở lên' })
  newPassword!: string;
}
