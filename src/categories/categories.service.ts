import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  DeleteCategoriesDto,
} from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCategories(search?: string) {
    const where: any = {};
    if (search) {
      where.name = {
        contains: search,
      };
    }
    return this.prisma.category.findMany({
      where,
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    const name = dto.name.trim();
    const existing = await this.prisma.category.findUnique({
      where: { name },
    });

    if (existing) {
      throw new ConflictException('Tên danh mục đã tồn tại');
    }

    return this.prisma.category.create({
      data: { name },
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Danh mục không tồn tại');
    }

    const name = dto.name.trim();
    const existing = await this.prisma.category.findUnique({
      where: { name },
    });

    if (existing && existing.id !== id) {
      throw new ConflictException('Tên danh mục đã tồn tại');
    }

    return this.prisma.category.update({
      where: { id },
      data: { name },
    });
  }

  async deleteCategory(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Danh mục không tồn tại');
    }

    await this.prisma.category.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Xóa danh mục thành công',
    };
  }

  async deleteCategories(dto: DeleteCategoriesDto) {
    const result = await this.prisma.category.deleteMany({
      where: {
        id: { in: dto.ids },
      },
    });

    return {
      success: true,
      message: `Đã xóa thành công ${result.count} danh mục`,
      count: result.count,
    };
  }
}
