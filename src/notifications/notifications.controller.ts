import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { GetNotificationsDto } from './dto/notification.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('list')
  @ApiOperation({ summary: 'Lấy danh sách thông báo phân trang' })
  async getNotifications(@Req() req: any, @Query() query: GetNotificationsDto) {
    return this.notificationsService.getNotifications(
      req.user.id,
      query.page,
      query.limit,
    );
  }

  @Get('latest')
  @ApiOperation({ summary: 'Lấy danh sách thông báo mới nhất' })
  async getLatestNotifications(@Req() req: any) {
    // Return top 20 latest notifications quickly
    return this.notificationsService.getLatestNotifications(req.user.id, 20);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Lấy số lượng thông báo chưa đọc' })
  async getUnreadCount(@Req() req: any) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Patch('read/:id')
  @ApiOperation({ summary: 'Đánh dấu một thông báo là đã đọc' })
  async markAsRead(@Req() req: any, @Param('id') id: string) {
    return this.notificationsService.markAsRead(req.user.id, id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Đánh dấu tất cả thông báo là đã đọc' })
  async markAllAsRead(@Req() req: any) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  @Delete('delete/:id')
  @ApiOperation({ summary: 'Xóa một thông báo' })
  async deleteNotification(@Req() req: any, @Param('id') id: string) {
    return this.notificationsService.deleteNotification(req.user.id, id);
  }

  @Delete('delete-all')
  @ApiOperation({ summary: 'Xóa tất cả thông báo' })
  async deleteAllNotifications(@Req() req: any) {
    return this.notificationsService.deleteAllNotifications(req.user.id);
  }
}
