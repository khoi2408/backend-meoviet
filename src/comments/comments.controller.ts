import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto, ReplyCommentDto } from './dto/comment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('Comments')
@Controller('comments')
@ApiResponse({
  status: 401,
  description: 'Chưa đăng nhập hoặc token không hợp lệ',
})
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly jwtService: JwtService,
  ) {}

  @Get('list')
  @ApiOperation({
    summary: 'Lấy cây bình luận phân cấp của một bài viết (Công khai)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách bình luận thành công',
  })
  @ApiResponse({ status: 404, description: 'Bài viết không tồn tại' })
  async getComments(
    @Req() req: any,
    @Query('postId') postId: string,
  ) {
    let currentUserId: string | undefined;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const decoded = this.jwtService.decode(token) as { sub: string };
        currentUserId = decoded?.sub;
      }
    } catch {
      // Ignore parsing errors for guest users
    }

    return this.commentsService.getCommentsForPost(postId, currentUserId);
  }

  @Post('create')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Tạo bình luận mới trong bài viết',
  })
  @ApiResponse({ status: 201, description: 'Tạo bình luận thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({
    status: 404,
    description: 'Bài viết hoặc bình luận cha không tồn tại',
  })
  async createComment(
    @Req() req: any,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.createComment(req.user.id, dto.postId, dto);
  }

  @Post('reply/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Tạo câu trả lời cho một bình luận',
  })
  @ApiResponse({ status: 201, description: 'Tạo câu trả lời thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({
    status: 404,
    description: 'Bình luận cha không tồn tại',
  })
  async replyComment(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplyCommentDto,
  ) {
    return this.commentsService.replyToComment(req.user.id, id, dto);
  }

  @Patch('update/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cập nhật nội dung/media bình luận (chỉ chủ bình luận)',
  })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền chỉnh sửa bình luận của người khác',
  })
  @ApiResponse({ status: 404, description: 'Bình luận không tồn tại' })
  async updateComment(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.updateComment(req.user.id, id, dto);
  }

  @Delete('delete/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Xóa bình luận và tất cả các phản hồi con (chủ bình luận hoặc Admin)',
  })
  @ApiResponse({ status: 200, description: 'Xóa bình luận thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền xóa bình luận này' })
  @ApiResponse({ status: 404, description: 'Bình luận không tồn tại' })
  async deleteComment(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.commentsService.deleteComment(req.user.id, req.user.role, id);
  }
}
