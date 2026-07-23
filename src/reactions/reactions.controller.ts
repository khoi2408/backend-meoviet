import {
  Controller,
  Post,
  Delete,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { ReactionsService } from './reactions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReactionType } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('Reactions')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @Post('posts/:id/like')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Thích (like) bài viết. Nếu đã thích thì sẽ bỏ thích.',
  })
  @ApiResponse({ status: 200, description: 'Xử lý thành công' })
  @ApiResponse({ status: 404, description: 'Bài viết không tồn tại' })
  async likePost(@Req() req: any, @Param('id') id: string) {
    return this.reactionsService.reactToPost(
      req.user.id,
      id,
      ReactionType.LIKE,
    );
  }

  @Post('posts/:id/dislike')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Không thích (dislike) bài viết. Nếu đã không thích thì sẽ bỏ không thích.',
  })
  @ApiResponse({ status: 200, description: 'Xử lý thành công' })
  @ApiResponse({ status: 404, description: 'Bài viết không tồn tại' })
  async dislikePost(@Req() req: any, @Param('id') id: string) {
    return this.reactionsService.reactToPost(
      req.user.id,
      id,
      ReactionType.DISLIKE,
    );
  }

  @Delete('posts/:id/reaction')
  @ApiOperation({ summary: 'Xóa phản hồi (like/dislike) của bài viết' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 404, description: 'Bài viết không tồn tại' })
  async deletePostReaction(@Req() req: any, @Param('id') id: string) {
    return this.reactionsService.deletePostReaction(req.user.id, id);
  }

  @Post('comments/:id/like')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Thích (like) bình luận. Nếu đã thích thì sẽ bỏ thích.',
  })
  @ApiResponse({ status: 200, description: 'Xử lý thành công' })
  @ApiResponse({ status: 404, description: 'Bình luận không tồn tại' })
  async likeComment(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.reactionsService.reactToComment(
      req.user.id,
      id,
      ReactionType.LIKE,
    );
  }

  @Post('comments/:id/dislike')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Không thích (dislike) bình luận. Nếu đã không thích thì sẽ bỏ không thích.',
  })
  @ApiResponse({ status: 200, description: 'Xử lý thành công' })
  @ApiResponse({ status: 404, description: 'Bình luận không tồn tại' })
  async dislikeComment(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.reactionsService.reactToComment(
      req.user.id,
      id,
      ReactionType.DISLIKE,
    );
  }

  @Delete('comments/:id/reaction')
  @ApiOperation({ summary: 'Xóa phản hồi (like/dislike) của bình luận' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 404, description: 'Bình luận không tồn tại' })
  async deleteCommentReaction(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.reactionsService.deleteCommentReaction(req.user.id, id);
  }
}
