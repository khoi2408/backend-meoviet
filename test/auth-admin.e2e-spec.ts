import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PasswordService } from '../src/auth/password.service';
import cookieParser from 'cookie-parser';
import { Role, UserStatus } from '@prisma/client';

describe('Auth & Admin Management (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let passwordService: PasswordService;

  let adminToken: string;
  let userToken: string;

  let adminUser: any;
  let normalUser: any;
  let otherAdminUser: any;
  const paginatedUsers: any[] = [];

  const cleanDatabase = async () => {
    await prisma.commentReaction.deleteMany({});
    await prisma.postReaction.deleteMany({});
    await prisma.comment.deleteMany({});
    await prisma.bookmark.deleteMany({});
    await prisma.hiddenPost.deleteMany({});
    await prisma.categoriesOnPosts.deleteMany({});
    await prisma.media.deleteMany({});
    await prisma.post.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.user.deleteMany({});
  };

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

    // Clean database before seeding
    await cleanDatabase();

    const passwordHash = await passwordService.hash('password123');

    // Create users
    adminUser = await prisma.user.create({
      data: {
        userName: 'admin_test',
        fullName: 'System Admin',
        password: passwordHash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    otherAdminUser = await prisma.user.create({
      data: {
        userName: 'admin_two',
        fullName: 'Second Admin',
        password: passwordHash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    normalUser = await prisma.user.create({
      data: {
        userName: 'user_test',
        fullName: 'Standard User',
        password: passwordHash,
        role: Role.USER,
        status: UserStatus.ACTIVE,
      },
    });

    await prisma.user.create({
      data: {
        userName: 'user_suspended',
        fullName: 'Suspended User',
        password: passwordHash,
        role: Role.USER,
        status: UserStatus.SUSPENDED,
      },
    });

    // Seed more users for pagination / search test
    for (let i = 1; i <= 5; i++) {
      const u = await prisma.user.create({
        data: {
          userName: `paginated_user_${i}`,
          fullName: `Nguyen Van ${String.fromCharCode(65 + i)}`,
          password: passwordHash,
          role: Role.USER,
          status: UserStatus.ACTIVE,
        },
      });
      paginatedUsers.push(u);
    }

    // Log in to get tokens
    const adminLoginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ userName: 'admin_test', password: 'password123' })
      .expect(200);
    adminToken = adminLoginRes.body.accessToken;

    const userLoginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ userName: 'user_test', password: 'password123' })
      .expect(200);
    userToken = userLoginRes.body.accessToken;
  });

  afterAll(async () => {
    // Clean up
    await cleanDatabase();
    await app.close();
  });

  describe('Access Authorization Checks', () => {
    it('should refuse access to admin endpoints for non-admin users (403)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .get(`/api/v1/auth/users/${normalUser.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/api/v1/auth/users/${normalUser.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ fullName: 'Updated Name' })
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/api/v1/auth/users/${normalUser.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should refuse access to authenticated endpoints for guest users (401)', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/users').expect(401);

      await request(app.getHttpServer())
        .patch('/api/v1/auth/change-password')
        .send({
          currentPassword: 'password123',
          newPassword: 'newPassword123',
          confirmPassword: 'newPassword123',
        })
        .expect(401);
    });

    it('should refuse login for suspended users (401)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ userName: 'user_suspended', password: 'password123' })
        .expect(401);
    });
  });

  describe('Change Password Endpoint', () => {
    it('should succeed with valid input', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'newPassword123',
          confirmPassword: 'newPassword123',
        })
        .expect(200);

      // Verify login with new password works
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ userName: 'user_test', password: 'newPassword123' })
        .expect(200);
      userToken = loginRes.body.accessToken; // update token
    });

    it('should fail if currentPassword is wrong', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: 'wrongPassword',
          newPassword: 'anotherPassword123',
          confirmPassword: 'anotherPassword123',
        })
        .expect(400);
    });

    it('should fail if newPassword and confirmPassword do not match', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: 'newPassword123',
          newPassword: 'anotherPassword123',
          confirmPassword: 'mismatchedPassword123',
        })
        .expect(400);
    });

    it('should fail if newPassword is too short (< 8 chars)', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: 'newPassword123',
          newPassword: 'short',
          confirmPassword: 'short',
        })
        .expect(400);
    });
  });

  describe('Admin - User Management Endpoints', () => {
    it('GET /users - should return paginated list of users', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 5 })
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(res.body.data.length).toBeLessThanOrEqual(5);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(5);
      expect(res.body.data[0]).not.toHaveProperty('password');
    });

    it('GET /users - should filter by search term', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ search: 'Nguyen' })
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      res.body.data.forEach((user: any) => {
        expect(user.fullName.toLowerCase()).toContain('nguyen');
      });
    });

    it('GET /users - should filter by role', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ role: Role.ADMIN })
        .expect(200);

      res.body.data.forEach((user: any) => {
        expect(user.role).toBe(Role.ADMIN);
      });
    });

    it('GET /users - should filter by status', async () => {
      // First suspended user is currently omitted from default list if isDeleted, but user_suspended has status=SUSPENDED, isDeleted=false.
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ status: UserStatus.SUSPENDED })
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].userName).toBe('user_suspended');
    });

    it('GET /users/:id - should get detailed user profile', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/auth/users/${normalUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.id).toBe(normalUser.id);
      expect(res.body.userName).toBe(normalUser.userName);
      expect(res.body).not.toHaveProperty('password');
    });

    it('PATCH /users/:id - should update user fullName', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/auth/users/${normalUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ fullName: 'Le Minh Khoi E2E' })
        .expect(200);

      expect(res.body.fullName).toBe('Le Minh Khoi E2E');
    });

    it('PATCH /users/:id - should block update of other fields (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/auth/users/${normalUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: Role.ADMIN }) // not whitelisted in UpdateUserDto
        .expect(400);
    });

    it('DELETE /users/:id - should prevent self-deletion', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/auth/users/${adminUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('DELETE /users/:id - should allow deletion of other admin but block deletion of the last admin', async () => {
      // 1. Delete other admin
      await request(app.getHttpServer())
        .delete(`/api/v1/auth/users/${otherAdminUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // 2. Try to delete the self admin again, still fails
      await request(app.getHttpServer())
        .delete(`/api/v1/auth/users/${adminUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('DELETE /users/:id - should soft delete user successfully and prevent them from logging in', async () => {
      // Delete normal user
      await request(app.getHttpServer())
        .delete(`/api/v1/auth/users/${normalUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Confirm GET /users/:id now throws 404
      await request(app.getHttpServer())
        .get(`/api/v1/auth/users/${normalUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      // Confirm user can no longer log in
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ userName: 'user_test', password: 'newPassword123' })
        .expect(401);
    });
  });
});
