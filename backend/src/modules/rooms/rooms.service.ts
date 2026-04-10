import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompanionKind,
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
import { AccountService } from '../account/account.service';

const HISTORY_RETENTION_DAYS = 14;
const HISTORY_RETENTION_MS = HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_MEMBERS = 8;
const MIN_ROOM_MEMBERS = 1;
const MAX_ROOM_MEMBERS = 50;
const ROOM_CODE_MAX_ATTEMPTS = 10;

@Injectable()
export class RoomsService {
  constructor(
    private prisma: PrismaService,
    private readonly accountService: AccountService,
  ) {}

  async createRoomSession(
    user: AuthenticatedUser,
    dto: {
      topic: string;
      mode?: RoomMode;
      maxMembers?: number;
      isPublic?: boolean;
      tags?: string[];
    },
  ) {
    this.ensureRegisteredAccount(user);

    const topic = dto.topic.trim();
    if (!topic) {
      throw new BadRequestException('Topic is required');
    }

    const maxMembers = this.normalizeMaxMembers(dto.maxMembers);
    const mode = this.normalizeMode(dto.mode);
    const tags = this.normalizeTags(dto.tags);

    for (let attempt = 0; attempt < ROOM_CODE_MAX_ATTEMPTS; attempt++) {
      try {
        const room = await this.prisma.room.create({
          data: {
            code: generateRoomCode(),
            topic,
            mode,
            ownerId: user.userId,
            maxMembers,
            isPublic: dto.isPublic ?? true,
            tags,
            members: {
              create: {
                userId: user.userId,
                role: RoomMemberRole.OWNER,
                status: MemberPresenceStatus.ACTIVE,
              },
            },
          },
          include: this.getRoomInclude(),
        });

        return {
          room: serializeRoom(room),
        };
      } catch (error) {
        if (this.isUniqueConstraintError(error)) {
          continue;
        }

        throw error;
      }
    }

    throw new BadRequestException('Failed to allocate a unique room code');
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
    if (room.isLocked) {
      throw new BadRequestException('Room is locked');
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

  async updateRoom(
    roomId: string,
    userId: string,
    dto: {
      topic?: string;
      tags?: string[];
      maxMembers?: number;
      isLocked?: boolean;
      isPublic?: boolean;
    },
  ) {
    await this.ensureOwner(roomId, userId);

    const data: Record<string, unknown> = {};
    if (dto.topic !== undefined) {
      const topic = dto.topic.trim();
      if (!topic) throw new BadRequestException('Topic cannot be empty');
      data.topic = topic;
    }
    if (dto.tags !== undefined) data.tags = this.normalizeTags(dto.tags);
    if (dto.maxMembers !== undefined) {
      const maxMembers = this.normalizeMaxMembers(dto.maxMembers);
      const activeMemberCount = await this.prisma.roomMember.count({
        where: {
          roomId,
          status: {
            not: MemberPresenceStatus.LEFT,
          },
        },
      });
      if (maxMembers < activeMemberCount) {
        throw new BadRequestException(
          `maxMembers cannot be lower than the current active member count (${activeMemberCount})`,
        );
      }
      data.maxMembers = maxMembers;
    }
    if (dto.isPublic !== undefined) data.isPublic = dto.isPublic;
    if (dto.isLocked !== undefined) data.isLocked = dto.isLocked;

    const room = await this.prisma.room.update({
      where: { id: roomId },
      data,
      include: this.getRoomInclude(),
    });
    return { room: serializeRoom(room) };
  }

  async setCompanionBot(
    roomId: string,
    userId: string,
    dto: {
      enabled?: boolean;
      profileId?: string | null;
      profileIds?: string[];
      activeProfileId?: string | null;
    },
  ) {
    await this.ensureOwner(roomId, userId);
    await this.accountService.ensureDefaultCompanions(userId);

    const roomSnapshot = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        topic: true,
        botEnabled: true,
        botProfileId: true,
      },
    });
    if (!roomSnapshot) {
      throw new NotFoundException('Room not found');
    }

    const requestedIds =
      dto.enabled === false
        ? []
        : Array.from(
            new Set(
              (dto.profileIds?.length ? dto.profileIds : [dto.profileId ?? ''])
                .map((value) => value?.trim())
                .filter((value): value is string => Boolean(value)),
            ),
          );

    if (dto.enabled !== false && requestedIds.length === 0) {
      throw new BadRequestException('At least one companion profile must be selected');
    }

    const selectedBots =
      requestedIds.length > 0
        ? await this.prisma.userCompanionProfile.findMany({
            where: {
              id: { in: requestedIds },
              userId,
            },
            select: {
              id: true,
              kind: true,
              name: true,
              emoji: true,
              description: true,
              styleGuide: true,
              isDefault: true,
            },
          })
        : [];

    if (selectedBots.length !== requestedIds.length) {
      throw new NotFoundException('One or more companion profiles were not found');
    }

    const selectedBotMap = new Map(selectedBots.map((bot) => [bot.id, bot]));
    const orderedSelectedBots = requestedIds
      .map((id) => selectedBotMap.get(id))
      .filter((bot): bot is NonNullable<typeof bot> => Boolean(bot));

    const requestedActiveProfileId = dto.activeProfileId?.trim() || dto.profileId?.trim() || null;
    const nextBotProfileId =
      requestedIds.length === 0
        ? null
        : requestedActiveProfileId && requestedIds.includes(requestedActiveProfileId)
          ? requestedActiveProfileId
          : orderedSelectedBots[0]?.id ?? null;

    const selectedBot =
      nextBotProfileId !== null ? selectedBotMap.get(nextBotProfileId) ?? null : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.roomCompanionSelection.deleteMany({
        where: {
          roomId,
          companionProfileId: {
            notIn: requestedIds.length > 0 ? requestedIds : ['__none__'],
          },
        },
      });

      if (requestedIds.length > 0) {
        await tx.roomCompanionSelection.createMany({
          data: requestedIds.map((companionProfileId) => ({
            roomId,
            companionProfileId,
          })),
          skipDuplicates: true,
        });
      }

      await tx.room.update({
        where: { id: roomId },
        data: {
          botEnabled: requestedIds.length > 0,
          botProfileId: nextBotProfileId,
        },
      });
    });

    const room = await this.getRoomEntity(roomId);

    const shouldAnnounce =
      Boolean(selectedBot) &&
      (!roomSnapshot.botEnabled || roomSnapshot.botProfileId !== nextBotProfileId);

    const announcement =
      shouldAnnounce && selectedBot
        ? this.serializeStoredMessage(
            await this.prisma.chatMessage.create({
              data: {
                roomId,
                authorId: null,
                type: MessageType.TEXT,
                content: this.buildBotAnnouncement(room.topic, selectedBot),
                botName: selectedBot.name,
                botEmoji: selectedBot.emoji,
              },
            }),
          )
        : null;

    return {
      room: serializeRoom(room),
      announcement,
    };
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

  async listLobbyRooms() {
    const rooms = await this.prisma.room.findMany({
      where: {
        isPublic: true,
        phase: { not: RoomPhase.CLOSED },
        // Exclude rooms with no active members (e.g. dissolved before phase was set)
        members: {
          some: {
            status: { not: MemberPresenceStatus.LEFT },
          },
        },
      },
      include: this.getRoomInclude(),
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rooms.map((r) => serializeRoom(r));
  }

  async toggleLock(roomId: string, userId: string) {
    await this.ensureOwner(roomId, userId);
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    const updated = await this.prisma.room.update({
      where: { id: roomId },
      data: { isLocked: !room.isLocked },
      include: this.getRoomInclude(),
    });
    return { room: serializeRoom(updated) };
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
            personalityType: true,
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
      botProfile: {
        select: {
          id: true,
          kind: true,
          name: true,
          emoji: true,
          description: true,
          styleGuide: true,
          isDefault: true,
        },
      },
      companionSelections: {
        orderBy: { createdAt: 'asc' as const },
        select: {
          companionProfile: {
            select: {
              id: true,
              kind: true,
              name: true,
              emoji: true,
              description: true,
              styleGuide: true,
              isDefault: true,
            },
          },
        },
      },
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
              personalityType: true,
            },
          },
        },
      },
    };
  }

  private ensureRegisteredAccount(user: AuthenticatedUser) {
    if (user.isGuest || !user.account) {
      throw new ForbiddenException('Please log in with a registered account first');
    }
  }

  private normalizeMaxMembers(value?: number) {
    const maxMembers = value ?? DEFAULT_MAX_MEMBERS;
    if (!Number.isInteger(maxMembers) || maxMembers < MIN_ROOM_MEMBERS || maxMembers > MAX_ROOM_MEMBERS) {
      throw new BadRequestException(
        `maxMembers must be an integer between ${MIN_ROOM_MEMBERS} and ${MAX_ROOM_MEMBERS}`,
      );
    }

    return maxMembers;
  }

  private normalizeMode(mode?: RoomMode) {
    if (!mode) {
      return RoomMode.ONSITE;
    }

    if (!Object.values(RoomMode).includes(mode)) {
      throw new BadRequestException('Invalid room mode');
    }

    return mode;
  }

  private normalizeTags(tags?: string[]) {
    if (tags === undefined) {
      return [];
    }

    if (!Array.isArray(tags)) {
      throw new BadRequestException('tags must be an array of strings');
    }

    return Array.from(new Set(tags.map((tag) => `${tag}`.trim()).filter(Boolean)));
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }

  private buildBotAnnouncement(
    topic: string,
    bot: {
      name: string;
      emoji: string;
      description: string;
      styleGuide: string;
    },
  ) {
    return `大家好，我是 ${bot.name}${bot.emoji}。接下来我会用「${bot.styleGuide}」的方式陪你们聊「${topic}」，想找我时直接 @${bot.name} 就行。`;
  }

  private serializeStoredMessage(message: {
    id: string;
    roomId: string;
    authorId: string | null;
    content: string;
    type: MessageType;
    botName?: string | null;
    botEmoji?: string | null;
    createdAt: Date;
  }) {
    return {
      id: message.id,
      roomId: message.roomId,
      authorId: message.authorId,
      nickname: message.botName ?? 'System',
      avatar: null,
      content: message.content,
      type: message.type,
      botName: message.botName ?? null,
      botEmoji: message.botEmoji ?? null,
      createdAt: message.createdAt,
    };
  }
}
