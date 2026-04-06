import { Injectable, NotFoundException } from '@nestjs/common';
import { MemberPresenceStatus, RoomPhase, MessageType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { serializeRoom } from '../../common/serializers/room.serializer';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listAllRooms() {
    const rooms = await this.prisma.room.findMany({
      include: {
        members: {
          where: { status: { not: MemberPresenceStatus.LEFT } },
          orderBy: { joinedAt: 'asc' },
          include: { user: { select: { id: true, nickname: true, avatar: true } } },
        },
        pet: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return rooms.map((r) => serializeRoom(r));
  }

  async forceDissolveRoom(roomId: string, adminId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');

    const dissolvedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.room.update({
        where: { id: roomId },
        data: { phase: RoomPhase.CLOSED },
      });
      await tx.roomMember.updateMany({
        where: { roomId, status: { not: MemberPresenceStatus.LEFT } },
        data: { status: MemberPresenceStatus.LEFT, leftAt: dissolvedAt, lastSeenAt: dissolvedAt },
      });
      await tx.chatMessage.create({
        data: {
          roomId,
          authorId: null,
          type: MessageType.SYSTEM,
          content: '[Admin] This room was force-dissolved by an administrator.',
        },
      });
    });

    return { ok: true, roomId, code: room.code, topic: room.topic, dissolvedAt };
  }

  async forceDeleteRoom(roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');

    // Cascade delete removes all related records (members, messages, nodes, edges, pet, etc.)
    await this.prisma.room.delete({ where: { id: roomId } });

    return { ok: true, roomId, code: room.code, topic: room.topic };
  }
}
