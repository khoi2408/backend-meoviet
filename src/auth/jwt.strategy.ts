import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET || 'default_access_secret',
    });
  }

  async validate(payload: { sub: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
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
    };
  }
}
