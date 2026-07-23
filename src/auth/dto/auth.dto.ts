import { IsString, IsNotEmpty, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description:
      'Tên đăng nhập, từ 3 ký tự trở lên, chỉ chứa chữ cái, chữ số và gạch dưới',
    minLength: 3,
    example: 'khoibodoi',
  })
  @IsString()
  @MinLength(3, { message: 'Tên đăng nhập phải chứa tối thiểu 3 ký tự' })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Tên đăng nhập chỉ được chứa chữ cái, chữ số và gạch dưới',
  })
  userName!: string;

  @ApiProperty({
    description: 'Họ và tên đầy đủ',
    example: 'Lê Minh Khôi',
  })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng điền đầy đủ họ và tên' })
  fullName!: string;

  @ApiProperty({
    description: 'Mật khẩu đăng nhập, tối thiểu 8 ký tự',
    minLength: 8,
    example: 'strongPassword123',
  })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải từ 8 ký tự trở lên' })
  password!: string;
}

export class LoginDto {
  @ApiProperty({
    description: 'Tên đăng nhập',
    example: 'khoibodoi',
  })
  @IsString()
  @IsNotEmpty({ message: 'Tên đăng nhập không được để trống' })
  userName!: string;

  @ApiProperty({
    description: 'Mật khẩu đăng nhập',
    example: 'strongPassword123',
  })
  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  password!: string;
}
