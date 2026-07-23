import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/auth/password.service';
import cookieParser from 'cookie-parser';
import { Role, UserStatus, MediaType } from '@prisma/client';

describe('Posts Management (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;

  let ownerToken: string;
  let otherToken: string;
  let adminToken: string;

  let ownerUser: any;
  let otherUser: any;

  let category1: any;
  let category2: any;

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

    // Clean tables in correct order
    await prisma.categoriesOnPosts.deleteMany({});
    await prisma.hiddenPost.deleteMany({});
    await prisma.postReaction.deleteMany({});
    await prisma.commentReaction.deleteMany({});
    await prisma.comment.deleteMany({});
    await prisma.media.deleteMany({});
    await prisma.post.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.category.deleteMany({});

    const passwordHash = await passwordService.hash('password123');

    // Create users
    ownerUser = await prisma.user.create({
      data: {
        userName: 'post_owner',
        fullName: 'Post Owner',
        password: passwordHash,
        role: Role.USER,
        status: UserStatus.ACTIVE,
      },
    });

    otherUser = await prisma.user.create({
      data: {
        userName: 'post_other',
        fullName: 'Post Other',
        password: passwordHash,
        role: Role.USER,
        status: UserStatus.ACTIVE,
      },
    });

    await prisma.user.create({
      data: {
        userName: 'post_admin',
        fullName: 'Post Admin',
        password: passwordHash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    // Create categories
    category1 = await prisma.category.create({ data: { name: 'Cat1' } });
    category2 = await prisma.category.create({ data: { name: 'Cat2' } });

    // Login users
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ userName: 'post_owner', password: 'password123' })
      .expect(200);
    ownerToken = ownerLogin.body.accessToken;

    const otherLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ userName: 'post_other', password: 'password123' })
      .expect(200);
    otherToken = otherLogin.body.accessToken;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ userName: 'post_admin', password: 'password123' })
      .expect(200);
    adminToken = adminLogin.body.accessToken;
  });

  afterAll(async () => {
    // Clean up
    await prisma.categoriesOnPosts.deleteMany({});
    await prisma.hiddenPost.deleteMany({});
    await prisma.postReaction.deleteMany({});
    await prisma.commentReaction.deleteMany({});
    await prisma.comment.deleteMany({});
    await prisma.media.deleteMany({});
    await prisma.post.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.category.deleteMany({});
    await app.close();
  });

  describe('POST /posts/create (Create Post)', () => {
    it('should allow authenticated users to create a post with categories and media', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/posts/create')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          content: 'Folk tips for cough',
          categoryIds: [category1.id, category2.id],
          medias: [
            { url: 'http://example.com/cough.jpg', type: MediaType.IMAGE },
            { url: 'http://example.com/cough.mp4', type: MediaType.VIDEO },
          ],
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.content).toBe('Folk tips for cough');
      expect(res.body.user.id).toBe(ownerUser.id);
      expect(res.body.categories.length).toBe(2);
      expect(res.body.medias.length).toBe(2);
      expect(res.body.medias[0].url).toBe('http://example.com/cough.jpg');
      expect(res.body.medias[0].type).toBe(MediaType.IMAGE);
    });

    it('should reject creation without content (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/posts/create')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          categoryIds: [category1.id],
        })
        .expect(400);
    });

    it('should reject creation if unauthenticated (401)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/posts/create')
        .send({
          content: 'No auth post',
        })
        .expect(401);
    });
  });

  describe('GET /posts/list (Get Posts)', () => {
    it('should return all posts with pagination metadata, ordered by createdAt DESC', async () => {
      // Create another post
      await request(app.getHttpServer())
        .post('/api/v1/posts/create')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          content: 'Second post content',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/v1/posts/list')
        .expect(200);

      expect(res.body).toHaveProperty('posts');
      expect(res.body.posts).toBeInstanceOf(Array);
      expect(res.body.posts.length).toBe(2);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(10);
      expect(res.body.total).toBe(2);
      expect(res.body.totalPages).toBe(1);
      expect(res.body.hasNextPage).toBe(false);

      // Newest should be first
      expect(res.body.posts[0].content).toBe('Second post content');
      expect(res.body.posts[1].content).toBe('Folk tips for cough');
      expect(res.body.posts[1].user).toHaveProperty('userName');
      expect(res.body.posts[1].categories).toBeInstanceOf(Array);
      expect(res.body.posts[1].medias).toBeInstanceOf(Array);
    });

    it('should search posts by content', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/posts/list?search=cough')
        .expect(200);

      expect(res.body.posts.length).toBe(1);
      expect(res.body.posts[0].content).toBe('Folk tips for cough');
    });

    it('should filter posts by categoryIds', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/posts/list?categoryIds=${category1.id}`)
        .expect(200);

      expect(res.body.posts.length).toBe(1);
      expect(res.body.posts[0].content).toBe('Folk tips for cough');
    });

    it('should support pagination (limit/page)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/posts/list?page=1&limit=1')
        .expect(200);

      expect(res.body.posts.length).toBe(1);
      expect(res.body.posts[0].content).toBe('Second post content');
      expect(res.body.hasNextPage).toBe(true);
    });
  });

  describe('PATCH /posts/update/:id (Update Post)', () => {
    let postId: string;

    beforeAll(async () => {
      const posts = await prisma.post.findMany({
        where: { content: 'Folk tips for cough' },
      });
      postId = posts[0].id;
    });

    it('should allow the owner to update post content, categories, and media', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/posts/update/${postId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          content: 'Folk tips for cough - updated',
          categoryIds: [category1.id],
          medias: [
            { url: 'http://example.com/cough_new.jpg', type: MediaType.IMAGE },
          ],
        })
        .expect(200);

      expect(res.body.content).toBe('Folk tips for cough - updated');
      expect(res.body.categories.length).toBe(1);
      expect(res.body.categories[0].id).toBe(category1.id);
      expect(res.body.medias.length).toBe(1);
      expect(res.body.medias[0].url).toBe('http://example.com/cough_new.jpg');
    });

    it('should forbid other users from updating the post (403)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/posts/update/${postId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ content: 'Hacked content' })
        .expect(403);
    });

    it('should forbid admin from updating the post (403)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/posts/update/${postId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ content: 'Admin update content' })
        .expect(403);
    });

    it('should return 404 for non-existent post ID', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/posts/update/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ content: 'Ghost post' })
        .expect(404);
    });
  });

  describe('POST /posts/hide/:id (Hide Post)', () => {
    let postId: string;

    beforeAll(async () => {
      const posts = await prisma.post.findMany({
        where: { content: 'Second post content' },
      });
      postId = posts[0].id;
    });

    it('should allow user to hide a post', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/posts/hide/${postId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(201);

      expect(res.body.success).toBe(true);

      // Verify db
      const hidden = await prisma.hiddenPost.findUnique({
        where: {
          userId_postId: {
            userId: otherUser.id,
            postId,
          },
        },
      });
      expect(hidden).not.toBeNull();
    });

    it('should return success and not create duplicate if already hidden', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/posts/hide/${postId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(201);

      expect(res.body.success).toBe(true);

      const count = await prisma.hiddenPost.count({
        where: { userId: otherUser.id, postId },
      });
      expect(count).toBe(1);
    });

    it('should return 404 for non-existent post ID', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/posts/hide/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);
    });
  });

  describe('DELETE /posts/delete/:id (Delete Post)', () => {
    let post1Id: string;
    let post2Id: string;

    beforeAll(async () => {
      const posts = await prisma.post.findMany({
        orderBy: { createdAt: 'desc' },
      });
      post1Id = posts[0].id; // Second post content
      post2Id = posts[1].id; // Folk tips for cough - updated
    });

    it('should forbid other users from deleting a post (403)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/posts/delete/${post2Id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('should allow owner to delete their post and cascade delete associated records', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/posts/delete/${post1Id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify post is deleted
      const dbPost = await prisma.post.findUnique({ where: { id: post1Id } });
      expect(dbPost).toBeNull();

      // Verify associated hidden post is cascade deleted
      const hidden = await prisma.hiddenPost.findFirst({
        where: { postId: post1Id },
      });
      expect(hidden).toBeNull();
    });

    it('should allow admin to delete any post', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/posts/delete/${post2Id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      const dbPost = await prisma.post.findUnique({ where: { id: post2Id } });
      expect(dbPost).toBeNull();
    });
  });
});
