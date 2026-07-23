import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  DeleteCategoriesDto,
} from './dto/category.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get('list')
  @ApiOperation({
    summary: 'Lấy tất cả danh mục sắp xếp theo thứ tự bảng chữ cái',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách thành công' })
  async getCategories(@Query('search') search?: string) {
    return this.categoriesService.getCategories(search);
  }

  @Post('create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo danh mục mới (chỉ dành cho Admin)' })
  @ApiResponse({ status: 201, description: 'Tạo danh mục thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ' })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc token không hợp lệ',
  })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền truy cập (không phải Admin)',
  })
  @ApiResponse({ status: 409, description: 'Tên danh mục đã tồn tại' })
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.createCategory(dto);
  }

  @Patch('update/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật tên danh mục (chỉ dành cho Admin)' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ' })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc token không hợp lệ',
  })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Danh mục không tồn tại' })
  @ApiResponse({ status: 409, description: 'Tên danh mục đã tồn tại' })
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.updateCategory(id, dto);
  }

  @Delete('delete-many')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Xóa nhiều danh mục theo danh sách ID (chỉ dành cho Admin)',
  })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ' })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc token không hợp lệ',
  })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  async deleteCategories(@Body() dto: DeleteCategoriesDto) {
    return this.categoriesService.deleteCategories(dto);
  }

  @Delete('delete/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Xóa danh mục theo ID (chỉ dành cho Admin)',
  })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc token không hợp lệ',
  })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Danh mục không tồn tại' })
  async deleteCategory(@Param('id') id: string) {
    return this.categoriesService.deleteCategory(id);
  }
}
