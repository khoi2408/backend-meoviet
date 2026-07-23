import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { BookmarksService } from './bookmarks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('Bookmarks')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Post('posts/:id/bookmark')
  @ApiOperation({ summary: 'Lưu bài viết vào danh sách dấu trang (bookmark)' })
  @ApiResponse({ status: 201, description: 'Lưu thành công' })
  @ApiResponse({ status: 404, description: 'Bài viết không tồn tại' })
  async addBookmark(@Req() req: any, @Param('id') id: string) {
    return this.bookmarksService.addBookmark(req.user.id, id);
  }

  @Delete('posts/:id/bookmark')
  @ApiOperation({ summary: 'Xóa bài viết khỏi danh sách dấu trang (bookmark)' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 404, description: 'Bài viết không tồn tại' })
  async removeBookmark(@Req() req: any, @Param('id') id: string) {
    return this.bookmarksService.removeBookmark(req.user.id, id);
  }

  @Get('users/me/bookmarks')
  @ApiOperation({
    summary: 'Lấy danh sách các bài viết đã bookmark của người dùng hiện tại',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách thành công' })
  async getMyBookmarks(@Req() req: any) {
    return this.bookmarksService.getMyBookmarks(req.user.id);
  }
}
