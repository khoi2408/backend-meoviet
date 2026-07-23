import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from './users.service';
import { AuthController } from './auth.controller';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { JwtStrategy } from './jwt.strategy';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsModule } from '../notifications/notifications.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    NotificationsModule,
    MediaModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    UsersService,
    PasswordService,
    TokenService,
    JwtStrategy,
  ],
  exports: [AuthService, UsersService, TokenService, JwtModule],
})
export class AuthModule {}
