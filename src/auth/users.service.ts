import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { GetUsersQueryDto, UpdateUserDto } from './dto/admin.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { MediaService } from '../media/media.service';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly mediaService: MediaService,
  ) {}

  private excludePassword<T extends { password?: string }>(
    user: T,
  ): Omit<T, 'password'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async getUsers(query: GetUsersQueryDto) {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: any = {
      isDeleted: false,
    };

    if (search) {
      where.OR = [
        { userName: { contains: search } },
        { fullName: { contains: search } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (status) {
      where.status = status;
    }

    const total = await this.prisma.user.count({ where });
    const totalPages = Math.ceil(total / limit);

    // List of allowed sort fields to prevent injection or runtime errors
    const allowedSortFields = [
      'createdAt',
      'userName',
      'fullName',
      'updatedAt',
    ];
    const actualSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';

    const users = await this.prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        [actualSortBy]: sortOrder,
      },
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
    });

    const data = users.map((user) => {
      return this.excludePassword(user);
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user || user.isDeleted) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    return this.excludePassword(user);
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user || user.isDeleted) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName,
      },
    });

    return this.excludePassword(updatedUser);
  }

  async softDeleteUser(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new BadRequestException(
        'Không thể tự xóa tài khoản của chính mình',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user || user.isDeleted) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    if (user.role === Role.ADMIN) {
      const adminCount = await this.prisma.user.count({
        where: {
          role: Role.ADMIN,
          isDeleted: false,
        },
      });

      if (adminCount <= 1) {
        throw new BadRequestException(
          'Không thể xóa tài khoản Admin cuối cùng',
        );
      }
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Xóa người dùng thành công',
    };
  }

  async getProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user || user.isDeleted) {
      throw new NotFoundException('Người dùng không tồn tại');
    }
    return this.excludePassword(user);
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user || user.isDeleted) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    if (dto.avatarUrl !== undefined && user.avatarUrl && user.avatarUrl !== dto.avatarUrl) {
      await this.mediaService.deleteFile(user.avatarUrl).catch(err => {
        console.error('Failed to delete old avatar:', err);
      });
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        avatarUrl: dto.avatarUrl,
      },
    });

    return this.excludePassword(updated);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.isDeleted || user.status === 'SUSPENDED') {
      throw new NotFoundException('Tài khoản không tồn tại hoặc đã bị khóa');
    }

    const passwordMatches = await this.passwordService.compare(
      dto.currentPassword,
      user.password,
    );
    if (!passwordMatches) {
      throw new BadRequestException('Mật khẩu hiện tại không chính xác');
    }

    const hashedNewPassword = await this.passwordService.hash(dto.newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedNewPassword,
      },
    });

    return {
      success: true,
      message: 'Thay đổi mật khẩu thành công',
    };
  }
}
