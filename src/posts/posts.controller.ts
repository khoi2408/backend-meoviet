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
  Query,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { GetPostsQueryDto } from './dto/get-posts.dto';
import { JwtService } from '@nestjs/jwt';

@ApiTags('Posts')
@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly jwtService: JwtService,
  ) {}

  @Get('list')
  @ApiOperation({
    summary:
      'Lấy danh sách các bài viết với phân trang, tìm kiếm, lọc và sắp xếp',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách thành công' })
  async getPosts(@Req() req: any, @Query() query: GetPostsQueryDto) {
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

    return this.postsService.getPosts(query, currentUserId);
  }

  @Get('detail/:id')
  @ApiOperation({ summary: 'Lấy chi tiết một bài viết' })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết thành công' })
  @ApiResponse({ status: 404, description: 'Bài viết không tồn tại' })
  async getPostById(@Param('id') id: string) {
    return this.postsService.getPostById(id);
  }

  @Post('create')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo bài viết mới (yêu cầu đăng nhập)' })
  @ApiResponse({ status: 201, description: 'Tạo bài viết thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc token không hợp lệ',
  })
  async createPost(@Req() req: any, @Body() dto: CreatePostDto) {
    return this.postsService.createPost(req.user.id, dto);
  }

  @Patch('update/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cập nhật nội dung/danh mục/media của bài viết (chỉ chủ bài viết)',
  })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc token không hợp lệ',
  })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền chỉnh sửa bài viết của người khác',
  })
  @ApiResponse({ status: 404, description: 'Bài viết không tồn tại' })
  async updatePost(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.updatePost(req.user.id, id, dto);
  }

  @Delete('delete/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Xóa bài viết (chỉ dành cho chủ bài viết hoặc Admin)',
  })
  @ApiResponse({ status: 200, description: 'Xóa bài viết thành công' })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc token không hợp lệ',
  })
  @ApiResponse({ status: 403, description: 'Không có quyền xóa bài viết' })
  @ApiResponse({ status: 404, description: 'Bài viết không tồn tại' })
  async deletePost(@Req() req: any, @Param('id') id: string) {
    return this.postsService.deletePost(req.user.id, req.user.role, id);
  }

  @Post('hide/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ẩn bài viết đối với người dùng hiện tại' })
  @ApiResponse({ status: 201, description: 'Ẩn bài viết thành công' })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc token không hợp lệ',
  })
  @ApiResponse({ status: 404, description: 'Bài viết không tồn tại' })
  async hidePost(@Req() req: any, @Param('id') id: string) {
    return this.postsService.hidePost(req.user.id, id);
  }

  @Get('trending-keywords')
  @ApiOperation({ summary: 'Lấy top 3 từ khóa xu hướng nổi bật' })
  @ApiResponse({ status: 200, description: 'Lấy từ khóa xu hướng thành công' })
  async getTrendingKeywords() {
    return this.postsService.getTrendingKeywords();
  }

  @Get('active-contributors')
  @ApiOperation({ summary: 'Lấy top 3 người đóng góp tích cực nhất' })
  @ApiResponse({ status: 200, description: 'Lấy người đóng góp tích cực thành công' })
  async getActiveContributors() {
    return this.postsService.getActiveContributors();
  }
}
