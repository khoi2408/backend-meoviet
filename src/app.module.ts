import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { PostsModule } from './posts/posts.module';
import { CommentsModule } from './comments/comments.module';
import { ReactionsModule } from './reactions/reactions.module';
import { BookmarksModule } from './bookmarks/bookmarks.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { MediaModule } from './media/media.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CategoriesModule,
    PostsModule,
    CommentsModule,
    ReactionsModule,
    BookmarksModule,
    NotificationsModule,
    DashboardModule,
    MediaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
