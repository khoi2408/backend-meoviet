import { Test, TestingModule } from '@nestjs/testing';
import { ReactionsService } from './reactions.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ReactionsService', () => {
  let service: ReactionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReactionsService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ReactionsService>(ReactionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
