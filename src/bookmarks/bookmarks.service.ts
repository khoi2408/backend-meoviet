import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BookmarksService {
  constructor(private readonly prisma: PrismaService) {}

  async addBookmark(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });
    if (!post) {
      throw new NotFoundException('Bài viết không tồn tại');
    }

    const existing = await this.prisma.bookmark.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    if (!existing) {
      await this.prisma.bookmark.create({
        data: {
          userId,
          postId,
        },
      });
    }

    return {
      success: true,
      message: 'Đã lưu bài viết vào danh sách dấu trang',
    };
  }

  async removeBookmark(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });
    if (!post) {
      throw new NotFoundException('Bài viết không tồn tại');
    }

    const existing = await this.prisma.bookmark.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    if (existing) {
      await this.prisma.bookmark.delete({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
      });
    }

    return {
      success: true,
      message: 'Đã xóa bài viết khỏi danh sách dấu trang',
    };
  }

  async getMyBookmarks(userId: string) {
    const bookmarks = await this.prisma.bookmark.findMany({
      where: { userId },
      include: {
        post: {
          include: {
            user: {
              select: {
                id: true,
                userName: true,
                fullName: true,
              },
            },
            medias: {
              orderBy: { order: 'asc' },
            },
            categories: {
              include: {
                category: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return bookmarks.map((b) => ({
      id: b.postId,
      bookmarkedAt: b.createdAt,
      post: {
        ...b.post,
        categories: b.post.categories.map((c) => c.category),
      },
    }));
  }
}
