import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardData(year?: number) {
    const targetYear = year || new Date().getFullYear();

    // 1. Total counts
    const [totalUsers, totalPosts, totalCategories] = await Promise.all([
      this.prisma.user.count({ where: { isDeleted: false } }),
      this.prisma.post.count(),
      this.prisma.category.count(),
    ]);

    // 2. Growth calculation
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [currentMonthNewUsers, previousMonthNewUsers, currentMonthNewPosts, previousMonthNewPosts] = await Promise.all([
      this.prisma.user.count({
        where: { isDeleted: false, createdAt: { gte: startOfCurrentMonth } },
      }),
      this.prisma.user.count({
        where: { isDeleted: false, createdAt: { gte: startOfPreviousMonth, lte: endOfPreviousMonth } },
      }),
      this.prisma.post.count({
        where: { createdAt: { gte: startOfCurrentMonth } },
      }),
      this.prisma.post.count({
        where: { createdAt: { gte: startOfPreviousMonth, lte: endOfPreviousMonth } },
      }),
    ]);

    const userGrowth = previousMonthNewUsers > 0
      ? Number(((currentMonthNewUsers - previousMonthNewUsers) / previousMonthNewUsers * 100).toFixed(1))
      : (currentMonthNewUsers > 0 ? 100.0 : 0.0);

    const postGrowth = previousMonthNewPosts > 0
      ? Number(((currentMonthNewPosts - previousMonthNewPosts) / previousMonthNewPosts * 100).toFixed(1))
      : (currentMonthNewPosts > 0 ? 100.0 : 0.0);

    // 3. Monthly Chart Data
    const startOfYear = new Date(targetYear, 0, 1);
    const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59, 999);

    const [usersInYear, postsInYear, commentsInYear] = await Promise.all([
      this.prisma.user.findMany({
        where: { isDeleted: false, createdAt: { gte: startOfYear, lte: endOfYear } },
        select: { createdAt: true },
      }),
      this.prisma.post.findMany({
        where: { createdAt: { gte: startOfYear, lte: endOfYear } },
        select: { createdAt: true },
      }),
      this.prisma.comment.findMany({
        where: { createdAt: { gte: startOfYear, lte: endOfYear } },
        select: { createdAt: true },
      }),
    ]);

    const usersChart = Array(12).fill(0);
    const postsChart = Array(12).fill(0);
    const commentsChart = Array(12).fill(0);

    for (const u of usersInYear) {
      const m = u.createdAt.getMonth();
      usersChart[m]++;
    }
    for (const p of postsInYear) {
      const m = p.createdAt.getMonth();
      postsChart[m]++;
    }
    for (const c of commentsInYear) {
      const m = c.createdAt.getMonth();
      commentsChart[m]++;
    }

    // 4. Top Bookmarked Posts (Top 5)
    const topPosts = await this.prisma.post.findMany({
      orderBy: {
        bookmarks: {
          _count: 'desc',
        },
      },
      take: 5,
      include: {
        user: {
          select: {
            fullName: true,
            userName: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
        _count: {
          select: {
            bookmarks: true,
          },
        },
      },
    });

    const topBookmarkedPosts = topPosts.map((post) => ({
      id: post.id,
      content: post.content,
      category: post.categories[0]?.category?.name || 'Chưa phân loại',
      author: post.user.fullName,
      saves: post._count.bookmarks,
      publishDate: post.createdAt.toISOString().slice(0, 16).replace('T', ' '),
    }));

    return {
      stats: {
        totalUsers,
        totalPosts,
        totalCategories,
        userGrowth,
        postGrowth,
      },
      charts: {
        users: usersChart,
        posts: postsChart,
        comments: commentsChart,
      },
      topBookmarkedPosts,
    };
  }
}
