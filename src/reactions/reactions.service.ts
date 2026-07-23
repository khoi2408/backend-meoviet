import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReactionType, NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async triggerPostLikeNotification(userId: string, post: any, postId: string) {
    if (post.userId === userId) return;
    try {
      const sender = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (sender) {
        await this.notificationsService.createNotification(
          post.userId,
          NotificationType.LIKE_POST,
          'Lượt thích mới',
          `${sender.fullName} đã thích bài viết của bạn.`,
          postId,
          undefined,
          userId,
        );
      }
    } catch (err: any) {
      console.error('Error triggering post like notification:', err?.message || err);
    }
  }

  async reactToPost(userId: string, postId: string, type: ReactionType) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });
    if (!post) {
      throw new NotFoundException('Bài viết không tồn tại');
    }

    const existing = await this.prisma.postReaction.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    if (existing) {
      if (existing.type === type) {
        await this.prisma.postReaction.delete({
          where: {
            userId_postId: {
              userId,
              postId,
            },
          },
        });
        return { success: true, action: 'removed', type: null };
      } else {
        const updated = await this.prisma.postReaction.update({
          where: {
            userId_postId: {
              userId,
              postId,
            },
          },
          data: { type },
        });
        if (type === 'LIKE') {
          await this.triggerPostLikeNotification(userId, post, postId);
        }
        return { success: true, action: 'updated', type: updated.type };
      }
    } else {
      const created = await this.prisma.postReaction.create({
        data: {
          userId,
          postId,
          type,
        },
      });
      if (type === 'LIKE') {
        await this.triggerPostLikeNotification(userId, post, postId);
      }
      return { success: true, action: 'created', type: created.type };
    }
  }

  async deletePostReaction(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });
    if (!post) {
      throw new NotFoundException('Bài viết không tồn tại');
    }

    const existing = await this.prisma.postReaction.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    if (existing) {
      await this.prisma.postReaction.delete({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
      });
    }

    return { success: true, action: 'removed', type: null };
  }

  private async triggerCommentLikeNotification(userId: string, comment: any, commentId: number) {
    if (comment.userId === userId) return;
    try {
      const sender = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (sender) {
        await this.notificationsService.createNotification(
          comment.userId,
          NotificationType.LIKE_COMMENT,
          'Lượt thích mới',
          `${sender.fullName} đã thích bình luận của bạn.`,
          comment.postId,
          commentId.toString(),
          userId,
        );
      }
    } catch (err: any) {
      console.error('Error triggering comment like notification:', err?.message || err);
    }
  }

  async reactToComment(userId: string, commentId: number, type: ReactionType) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) {
      throw new NotFoundException('Bình luận không tồn tại');
    }

    const existing = await this.prisma.commentReaction.findUnique({
      where: {
        userId_commentId: {
          userId,
          commentId,
        },
      },
    });

    if (existing) {
      if (existing.type === type) {
        await this.prisma.commentReaction.delete({
          where: {
            userId_commentId: {
              userId,
              commentId,
            },
          },
        });
        return { success: true, action: 'removed', type: null };
      } else {
        const updated = await this.prisma.commentReaction.update({
          where: {
            userId_commentId: {
              userId,
              commentId,
            },
          },
          data: { type },
        });
        if (type === 'LIKE') {
          await this.triggerCommentLikeNotification(userId, comment, commentId);
        }
        return { success: true, action: 'updated', type: updated.type };
      }
    } else {
      const created = await this.prisma.commentReaction.create({
        data: {
          userId,
          commentId,
          type,
        },
      });
      if (type === 'LIKE') {
        await this.triggerCommentLikeNotification(userId, comment, commentId);
      }
      return { success: true, action: 'created', type: created.type };
    }
  }

  async deleteCommentReaction(userId: string, commentId: number) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) {
      throw new NotFoundException('Bình luận không tồn tại');
    }

    const existing = await this.prisma.commentReaction.findUnique({
      where: {
        userId_commentId: {
          userId,
          commentId,
        },
      },
    });

    if (existing) {
      await this.prisma.commentReaction.delete({
        where: {
          userId_commentId: {
            userId,
            commentId,
          },
        },
      });
    }

    return { success: true, action: 'removed', type: null };
  }
}
