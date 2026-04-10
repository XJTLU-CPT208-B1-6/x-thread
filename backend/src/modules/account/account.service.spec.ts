import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AccountService } from './account.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AccountService', () => {
  let service: AccountService;

  const registeredUser = {
    id: 'user-1',
    username: 'alice',
    email: 'alice@example.com',
    nickname: 'Alice',
    realName: null,
    xjtluEmail: null,
    avatar: null,
    isGuest: false,
    isAdmin: false,
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    roomMember: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    userAiSettings: {
      findUnique: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'ACCOUNT_DATA_SECRET') {
        return 'unit-test-secret';
      }

      if (key === 'JWT_SECRET') {
        return 'unit-test-jwt-secret';
      }

      return undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AccountService>(AccountService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAiSettings', () => {
    it('returns an empty apiKey and clears invalid ciphertext', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(registeredUser);
      mockPrismaService.userAiSettings.findUnique.mockResolvedValue({
        userId: registeredUser.id,
        provider: 'deepseek',
        apiKeyEncrypted: 'not-valid-ciphertext',
        model: null,
        baseUrl: null,
      });
      mockPrismaService.userAiSettings.update.mockResolvedValue(undefined);

      const result = await service.getAiSettings(registeredUser.id);

      expect(result).toMatchObject({
        provider: 'deepseek',
        apiKey: '',
        model: 'deepseek-chat',
        baseUrl: '',
      });
      expect(mockPrismaService.userAiSettings.update).toHaveBeenCalledWith({
        where: { userId: registeredUser.id },
        data: { apiKeyEncrypted: null },
      });
    });
  });

  describe('resolveAiSettings', () => {
    it('uses the override apiKey even when stored ciphertext is invalid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(registeredUser);
      mockPrismaService.userAiSettings.findUnique.mockResolvedValue({
        userId: registeredUser.id,
        provider: 'deepseek',
        apiKeyEncrypted: 'broken-value',
        model: 'deepseek-chat',
        baseUrl: null,
      });
      mockPrismaService.userAiSettings.update.mockResolvedValue(undefined);

      const result = await service.resolveAiSettings(registeredUser.id, {
        apiKey: 'fresh-key',
      });

      expect(result).toMatchObject({
        provider: 'deepseek',
        apiKey: 'fresh-key',
        model: 'deepseek-chat',
        baseUrl: '',
      });
      expect(mockPrismaService.userAiSettings.update).toHaveBeenCalledWith({
        where: { userId: registeredUser.id },
        data: { apiKeyEncrypted: null },
      });
    });
  });
});
