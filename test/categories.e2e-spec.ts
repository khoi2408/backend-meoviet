import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/auth/password.service';
import cookieParser from 'cookie-parser';
import { Role, UserStatus } from '@prisma/client';

describe('Categories Management (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;

  let adminToken: string;
  let userToken: string;

  let normalUser: any;

  let techCategory: any;
  let lifeCategory: any;
  let cookingCategory: any;

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
    await prisma.post.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.category.deleteMany({});

    const passwordHash = await passwordService.hash('password123');

    // Seed users
    await prisma.user.create({
      data: {
        userName: 'admin_cat',
        fullName: 'Cat Admin',
        password: passwordHash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    normalUser = await prisma.user.create({
      data: {
        userName: 'user_cat',
        fullName: 'Cat User',
        password: passwordHash,
        role: Role.USER,
        status: UserStatus.ACTIVE,
      },
    });

    // Seed initial categories
    techCategory = await prisma.category.create({ data: { name: 'Tech' } });
    lifeCategory = await prisma.category.create({ data: { name: 'Life' } });
    cookingCategory = await prisma.category.create({
      data: { name: 'Cooking' },
    });

    // Log in
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ userName: 'admin_cat', password: 'password123' })
      .expect(200);
    adminToken = adminLogin.body.accessToken;

    const userLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ userName: 'user_cat', password: 'password123' })
      .expect(200);
    userToken = userLogin.body.accessToken;
  });

  afterAll(async () => {
    // Clean up
    await prisma.categoriesOnPosts.deleteMany({});
    await prisma.post.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.category.deleteMany({});
    await app.close();
  });

  describe('GET /categories/list', () => {
    it('should return all categories ordered alphabetically by name', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/categories/list')
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(3);
      // Alphabetical order: Cooking -> Life -> Tech
      expect(res.body[0].name).toBe('Cooking');
      expect(res.body[1].name).toBe('Life');
      expect(res.body[2].name).toBe('Tech');
    });
  });

  describe('POST /categories/create', () => {
    it('should allow admin to create a new category', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/categories/create')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Sports' })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Sports');

      // Verify db check
      const cat = await prisma.category.findUnique({
        where: { name: 'Sports' },
      });
      expect(cat).toBeDefined();
    });

    it('should reject creation of duplicate category name (409)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/categories/create')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Tech' })
        .expect(409);
    });

    it('should forbid non-admin users from creating a category (403)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/categories/create')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Music' })
        .expect(403);
    });

    it('should reject empty or invalid name (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/categories/create')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '' })
        .expect(400);
    });
  });

  describe('PATCH /categories/update/:id', () => {
    it('should allow admin to update category name', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/categories/update/${techCategory.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Technology' })
        .expect(200);

      expect(res.body.name).toBe('Technology');

      // Verify DB
      const cat = await prisma.category.findUnique({
        where: { id: techCategory.id },
      });
      expect(cat?.name).toBe('Technology');
    });

    it('should reject update if the name already exists on another category (409)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/categories/update/${lifeCategory.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Cooking' })
        .expect(409);
    });

    it('should allow keeping the same name for current category', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/categories/update/${lifeCategory.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Life' })
        .expect(200);
    });

    it('should forbid non-admin users from updating (403)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/categories/update/${lifeCategory.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Lifestyle' })
        .expect(403);
    });

    it('should return 404 for non-existent category ID', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/categories/update/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Ghost' })
        .expect(404);
    });
  });

  describe('DELETE /categories/delete-many', () => {
    it('should batch delete categories and automatically cascade delete junction references', async () => {
      // 1. Create a Post
      const post = await prisma.post.create({
        data: {
          content: 'This post is about cooking.',
          userId: normalUser.id,
        },
      });

      // 2. Link Post to 'Cooking' Category
      await prisma.categoriesOnPosts.create({
        data: {
          postId: post.id,
          categoryId: cookingCategory.id,
        },
      });

      // 3. Batch Delete Cooking & Life categories
      const res = await request(app.getHttpServer())
        .delete('/api/v1/categories/delete-many')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [cookingCategory.id, lifeCategory.id] })
        .expect(200);

      expect(res.body.success).toBe(true);

      // 4. Verify categories are deleted
      const cats = await prisma.category.findMany({
        where: { id: { in: [cookingCategory.id, lifeCategory.id] } },
      });
      expect(cats.length).toBe(0);

      // 5. Verify the post still exists
      const dbPost = await prisma.post.findUnique({ where: { id: post.id } });
      expect(dbPost).not.toBeNull();

      // 6. Verify junction table record was cascade deleted
      const junction = await prisma.categoriesOnPosts.findUnique({
        where: {
          postId_categoryId: {
            postId: post.id,
            categoryId: cookingCategory.id,
          },
        },
      });
      expect(junction).toBeNull();
    });

    it('should forbid non-admin users from batch deleting (403)', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/categories/delete-many')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ids: [techCategory.id] })
        .expect(403);
    });

    it('should reject invalid validation payload (400)', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/categories/delete-many')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [] })
        .expect(400);
    });
  });
});
