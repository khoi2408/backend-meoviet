import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async getNotifications(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: {
            select: {
              id: true,
              fullName: true,
              userName: true,
            },
          },
        },
      }),
      this.prisma.notification.count({
        where: { userId },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      notifications,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
      },
    };
  }

  async getLatestNotifications(userId: string, limit: number = 20) {
    return this.prisma.notification.findMany({
      where: { userId },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            userName: true,
          },
        },
      },
    });
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
    return { count };
  }

  async markAsRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Thông báo không tồn tại');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền cập nhật thông báo này');
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            userName: true,
          },
        },
      },
    });

    return updated;
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return { success: true };
  }

  async deleteNotification(userId: string, id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Thông báo không tồn tại');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xóa thông báo này');
    }

    await this.prisma.notification.delete({
      where: { id },
    });

    return { success: true };
  }

  async deleteAllNotifications(userId: string) {
    await this.prisma.notification.deleteMany({
      where: { userId },
    });

    return { success: true };
  }

  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    postId?: string,
    commentId?: string,
    senderId?: string,
    metadata?: any,
  ) {
    // Check merging rules: only merge LIKE_POST and LIKE_COMMENT while existing notification is UNREAD
    if (type === NotificationType.LIKE_POST && postId) {
      const existing = await this.prisma.notification.findFirst({
        where: {
          userId,
          type: NotificationType.LIKE_POST,
          postId,
          isRead: false,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existing) {
        // Query current like list for post
        const postReactions = await this.prisma.postReaction.findMany({
          where: { postId, type: 'LIKE' },
          include: { user: true },
          orderBy: { createdAt: 'desc' },
        });

        const totalLikes = postReactions.length;
        if (totalLikes > 0) {
          const latestLiker = postReactions[0].user.fullName;
          const mergedMessage =
            totalLikes === 1
              ? `${latestLiker} đã thích bài viết của bạn.`
              : `${latestLiker} và ${totalLikes - 1} người khác đã thích bài viết của bạn.`;

          const updated = await this.prisma.notification.update({
            where: { id: existing.id },
            data: {
              message: mergedMessage,
              senderId: postReactions[0].userId,
              metadata: { likeCount: totalLikes, ...(metadata || {}) },
              updatedAt: new Date(),
            },
            include: {
              sender: {
                select: { id: true, fullName: true, userName: true },
              },
            },
          });

          this.notificationsGateway.sendNotificationToUser(userId, updated);
          return updated;
        }
      }
    }

    if (type === NotificationType.LIKE_COMMENT && commentId) {
      const existing = await this.prisma.notification.findFirst({
        where: {
          userId,
          type: NotificationType.LIKE_COMMENT,
          commentId,
          isRead: false,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existing) {
        const commentIdInt = parseInt(commentId, 10);
        // Query current like list for comment
        const commentReactions = await this.prisma.commentReaction.findMany({
          where: { commentId: commentIdInt, type: 'LIKE' },
          include: { user: true },
          orderBy: { createdAt: 'desc' },
        });

        const totalLikes = commentReactions.length;
        if (totalLikes > 0) {
          const latestLiker = commentReactions[0].user.fullName;
          const mergedMessage =
            totalLikes === 1
              ? `${latestLiker} đã thích bình luận của bạn.`
              : `${latestLiker} và ${totalLikes - 1} người khác đã thích bình luận của bạn.`;

          const updated = await this.prisma.notification.update({
            where: { id: existing.id },
            data: {
              message: mergedMessage,
              senderId: commentReactions[0].userId,
              metadata: { likeCount: totalLikes, ...(metadata || {}) },
              updatedAt: new Date(),
            },
            include: {
              sender: {
                select: { id: true, fullName: true, userName: true },
              },
            },
          });

          this.notificationsGateway.sendNotificationToUser(userId, updated);
          return updated;
        }
      }
    }

    // Otherwise, create a new notification
    const newNotification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        postId,
        commentId,
        senderId,
        metadata: metadata || null,
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            userName: true,
          },
        },
      },
    });

    this.notificationsGateway.sendNotificationToUser(userId, newNotification);
    return newNotification;
  }
}
