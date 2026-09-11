import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { UsersService } from './users.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { GetUsersQueryDto, UpdateUserDto } from './dto/admin.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { Role } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly usersService: UsersService,
  ) {}

  private setRefreshCookie(res: Response, token: string) {
    const isProduction = process.env.NODE_ENV === 'production';
    const maxAge = this.tokenService.getRefreshCookieMaxAgeMs();

    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge,
      path: '/api/v1/auth', // Restrict cookie path to auth endpoints for security
    });
  }

  private clearRefreshCookie(res: Response) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/api/v1/auth',
    });
  }

  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản mới' })
  @ApiResponse({ status: 201, description: 'Tài khoản được tạo thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ' })
  @ApiResponse({ status: 409, description: 'Tên đăng nhập đã được sử dụng' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập bằng userName và password' })
  @ApiResponse({
    status: 200,
    description: 'Đăng nhập thành công, trả về access token và thông tin user',
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ' })
  @ApiResponse({
    status: 401,
    description: 'Tên đăng nhập hoặc mật khẩu không chính xác',
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setRefreshCookie(res, result.refreshToken);
    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lấy access token mới sử dụng refresh token từ cookie',
  })
  @ApiResponse({ status: 200, description: 'Cấp mới access token thành công' })
  @ApiResponse({
    status: 401,
    description: 'Refresh token không hợp lệ hoặc đã hết hạn',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('Yêu cầu phải có Refresh Token');
    }

    const result = await this.authService.refresh(refreshToken);
    this.setRefreshCookie(res, result.newRefreshToken);
    return {
      accessToken: result.accessToken,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng xuất tài khoản, thu hồi refresh token' })
  @ApiResponse({ status: 200, description: 'Đăng xuất thành công' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refresh_token'];
    if (refreshToken) {
      await this.authService.logout(refreshToken).catch(() => {
        // Suppress errors during logout if token was already deleted/expired
      });
    }
    this.clearRefreshCookie(res);
    return {
      success: true,
      message: 'Đăng xuất thành công',
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin của người dùng đăng nhập hiện tại' })
  @ApiResponse({
    status: 200,
    description: 'Trả về thông tin chi tiết của người dùng',
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc token không hợp lệ',
  })
  async me(@Req() req: any) {
    return this.authService.getCurrentUser(req.user.id);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin hồ sơ của người dùng hiện tại' })
  @ApiResponse({ status: 200, description: 'Trả về thông tin hồ sơ' })
  async getProfile(@Req() req: any) {
    return this.usersService.getProfile(req.user.id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật thông tin hồ sơ của người dùng hiện tại' })
  @ApiResponse({ status: 200, description: 'Cập nhật hồ sơ thành công' })
  async updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thay đổi mật khẩu tài khoản hiện tại' })
  @ApiResponse({ status: 200, description: 'Thay đổi mật khẩu thành công' })
  @ApiResponse({
    status: 400,
    description:
      'Dữ liệu đầu vào không hợp lệ hoặc mật khẩu xác nhận không khớp',
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc mật khẩu hiện tại không đúng',
  })
  async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(req.user.id, dto);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy danh sách người dùng phân trang (chỉ dành cho Admin)',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách thành công' })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc token không hợp lệ',
  })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền truy cập (không phải Admin)',
  })
  async getUsers(@Query() query: GetUsersQueryDto) {
    return this.usersService.getUsers(query);
  }

  @Get('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy chi tiết thông tin người dùng (chỉ dành cho Admin)',
  })
  @ApiResponse({ status: 200, description: 'Lấy thông tin thành công' })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc token không hợp lệ',
  })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy người dùng' })
  async getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }

  @Patch('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Cập nhật thông tin người dùng (chỉ dành cho Admin, hiện tại chỉ cho phép cập nhật fullName)',
  })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ' })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc token không hợp lệ',
  })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy người dùng' })
  async updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUser(id, dto);
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Xóa mềm tài khoản người dùng (chỉ dành cho Admin)',
  })
  @ApiResponse({ status: 200, description: 'Xóa người dùng thành công' })
  @ApiResponse({
    status: 400,
    description:
      'Không thể tự xóa chính mình hoặc xóa tài khoản Admin cuối cùng',
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc token không hợp lệ',
  })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy người dùng' })
  async deleteUser(@Param('id') id: string, @Req() req: any) {
    return this.usersService.softDeleteUser(id, req.user.id);
  }
}
