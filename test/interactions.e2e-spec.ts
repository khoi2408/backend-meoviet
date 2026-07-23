import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/auth/password.service';
import cookieParser from 'cookie-parser';
import { Role, UserStatus, MediaType, ReactionType } from '@prisma/client';

describe('Interactions (Comments, Reactions, Bookmarks) (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;

  let ownerToken: string;
  let otherToken: string;
  let adminToken: string;

  let ownerUser: any;
  let otherUser: any;

  let postId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    prisma = app.get(PrismaService);
    passwordService = app.get(PasswordService);

    // Clean tables
    await prisma.commentReaction.deleteMany({});
    await prisma.postReaction.deleteMany({});
    await prisma.bookmark.deleteMany({});
    await prisma.comment.deleteMany({});
    await prisma.media.deleteMany({});
    await prisma.post.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({});

    const passwordHash = await passwordService.hash('password123');

    // Create users
    ownerUser = await prisma.user.create({
      data: {
        userName: 'owner_interact',
        fullName: 'Interact Owner',
        password: passwordHash,
        role: Role.USER,
        status: UserStatus.ACTIVE,
      },
    });

    otherUser = await prisma.user.create({
      data: {
        userName: 'other_interact',
        fullName: 'Interact Other',
        password: passwordHash,
        role: Role.USER,
        status: UserStatus.ACTIVE,
      },
    });

    await prisma.user.create({
      data: {
        userName: 'admin_interact',
        fullName: 'Interact Admin',
        password: passwordHash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    // Login users
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ userName: 'owner_interact', password: 'password123' })
      .expect(200);
    ownerToken = ownerLogin.body.accessToken;

    const otherLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ userName: 'other_interact', password: 'password123' })
      .expect(200);
    otherToken = otherLogin.body.accessToken;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ userName: 'admin_interact', password: 'password123' })
      .expect(200);
    adminToken = adminLogin.body.accessToken;

    // Create a Post
    const post = await prisma.post.create({
      data: {
        content: 'Folk tips about ginger water',
        userId: ownerUser.id,
      },
    });
    postId = post.id;
  });

  afterAll(async () => {
    // Clean up
    await prisma.commentReaction.deleteMany({});
    await prisma.postReaction.deleteMany({});
    await prisma.bookmark.deleteMany({});
    await prisma.comment.deleteMany({});
    await prisma.media.deleteMany({});
    await prisma.post.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({});
    await app.close();
  });

  describe('Comment APIs', () => {
    let rootCommentId: number;
    let replyCommentId: number;

    it('should create a root comment (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/comments/create')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          postId,
          content: 'This ginger tip works wonders!',
          medias: [
            { url: 'http://example.com/ginger.jpg', type: MediaType.IMAGE },
          ],
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.content).toBe('This ginger tip works wonders!');
      expect(res.body.user.id).toBe(otherUser.id);
      expect(res.body.medias.length).toBe(1);
      rootCommentId = res.body.id;
    });

    it('should fail to create a comment with more than 1 media (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/comments/create')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          postId,
          content: 'Too many medias',
          medias: [
            { url: 'http://example.com/ginger1.jpg', type: MediaType.IMAGE },
            { url: 'http://example.com/ginger2.jpg', type: MediaType.IMAGE },
          ],
        })
        .expect(400);
    });

    it('should create a nested reply (201)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/comments/reply/${rootCommentId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          content: 'Thanks for testing it out!',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.parentId).toBe(rootCommentId);
      expect(res.body.user.id).toBe(ownerUser.id);
      replyCommentId = res.body.id;
    });

    it('should return nested comment tree publicly (200)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/comments/list?postId=${postId}`)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(1); // Only root comment at top level
      expect(res.body[0].id).toBe(rootCommentId);
      expect(res.body[0].replies.length).toBe(1);
      expect(res.body[0].replies[0].id).toBe(replyCommentId);
    });

    it('should allow owner to update comment content and media (200)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/comments/update/${rootCommentId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          content: 'This ginger tip works wonders! (Updated)',
          medias: [],
        })
        .expect(200);

      expect(res.body.content).toBe('This ginger tip works wonders! (Updated)');
      expect(res.body.medias.length).toBe(0);
    });

    it('should forbid non-owner from updating comment (403)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/comments/update/${rootCommentId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ content: 'Malicious edit' })
        .expect(403);
    });

    it('should forbid non-owner from deleting comment (403)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/comments/delete/${rootCommentId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(403);
    });

    it('should allow admin or owner to delete comment recursively (200)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/comments/delete/${rootCommentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify parent and child are deleted
      const parent = await prisma.comment.findUnique({
        where: { id: rootCommentId },
      });
      const child = await prisma.comment.findUnique({
        where: { id: replyCommentId },
      });
      expect(parent).toBeNull();
      expect(child).toBeNull();
    });
  });

  describe('Post Reaction APIs', () => {
    it('should toggle Like on a post', async () => {
      // 1. Create Like
      let res = await request(app.getHttpServer())
        .post(`/api/v1/posts/${postId}/like`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);
      expect(res.body.action).toBe('created');
      expect(res.body.type).toBe(ReactionType.LIKE);

      // 2. Remove Like by liking again (Toggle Off)
      res = await request(app.getHttpServer())
        .post(`/api/v1/posts/${postId}/like`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);
      expect(res.body.action).toBe('removed');
      expect(res.body.type).toBeNull();

      // 3. Create Like again
      await request(app.getHttpServer())
        .post(`/api/v1/posts/${postId}/like`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);

      // 4. Switch from Like to Dislike
      res = await request(app.getHttpServer())
        .post(`/api/v1/posts/${postId}/dislike`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);
      expect(res.body.action).toBe('updated');
      expect(res.body.type).toBe(ReactionType.DISLIKE);

      // 5. Delete Reaction
      res = await request(app.getHttpServer())
        .delete(`/api/v1/posts/${postId}/reaction`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);
      expect(res.body.action).toBe('removed');
    });
  });

  describe('Comment Reaction APIs', () => {
    let commentId: number;

    beforeAll(async () => {
      const comment = await prisma.comment.create({
        data: {
          content: 'Reaction testing comment',
          postId,
          userId: ownerUser.id,
        },
      });
      commentId = comment.id;
    });

    it('should toggle Like/Dislike on a comment', async () => {
      // 1. Create Like
      let res = await request(app.getHttpServer())
        .post(`/api/v1/comments/${commentId}/like`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);
      expect(res.body.action).toBe('created');
      expect(res.body.type).toBe(ReactionType.LIKE);

      // 2. Toggle Off Like
      res = await request(app.getHttpServer())
        .post(`/api/v1/comments/${commentId}/like`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);
      expect(res.body.action).toBe('removed');

      // 3. Delete reaction
      res = await request(app.getHttpServer())
        .delete(`/api/v1/comments/${commentId}/reaction`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);
      expect(res.body.action).toBe('removed');
    });
  });

  describe('Bookmark APIs', () => {
    it('should bookmark a post', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/posts/${postId}/bookmark`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(201);
      expect(res.body.success).toBe(true);
    });

    it('should not throw error when bookmarking again', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/posts/${postId}/bookmark`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(201);
      expect(res.body.success).toBe(true);
    });

    it('should list all bookmarks of current user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me/bookmarks')
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(1);
      expect(res.body[0].id).toBe(postId);
      expect(res.body[0].post.content).toBe('Folk tips about ginger water');
    });

    it('should remove a bookmark', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/posts/${postId}/bookmark`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);
      expect(res.body.success).toBe(true);

      // Verify list is empty
      const list = await request(app.getHttpServer())
        .get('/api/v1/users/me/bookmarks')
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);
      expect(list.body.length).toBe(0);
    });
  });
});
