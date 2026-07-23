import { Test, TestingModule } from '@nestjs/testing';
import { BookmarksService } from './bookmarks.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BookmarksService', () => {
  let service: BookmarksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookmarksService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<BookmarksService>(BookmarksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
