import { Injectable } from '@nestjs/common';
import { MessageType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RoomsService } from '../rooms/rooms.service';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private roomsService: RoomsService,
  ) {}

  async getMessages(
    roomId: string,
    userId: string,
    options?: {
      take?: number;
      query?: string;
      from?: Date;
      to?: Date;
      allowHistory?: boolean;
    },
  ) {
    if (options?.allowHistory) {
      await this.roomsService.ensureHistoryAccess(roomId, userId);
    } else {
      await this.roomsService.ensureMembership(roomId, userId);
    }

    const take = options?.take ?? 50;
    const query = options?.query?.trim();
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        roomId,
        ...(query
          ? {
              content: {
                contains: query,
                mode: 'insensitive' as const,
              },
            }
          : {}),
        ...(options?.from || options?.to
          ? {
              createdAt: {
                ...(options.from ? { gte: options.from } : {}),
                ...(options.to ? { lte: options.to } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: { author: { select: { id: true, nickname: true, avatar: true } } },
    });
    return messages.reverse().map((message) => this.serializeMessage(message));
  }

  async createMessage(
    roomId: string,
    authorId: string | null,
    content: string,
    type: MessageType = MessageType.TEXT,
  ) {
    if (authorId) {
      await this.roomsService.ensureMembership(roomId, authorId);
    }

    const message = await this.prisma.chatMessage.create({
      data: { roomId, authorId, content, type },
      include: { author: { select: { id: true, nickname: true, avatar: true } } },
    });

    return this.serializeMessage(message);
  }

  private serializeMessage(message: {
    id: string;
    roomId: string;
    authorId: string | null;
    author?: { id: string; nickname: string; avatar?: string | null } | null;
    content: string;
    type: MessageType;
    createdAt: Date;
  }) {
    return {
      id: message.id,
      roomId: message.roomId,
      authorId: message.authorId,
      nickname: message.author?.nickname ?? 'System',
      avatar: message.author?.avatar ?? null,
      content: message.content,
      type: message.type,
      createdAt: message.createdAt,
    };
  }
}
