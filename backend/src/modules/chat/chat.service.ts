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
      include: {
        author: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            personalityType: true,
          },
        },
      },
    });
    return messages.reverse().map((message) => this.serializeMessage(message));
  }

  async createMessage(
    roomId: string,
    authorId: string | null,
    content: string,
    type: MessageType = MessageType.TEXT,
    options?: {
      botName?: string;
      botEmoji?: string;
    },
  ) {
    if (authorId) {
      await this.roomsService.ensureMembership(roomId, authorId);
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        roomId,
        authorId,
        content,
        type,
        botName: options?.botName?.trim() || null,
        botEmoji: options?.botEmoji?.trim() || null,
      },
      include: {
        author: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            personalityType: true,
          },
        },
      },
    });

    return this.serializeMessage(message);
  }

  async createBotMessage(
    roomId: string,
    content: string,
    bot: {
      name: string;
      emoji?: string | null;
    },
  ) {
    return this.createMessage(roomId, null, content, MessageType.TEXT, {
      botName: bot.name,
      botEmoji: bot.emoji ?? undefined,
    });
  }

  private serializeMessage(message: {
    id: string;
    roomId: string;
    authorId: string | null;
    author?: {
      id: string;
      nickname: string;
      avatar?: string | null;
      personalityType?: 'I' | 'E' | null;
    } | null;
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
      nickname: message.botName ?? message.author?.nickname ?? 'System',
      avatar: message.author?.avatar ?? null,
      personalityType: message.author?.personalityType ?? null,
      content: message.content,
      type: message.type,
      botName: message.botName ?? null,
      botEmoji: message.botEmoji ?? null,
      createdAt: message.createdAt,
    };
  }
}
