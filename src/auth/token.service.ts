import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import ms from 'ms';

@Injectable()
export class TokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpires: string;
  private readonly refreshExpires: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {
    this.accessSecret =
      process.env.JWT_ACCESS_SECRET || 'default_access_secret';
    this.refreshSecret =
      process.env.JWT_REFRESH_SECRET || 'default_refresh_secret';
    this.accessExpires = process.env.JWT_ACCESS_EXPIRES || '15m';
    this.refreshExpires = process.env.JWT_REFRESH_EXPIRES || '7d';
  }

  async generateAccessToken(userId: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId },
      {
        secret: this.accessSecret,
        expiresIn: this.accessExpires as any,
      },
    );
  }

  async generateRefreshToken(userId: string): Promise<string> {
    const tokenId = crypto.randomUUID();
    const token = await this.jwtService.signAsync(
      { sub: userId, tokenId },
      {
        secret: this.refreshSecret,
        expiresIn: this.refreshExpires as any,
      },
    );

    // Decode token to extract expiration
    const decoded = this.jwtService.decode(token) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000);

    // Store only the hash of the refresh token
    const tokenHash = this.hashToken(token);
    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId,
        expiresAt,
      },
    });

    return token;
  }

  async verifyRefreshToken(token: string): Promise<{ userId: string }> {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.refreshSecret,
      });

      const tokenHash = this.hashToken(token);
      const dbToken = await this.prisma.refreshToken.findUnique({
        where: { tokenHash },
      });

      if (!dbToken) {
        throw new UnauthorizedException(
          'Token không hợp lệ hoặc đã bị thu hồi',
        );
      }

      if (dbToken.expiresAt < new Date()) {
        await this.revokeRefreshToken(token);
        throw new UnauthorizedException('Token đã hết hạn');
      }

      return { userId: payload.sub };
    } catch {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }
  }

  async revokeRefreshToken(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    await this.prisma.refreshToken.deleteMany({
      where: { tokenHash },
    });
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  getAccessCookieMaxAgeMs(): number {
    const defaultMs = 15 * 60 * 1000;
    try {
      return (ms(this.accessExpires as any) as unknown as number) || defaultMs;
    } catch {
      return defaultMs;
    }
  }

  getRefreshCookieMaxAgeMs(): number {
    // Parse duration string into ms
    // Default to 7 days if parsing fails
    const defaultMs = 7 * 24 * 60 * 60 * 1000;
    try {
      return (ms(this.refreshExpires as any) as unknown as number) || defaultMs;
    } catch {
      return defaultMs;
    }
  }
}
