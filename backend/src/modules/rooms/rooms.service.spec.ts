import { BadRequestException } from '@nestjs/common';
import { MemberPresenceStatus, RoomMemberRole, RoomMode, RoomPhase } from '@prisma/client';
import { generateRoomCode } from '../../common/utils/room-code';
import { RoomsService } from './rooms.service';

jest.mock('../../common/utils/room-code', () => ({
  generateRoomCode: jest.fn(),
}));

describe('RoomsService', () => {
  const generateRoomCodeMock = generateRoomCode as jest.MockedFunction<typeof generateRoomCode>;

  const mockPrisma = {
    room: {
      create: jest.fn(),
      update: jest.fn(),
    },
    roomMember: {
      findUnique: jest.fn(),
      count: jest.fn(),
    },
  };

  const registeredUser = {
    userId: 'user-1',
    account: 'alice',
    isGuest: false,
  } as any;
  const mockAccountService = {
    ensureDefaultCompanions: jest.fn(),
  };

  let service: RoomsService;

  beforeEach(() => {
    service = new RoomsService(mockPrisma as any, mockAccountService as any);
    jest.clearAllMocks();
  });

  it('retries room creation when the generated room code collides in the database', async () => {
    generateRoomCodeMock.mockReturnValueOnce('ABC123').mockReturnValueOnce('DEF456');
    mockPrisma.room.create
      .mockRejectedValueOnce({ code: 'P2002' })
      .mockResolvedValueOnce({
        id: 'room-1',
        code: 'DEF456',
        topic: 'Distributed Systems',
        mode: RoomMode.ONSITE,
        phase: RoomPhase.LOBBY,
        maxMembers: 6,
        isPublic: true,
        isLocked: false,
        tags: ['编程'],
        ownerId: registeredUser.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        members: [
          {
            userId: registeredUser.userId,
            role: RoomMemberRole.OWNER,
            status: MemberPresenceStatus.ACTIVE,
            joinedAt: new Date(),
            lastSeenAt: new Date(),
            user: {
              id: registeredUser.userId,
              nickname: 'Alice',
              avatar: null,
            },
          },
        ],
      });

    const result = await service.createRoomSession(registeredUser, {
      topic: 'Distributed Systems',
      maxMembers: 6,
      isPublic: true,
      tags: ['编程', '编程'],
    });

    expect(mockPrisma.room.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.room.create.mock.calls[0][0].data.code).toBe('ABC123');
    expect(mockPrisma.room.create.mock.calls[1][0].data.code).toBe('DEF456');
    expect(mockPrisma.room.create.mock.calls[1][0].data.tags).toEqual(['编程']);
    expect(result.room.code).toBe('DEF456');
  });

  it('rejects invalid maxMembers before writing a room', async () => {
    await expect(
      service.createRoomSession(registeredUser, {
        topic: 'AI Workshop',
        maxMembers: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockPrisma.room.create).not.toHaveBeenCalled();
  });

  it('prevents shrinking maxMembers below the current active member count', async () => {
    mockPrisma.roomMember.findUnique.mockResolvedValue({
      roomId: 'room-1',
      userId: registeredUser.userId,
      role: RoomMemberRole.OWNER,
      status: MemberPresenceStatus.ACTIVE,
      user: {
        id: registeredUser.userId,
        nickname: 'Alice',
        avatar: null,
      },
    });
    mockPrisma.roomMember.count.mockResolvedValue(3);

    await expect(
      service.updateRoom('room-1', registeredUser.userId, {
        maxMembers: 2,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockPrisma.room.update).not.toHaveBeenCalled();
  });
});
