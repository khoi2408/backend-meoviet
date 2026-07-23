import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy dữ liệu thống kê tổng hợp cho Admin Dashboard' })
  @ApiResponse({ status: 200, description: 'Lấy thống kê thành công' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập hoặc token không hợp lệ' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập (yêu cầu ADMIN)' })
  async getDashboard(@Query('year') year?: string) {
    const yearNum = year ? parseInt(year, 10) : undefined;
    return this.dashboardService.getDashboardData(yearNum);
  }
}
