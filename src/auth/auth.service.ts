import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { userName: dto.userName },
    });

    if (existingUser) {
      throw new ConflictException('Tên đăng nhập đã được sử dụng!');
    }

    const hashedPassword = await this.passwordService.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        userName: dto.userName,
        fullName: dto.fullName,
        password: hashedPassword,
      },
    });

    try {
      await this.notificationsService.createNotification(
        user.id,
        NotificationType.SYSTEM_WELCOME,
        'Chào mừng thành viên mới',
        'Chào mừng bạn đến với Mẹo Dân Gian! Hãy cùng chia sẻ và khám phá những mẹo hay mỗi ngày.',
      );
    } catch (err: any) {
      console.error('Error creating welcome notification:', err?.message || err);
    }

    return {
      id: user.id,
      userName: user.userName,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { userName: dto.userName },
    });

    if (!user || user.isDeleted || user.status === 'SUSPENDED') {
      throw new UnauthorizedException(
        'Tên đăng nhập hoặc mật khẩu không chính xác',
      );
    }

    const passwordMatches = await this.passwordService.compare(
      dto.password,
      user.password,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException(
        'Tên đăng nhập hoặc mật khẩu không chính xác',
      );
    }

    const accessToken = await this.tokenService.generateAccessToken(user.id);
    const refreshToken = await this.tokenService.generateRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        userName: user.userName,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      refreshToken,
    };
  }

  async refresh(token: string) {
    // Validate the refresh token (throws UnauthorizedException if invalid/expired/revoked)
    const { userId } = await this.tokenService.verifyRefreshToken(token);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.isDeleted || user.status === 'SUSPENDED') {
      throw new UnauthorizedException(
        'Tài khoản không tồn tại hoặc đã bị khóa',
      );
    }

    // Revoke the old refresh token (Token Rotation)
    await this.tokenService.revokeRefreshToken(token);

    // Generate new pair
    const accessToken = await this.tokenService.generateAccessToken(userId);
    const newRefreshToken =
      await this.tokenService.generateRefreshToken(userId);

    return {
      userId,
      accessToken,
      newRefreshToken,
    };
  }

  async logout(token?: string, userId?: string) {
    if (token) {
      await this.tokenService.revokeRefreshToken(token).catch(() => {});
    }
    if (userId) {
      await this.tokenService.revokeAllUserRefreshTokens(userId).catch(() => {});
    }
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.isDeleted || user.status === 'SUSPENDED') {
      throw new UnauthorizedException(
        'Tài khoản không tồn tại hoặc đã bị khóa',
      );
    }

    return {
      id: user.id,
      userName: user.userName,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl,
    };
  }
}
