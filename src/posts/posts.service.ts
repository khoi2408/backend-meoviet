import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';
import { Role, NotificationType } from '@prisma/client';
import { GetPostsQueryDto, PostSortOption } from './dto/get-posts.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { MediaService } from '../media/media.service';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly mediaService: MediaService,
  ) {}

  async getPosts(query: GetPostsQueryDto = {}, currentUserId?: string) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    // 1. Search filter
    if (query.search) {
      where.content = {
        contains: query.search,
      };
      // Log search query in the database
      const keyword = query.search.trim().toLowerCase();
      if (keyword.length > 0) {
        this.prisma.searchQuery
          .create({
            data: { keyword },
          })
          .catch((err) => {
            console.error('Error logging search query:', err);
          });
      }
    }

    // 2. Category filter
    if (query.categoryIds) {
      const ids = query.categoryIds
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      if (ids.length > 0) {
        where.categories = {
          some: {
            categoryId: { in: ids },
          },
        };
      }
    }

    // 3. Exclude hidden posts
    if (currentUserId) {
      where.hiddenPosts = {
        none: {
          userId: currentUserId,
        },
      };
    }

    // 4. Sort logic
    let orderBy: any = { createdAt: 'desc' }; // default: newest
    if (query.sort === PostSortOption.MOST_LIKED) {
      orderBy = [
        {
          reactions: {
            _count: 'desc',
          },
        },
        {
          createdAt: 'desc',
        },
      ];
    } else if (query.sort === PostSortOption.MOST_BOOKMARKED) {
      orderBy = [
        {
          bookmarks: {
            _count: 'desc',
          },
        },
        {
          createdAt: 'desc',
        },
      ];
    }

    // 5. Query count and data
    const [total, posts] = await Promise.all([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              userName: true,
              fullName: true,
              avatarUrl: true,
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
          reactions: true,
          bookmarks: true,
          hiddenPosts: true,
          _count: {
            select: { comments: true },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;

    const formattedPosts = posts.map((post) => ({
      ...post,
      categories: post.categories.map((c) => c.category),
    }));

    return {
      posts: formattedPosts,
      page,
      limit,
      total,
      totalPages,
      hasNextPage,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
      },
    };
  }

  async createPost(userId: string, dto: CreatePostDto) {
    const post = await this.prisma.$transaction(async (tx) => {
      // 1. Create Post
      const newPost = await tx.post.create({
        data: {
          content: dto.content,
          userId,
        },
      });

      // 2. Add Category Relations
      if (dto.categoryIds && dto.categoryIds.length > 0) {
        const existingCats = await tx.category.findMany({
          where: { id: { in: dto.categoryIds } },
          select: { id: true },
        });
        const existingIds = existingCats.map((c) => c.id);

        if (existingIds.length > 0) {
          await tx.categoriesOnPosts.createMany({
            data: existingIds.map((categoryId) => ({
              postId: newPost.id,
              categoryId,
            })),
          });
        }
      }

      // 3. Add Medias
      if (dto.medias && dto.medias.length > 0) {
        await tx.media.createMany({
          data: dto.medias.map((media, index) => ({
            postId: newPost.id,
            type: media.type,
            url: media.url,
            order: index,
          })),
        });
      }

      // 4. Fetch populated post
      return tx.post.findUnique({
        where: { id: newPost.id },
        include: {
          user: {
            select: {
              id: true,
              userName: true,
              fullName: true,
              avatarUrl: true,
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
          reactions: true,
          bookmarks: true,
          hiddenPosts: true,
          _count: {
            select: { comments: true },
          },
        },
      });
    });

    if (!post) return null;

    return {
      ...post,
      categories: post.categories.map((c) => c.category),
    };
  }

  async updatePost(userId: string, id: string, dto: UpdatePostDto) {
    const post = await this.prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      throw new NotFoundException('Bài viết không tồn tại');
    }

    if (post.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa bài viết này');
    }

    const updatedPost = await this.prisma.$transaction(async (tx) => {
      // 1. Update Content
      if (dto.content !== undefined) {
        await tx.post.update({
          where: { id },
          data: { content: dto.content },
        });
      }

      // 2. Update Categories
      if (dto.categoryIds !== undefined) {
        // Clear existing categories
        await tx.categoriesOnPosts.deleteMany({
          where: { postId: id },
        });

        // Add new relations
        if (dto.categoryIds.length > 0) {
          const existingCats = await tx.category.findMany({
            where: { id: { in: dto.categoryIds } },
            select: { id: true },
          });
          const existingIds = existingCats.map((c) => c.id);

          if (existingIds.length > 0) {
            await tx.categoriesOnPosts.createMany({
              data: existingIds.map((categoryId) => ({
                postId: id,
                categoryId,
              })),
            });
          }
        }
      }

      // 3. Update Medias
      if (dto.medias !== undefined) {
        // Query existing medias to delete physical files
        const oldMedias = await tx.media.findMany({
          where: { postId: id },
        });

        // Clear existing medias
        await tx.media.deleteMany({
          where: { postId: id },
        });

        // Delete physical files
        for (const media of oldMedias) {
          await this.mediaService.deleteFile(media.url).catch((err) => {
            console.error('Failed to delete old media file:', err);
          });
        }

        // Add new medias
        if (dto.medias.length > 0) {
          await tx.media.createMany({
            data: dto.medias.map((media, index) => ({
              postId: id,
              type: media.type,
              url: media.url,
              order: index,
            })),
          });
        }
      }

      // 4. Fetch updated post
      return tx.post.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              userName: true,
              fullName: true,
              avatarUrl: true,
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
          reactions: true,
          bookmarks: true,
          hiddenPosts: true,
          _count: {
            select: { comments: true },
          },
        },
      });
    });

    if (!updatedPost) return null;

    return {
      ...updatedPost,
      categories: updatedPost.categories.map((c) => c.category),
    };
  }

  async deletePost(userId: string, userRole: Role, id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      throw new NotFoundException('Bài viết không tồn tại');
    }

    if (post.userId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('Bạn không có quyền xóa bài viết này');
    }

    if (post.userId !== userId && userRole === Role.ADMIN) {
      try {
        await this.notificationsService.createNotification(
          post.userId,
          NotificationType.ADMIN_DELETE_POST,
          'Bài viết bị gỡ bỏ',
          'Bài viết của bạn đã bị gỡ bỏ bởi quản trị viên.',
          id,
          undefined,
          userId,
         );
      } catch (err: any) {
        console.error('Error creating admin post deletion notification:', err?.message || err);
      }
    }

    // Query medias to delete physical files
    const postMedias = await this.prisma.media.findMany({
      where: { postId: id },
    });

    for (const media of postMedias) {
      await this.mediaService.deleteFile(media.url).catch((err) => {
        console.error('Failed to delete media file on post deletion:', err);
      });
    }

    await this.prisma.post.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Xóa bài viết thành công',
    };
  }

  async hidePost(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Bài viết không tồn tại');
    }

    const existing = await this.prisma.hiddenPost.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    if (!existing) {
      await this.prisma.hiddenPost.create({
        data: {
          userId,
          postId,
        },
      });
    }

    return {
      success: true,
      message: 'Đã ẩn bài viết thành công',
    };
  }

  async getPostById(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            userName: true,
            fullName: true,
            avatarUrl: true,
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
        reactions: true,
        bookmarks: true,
        hiddenPosts: true,
        _count: {
          select: { comments: true },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Bài viết không tồn tại');
    }

    return {
      ...post,
      categories: post.categories.map((c) => c.category),
    };
  }

  async getTrendingKeywords() {
    const topKeywords = await this.prisma.searchQuery.groupBy({
      by: ['keyword'],
      _count: {
        keyword: true,
      },
      orderBy: {
        _count: {
          keyword: 'desc',
        },
      },
      take: 3,
    });

    const keywords = topKeywords.map((k) => k.keyword);
    const defaultKeywords = ['meonauan', 'trigian', 'lamvuontainha'];
    for (const def of defaultKeywords) {
      if (keywords.length >= 3) break;
      if (!keywords.includes(def)) {
        keywords.push(def);
      }
    }

    const labelMap: Record<string, string> = {
      meonauan: 'mẹo nấu ăn',
      trigian: 'trị gián',
      lamvuontainha: 'làm vườn',
    };

    const trends: any[] = [];
    for (const kw of keywords) {
      const posts: any[] = await this.prisma.post.findMany({
        where: {
          content: {
            contains: kw,
          },
        },
        select: {
          _count: {
            select: { comments: true },
          },
        },
      });
      const commentsCount = posts.reduce((sum, p) => sum + (p._count?.comments || 0), 0);

      trends.push({
        tag: `#${kw}`,
        label: labelMap[kw] || kw,
        count: `${commentsCount.toLocaleString('vi-VN')} lượt thảo luận`,
      });
    }

    return trends;
  }

  async getActiveContributors() {
    const users = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        isDeleted: false,
      },
      include: {
        posts: {
          include: {
            reactions: true,
            bookmarks: true,
          },
        },
        _count: {
          select: {
            posts: true,
            comments: true,
          },
        },
      },
    });

    const scored = users.map((user) => {
      const postsCount = user._count.posts;
      const commentsCount = user._count.comments;

      let likesReceivedCount = 0;
      let savesReceivedCount = 0;

      for (const post of user.posts) {
        likesReceivedCount += post.reactions.filter((r) => r.type === 'LIKE').length;
        savesReceivedCount += post.bookmarks.length;
      }

      const score = postsCount + commentsCount + likesReceivedCount + savesReceivedCount;

      return {
        id: user.id,
        userName: user.userName,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        postsCount,
        commentsCount,
        likesReceivedCount,
        savesReceivedCount,
        score,
      };
    });

    const topContributors = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((c) => ({
        name: c.fullName,
        avatar: c.avatarUrl,
        postsCount: c.postsCount,
        commentsCount: c.commentsCount,
        likesCount: c.likesReceivedCount,
        savesCount: c.savesReceivedCount,
        score: c.score,
      }));

    return topContributors;
  }
}

