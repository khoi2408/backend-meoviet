import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto, UpdateCommentDto, ReplyCommentDto } from './dto/comment.dto';
import { Role, MediaType, NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { MediaService } from '../media/media.service';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly mediaService: MediaService,
  ) {}

  async getCommentsForPost(postId: string, currentUserId?: string) {
    // 1. Verify post exists
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });
    if (!post) {
      throw new NotFoundException('Bài viết không tồn tại');
    }

    // 2. Fetch all comments for the post
    const comments = await this.prisma.comment.findMany({
      where: { postId },
      include: {
        user: {
          select: {
            id: true,
            userName: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        reactions: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // 3. Map comments to formatted nodes
    const formatted = comments.map((comment) => {
      const likes = comment.reactions.filter((r) => r.type === 'LIKE').length;
      const dislikes = comment.reactions.filter(
        (r) => r.type === 'DISLIKE',
      ).length;
      const myReaction = currentUserId
        ? comment.reactions.find((r) => r.userId === currentUserId)?.type ||
          null
        : null;

      const medias: any[] = [];
      if (comment.mediaUrl && comment.mediaType) {
        medias.push({
          url: comment.mediaUrl,
          type: comment.mediaType,
        });
      }

      return {
        id: comment.id,
        content: comment.content,
        userId: comment.userId,
        authorId: comment.userId, // keep API backward compatibility
        postId: comment.postId,
        parentId: comment.parentId,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        user: comment.user,
        author: comment.user, // keep API backward compatibility
        mediaUrl: comment.mediaUrl,
        mediaType: comment.mediaType,
        medias: medias, // keep API backward compatibility
        reactionCounts: { likes, dislikes },
        myReaction,
        reactions: comment.reactions,
        replies: [] as any[],
      };
    });

    // 4. Build nested hierarchy tree
    const map = new Map<number, (typeof formatted)[0]>();
    const rootComments: typeof formatted = [];

    for (const node of formatted) {
      map.set(node.id, node);
    }

    for (const node of formatted) {
      if (node.parentId === null || node.parentId === undefined) {
        rootComments.push(node);
      } else {
        const parentNode = map.get(node.parentId);
        if (parentNode) {
          parentNode.replies.push(node);
        } else {
          // If parent is missing, treat as root comment
          rootComments.push(node);
        }
      }
    }

    return rootComments;
  }

  async createComment(userId: string, postId: string, dto: CreateCommentDto) {
    // 1. Verify post exists
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });
    if (!post) {
      throw new NotFoundException('Bài viết không tồn tại');
    }

    // 2. Verify parent comment if parentId is provided
    if (dto.parentId) {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
      });
      if (!parentComment) {
        throw new NotFoundException('Bình luận cha không tồn tại');
      }
      if (parentComment.postId !== postId) {
        throw new BadRequestException('Bình luận cha phải thuộc cùng bài viết');
      }
    }

    // Validate media constraint: at most 1 media total from either medias or direct fields
    let mediaUrl: string | null = dto.mediaUrl || null;
    let mediaType: MediaType | null = dto.mediaType || null;

    if (dto.medias && dto.medias.length > 0) {
      if (dto.medias.length > 1) {
        throw new BadRequestException(
          'Bình luận chỉ được phép đính kèm tối đa 1 media',
        );
      }
      if (mediaUrl) {
        throw new BadRequestException(
          'Chỉ được cung cấp media qua danh sách hoặc qua trường trực tiếp, không được dùng cả hai',
        );
      }
      mediaUrl = dto.medias[0].url;
      mediaType = dto.medias[0].type;
    }

    if ((mediaUrl && !mediaType) || (!mediaUrl && mediaType)) {
      throw new BadRequestException(
        'Phải cung cấp cả URL và loại media hoặc không cung cấp cả hai',
      );
    }

    // 3. Create atomically in transaction
    const newComment = await this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          content: dto.content,
          userId: userId,
          postId,
          parentId: dto.parentId || null,
          mediaUrl,
          mediaType,
        },
      });

      return tx.comment.findUnique({
        where: { id: comment.id },
        include: {
          user: {
            select: {
              id: true,
              userName: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
      });
    });

    if (!newComment) {
      throw new NotFoundException('Không tìm thấy bình luận vừa tạo');
    }

    try {
      if (dto.parentId) {
        const parentComment = await this.prisma.comment.findUnique({
          where: { id: dto.parentId },
        });
        if (parentComment && parentComment.userId !== userId) {
          await this.notificationsService.createNotification(
            parentComment.userId,
            NotificationType.REPLY_COMMENT,
            'Phản hồi mới',
            `${newComment.user.fullName} đã trả lời bình luận của bạn.`,
            postId,
            newComment.id.toString(),
            userId,
          );
        }
      } else {
        if (post && post.userId !== userId) {
          await this.notificationsService.createNotification(
            post.userId,
            NotificationType.COMMENT_POST,
            'Bình luận mới',
            `${newComment.user.fullName} đã bình luận về bài viết của bạn.`,
            postId,
            newComment.id.toString(),
            userId,
          );
        }
      }
    } catch (err: any) {
      console.error('Error creating comment/reply notification:', err?.message || err);
    }

    const medias: any[] = [];
    if (newComment.mediaUrl && newComment.mediaType) {
      medias.push({
        url: newComment.mediaUrl,
        type: newComment.mediaType,
      });
    }

    return {
      ...newComment,
      medias,
      reactions: [],
      author: newComment.user, // for backward compatibility
      authorId: newComment.userId, // for backward compatibility
    };
  }

  async replyToComment(userId: string, parentId: number, dto: ReplyCommentDto) {
    const parentComment = await this.prisma.comment.findUnique({
      where: { id: parentId },
    });
    if (!parentComment) {
      throw new NotFoundException('Bình luận cha không tồn tại');
    }

    const createCommentDto: CreateCommentDto = {
      postId: parentComment.postId,
      parentId: parentId,
      content: dto.content,
      mediaUrl: dto.mediaUrl,
      mediaType: dto.mediaType,
      medias: dto.medias,
    };

    return this.createComment(userId, parentComment.postId, createCommentDto);
  }

  async updateComment(userId: string, id: number, dto: UpdateCommentDto) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException('Bình luận không tồn tại');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền chỉnh sửa bình luận này',
      );
    }

    // Determine updated media
    let mediaUrl: string | null = comment.mediaUrl;
    let mediaType: MediaType | null = comment.mediaType;

    if (dto.medias !== undefined) {
      if (dto.medias.length === 0) {
        mediaUrl = null;
        mediaType = null;
      } else {
        if (dto.medias.length > 1) {
          throw new BadRequestException(
            'Bình luận chỉ được phép đính kèm tối đa 1 media',
          );
        }
        mediaUrl = dto.medias[0].url;
        mediaType = dto.medias[0].type;
      }
    } else {
      if (dto.mediaUrl !== undefined) {
        mediaUrl = dto.mediaUrl || null;
      }
      if (dto.mediaType !== undefined) {
        mediaType = dto.mediaType || null;
      }
    }

    if ((mediaUrl && !mediaType) || (!mediaUrl && mediaType)) {
      throw new BadRequestException(
        'Phải cung cấp cả URL và loại media hoặc không cung cấp cả hai',
      );
    }

    // Delete old physical file if mediaUrl has changed or been removed
    if (comment.mediaUrl && comment.mediaUrl !== mediaUrl) {
      await this.mediaService.deleteFile(comment.mediaUrl).catch((err) => {
        console.error('Failed to delete comment media file:', err);
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Update content
      const dataToUpdate: any = {};
      if (dto.content !== undefined) {
        dataToUpdate.content = dto.content;
      }
      dataToUpdate.mediaUrl = mediaUrl;
      dataToUpdate.mediaType = mediaType;

      await tx.comment.update({
        where: { id },
        data: dataToUpdate,
      });

      return tx.comment.findUnique({
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
          reactions: true,
        },
      });
    });

    if (!updated) {
      throw new NotFoundException('Không tìm thấy bình luận vừa cập nhật');
    }

    const medias: any[] = [];
    if (updated.mediaUrl && updated.mediaType) {
      medias.push({
        url: updated.mediaUrl,
        type: updated.mediaType,
      });
    }

    return {
      ...updated,
      medias,
      reactions: updated.reactions,
      author: updated.user, // for backward compatibility
      authorId: updated.userId, // for backward compatibility
    };
  }

  async deleteComment(userId: string, userRole: Role, id: number) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException('Bình luận không tồn tại');
    }

    if (comment.userId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('Bạn không có quyền xóa bình luận này');
    }

    if (comment.userId !== userId && userRole === Role.ADMIN) {
      try {
        await this.notificationsService.createNotification(
          comment.userId,
          NotificationType.ADMIN_DELETE_COMMENT,
          'Bình luận bị gỡ bỏ',
          'Bình luận của bạn đã bị gỡ bỏ bởi quản trị viên.',
          comment.postId,
          id.toString(),
          userId,
        );
      } catch (err: any) {
        console.error('Error creating admin comment deletion notification:', err?.message || err);
      }
    }

    // Delete physical file if exists
    if (comment.mediaUrl) {
      await this.mediaService.deleteFile(comment.mediaUrl).catch((err) => {
        console.error('Failed to delete comment media file:', err);
      });
    }

    await this.prisma.comment.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Xóa bình luận thành công',
    };
  }
}
