import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MemberPresenceStatus,
  MessageType,
  RoomMemberRole,
  RoomMode,
  RoomPhase,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { serializeRoom } from '../../common/serializers/room.serializer';
import { generateRoomCode } from '../../common/utils/room-code';
import { PrismaService } from '../../prisma/prisma.service';

const HISTORY_RETENTION_DAYS = 14;
const HISTORY_RETENTION_MS = HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async createRoomSession(
    user: AuthenticatedUser,
    dto: {
      topic: string;
      mode?: RoomMode;
      maxMembers?: number;
    },
  ) {
    this.ensureRegisteredAccount(user);

    const topic = dto.topic.trim();
    if (!topic) {
      throw new BadRequestException('Topic is required');
    }

    let code: string;
    let attempts = 0;
    do {
      code = generateRoomCode();
      attempts++;
    } while (
      attempts < 10 &&
      (await this.prisma.room.findUnique({ where: { code } }))
    );
    if (await this.prisma.room.findUnique({ where: { code } })) {
      throw new BadRequestException('Failed to allocate a unique room code');
    }

    const room = await this.prisma.room.create({
      data: {
        code,
        topic,
        mode: dto.mode ?? RoomMode.ONSITE,
        ownerId: user.userId,
        maxMembers: dto.maxMembers ?? 8,
        members: {
          create: {
            userId: user.userId,
            role: RoomMemberRole.OWNER,
            status: MemberPresenceStatus.ACTIVE,
          },
        },
        pet: {
          create: {
            name: 'Buddy',
          },
        },
      },
      include: this.getRoomInclude(),
    });

    return {
      room: serializeRoom(room),
    };
  }

  async joinRoomSession(user: AuthenticatedUser, dto: { code: string }) {
    this.ensureRegisteredAccount(user);

    const code = dto.code.trim().toUpperCase();
    const room = await this.prisma.room.findUnique({
      where: { code },
      include: this.getRoomInclude(),
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.phase === RoomPhase.CLOSED) {
      throw new BadRequestException('Room is closed');
    }

    const existingMembership = await this.prisma.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId: user.userId,
        },
      },
    });

    if (existingMembership?.status === MemberPresenceStatus.ACTIVE) {
      return {
        room: serializeRoom(await this.getRoomEntity(room.id)),
      };
    }

    if (room.members.length >= room.maxMembers) {
      throw new BadRequestException('Room is full');
    }

    if (existingMembership) {
      await this.prisma.roomMember.update({
        where: {
          roomId_userId: {
            roomId: room.id,
            userId: user.userId,
          },
        },
        data: {
          status: MemberPresenceStatus.ACTIVE,
          leftAt: null,
          lastSeenAt: new Date(),
        },
      });
    } else {
      await this.prisma.roomMember.create({
        data: {
          roomId: room.id,
          userId: user.userId,
          role: RoomMemberRole.MEMBER,
          status: MemberPresenceStatus.ACTIVE,
        },
      });
    }

    const refreshedRoom = await this.getRoomEntity(room.id);
    return {
      room: serializeRoom(refreshedRoom),
    };
  }

  async getRoom(roomId: string, userId: string, options?: { allowHistory?: boolean }) {
    if (options?.allowHistory) {
      await this.ensureHistoryAccess(roomId, userId);
    } else {
      await this.ensureMembership(roomId, userId);
    }

    const room = await this.getRoomEntity(roomId);
    return serializeRoom(room);
  }

  async getRoomByCode(code: string, userId: string, options?: { allowHistory?: boolean }) {
    const normalizedCode = code.trim().toUpperCase();
    const room = await this.prisma.room.findUnique({
      where: { code: normalizedCode },
      include: this.getRoomInclude(),
    });
    if (!room) throw new NotFoundException('Room not found');

    if (options?.allowHistory) {
      await this.ensureHistoryAccess(room.id, userId);
    } else {
      await this.ensureMembership(room.id, userId);
    }

    return serializeRoom(room);
  }

  async setPhase(roomId: string, userId: string, phase: RoomPhase) {
    await this.ensureOwner(roomId, userId);

    const room = await this.prisma.room.update({
      where: { id: roomId },
      data: { phase },
      include: this.getRoomInclude(),
    });
    return serializeRoom(room);
  }

  async leaveRoom(userId: string, roomId: string) {
    const membership = await this.ensureMembership(roomId, userId);
    if (membership.role === RoomMemberRole.OWNER) {
      throw new BadRequestException('Room owner must dissolve the room instead of leaving');
    }

    const leftAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.roomMember.update({
        where: { roomId_userId: { roomId, userId } },
        data: {
          status: MemberPresenceStatus.LEFT,
          leftAt,
          lastSeenAt: leftAt,
        },
      });

      await tx.chatMessage.create({
        data: {
          roomId,
          authorId: null,
          type: MessageType.SYSTEM,
          content: `${membership.user.nickname} left the room.`,
        },
      });
    });
    return { ok: true, leftAt };
  }

  async dissolveRoom(roomId: string, userId: string) {
    const membership = await this.ensureOwner(roomId, userId);
    const room = await this.getRoomEntity(roomId);
    const dissolvedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.room.update({
        where: { id: roomId },
        data: { phase: RoomPhase.CLOSED },
      });

      await tx.roomMember.updateMany({
        where: {
          roomId,
          status: {
            not: MemberPresenceStatus.LEFT,
          },
        },
        data: {
          status: MemberPresenceStatus.LEFT,
          leftAt: dissolvedAt,
          lastSeenAt: dissolvedAt,
        },
      });

      await tx.chatMessage.create({
        data: {
          roomId,
          authorId: null,
          type: MessageType.SYSTEM,
          content: `${membership.user.nickname} dissolved the room.`,
        },
      });
    });

    return {
      ok: true,
      roomId: room.id,
      code: room.code,
      topic: room.topic,
      dissolvedAt,
    };
  }

  async heartbeat(roomId: string, userId: string) {
    await this.ensureMembership(roomId, userId);
    await this.prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: {
        status: MemberPresenceStatus.ACTIVE,
        lastSeenAt: new Date(),
      },
    });
    return this.getRoom(roomId, userId);
  }

  async ensureMembership(roomId: string, userId: string) {
    const membership = await this.getMembership(roomId, userId);
    if (!membership || membership.status === MemberPresenceStatus.LEFT) {
      throw new ForbiddenException('You are not an active member of this room');
    }
    return membership;
  }

  async ensureOwner(roomId: string, userId: string) {
    const membership = await this.ensureMembership(roomId, userId);
    if (membership.role !== RoomMemberRole.OWNER) {
      throw new ForbiddenException('Only the room owner can do that');
    }
    return membership;
  }

  async ensureHistoryAccess(roomId: string, userId: string) {
    const membership = await this.getMembership(roomId, userId);
    if (!membership) {
      throw new ForbiddenException('You do not have access to this room history');
    }

    if (membership.status !== MemberPresenceStatus.LEFT) {
      return membership;
    }

    if (!membership.leftAt) {
      throw new ForbiddenException('Room history is unavailable for this membership');
    }

    if (membership.leftAt.getTime() < Date.now() - HISTORY_RETENTION_MS) {
      throw new ForbiddenException(
        `Room history is only available for ${HISTORY_RETENTION_DAYS} days after leaving`,
      );
    }

    return membership;
  }

  private async getMembership(roomId: string, userId: string) {
    return this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
      },
    });
  }

  private async getRoomEntity(roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: this.getRoomInclude(),
    });
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  private getRoomInclude() {
    return {
      members: {
        where: {
          status: {
            not: MemberPresenceStatus.LEFT,
          },
        },
        orderBy: { joinedAt: 'asc' as const },
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
              avatar: true,
            },
          },
        },
      },
      pet: true,
    };
  }

  private ensureRegisteredAccount(user: AuthenticatedUser) {
    if (user.isGuest || !user.account) {
      throw new ForbiddenException('Please log in with a registered account first');
    }
  }
}
