import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccountService } from '../modules/account/account.service';
import { AiService } from '../modules/ai/ai.service';
import { ChatService } from '../modules/chat/chat.service';

@Injectable()
export class RoomBotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountService: AccountService,
    private readonly aiService: AiService,
    private readonly chatService: ChatService,
  ) {}

  async maybeRespondToMention(roomId: string, senderId: string, content: string) {
    const normalizedContent = content.trim();
    if (!normalizedContent) {
      return null;
    }

    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        topic: true,
        ownerId: true,
        botEnabled: true,
        companionSelections: {
          orderBy: { createdAt: 'asc' },
          select: {
            companionProfile: {
              select: {
                id: true,
                name: true,
                emoji: true,
                description: true,
                styleGuide: true,
                systemPrompt: true,
              },
            },
          },
        },
      },
    });

    const companions = room?.companionSelections.map((selection) => selection.companionProfile) ?? [];
    if (!room?.botEnabled || companions.length === 0) {
      return null;
    }

    const mentionedCompanion = companions.find((companion) =>
      this.containsMention(normalizedContent, companion.name),
    );
    if (!mentionedCompanion) {
      return null;
    }

    const cleanedMessage = this.stripMention(normalizedContent, mentionedCompanion.name);
    const [sender, settings, recentMessages] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: senderId },
        select: { nickname: true },
      }),
      this.accountService.resolveAiSettings(room.ownerId),
      this.prisma.chatMessage.findMany({
        where: { roomId },
        orderBy: { createdAt: 'desc' },
        take: 12,
        include: {
          author: {
            select: {
              nickname: true,
            },
          },
        },
      }),
    ]);

    if (!settings.apiKey.trim()) {
      return this.chatService.createBotMessage(
        roomId,
        `I am ${mentionedCompanion.name}${mentionedCompanion.emoji ?? ''}. The room owner has not configured an AI key yet, so I cannot reply for now.`,
        {
          name: mentionedCompanion.name,
          emoji: mentionedCompanion.emoji ?? undefined,
        },
      );
    }

    const answer = await this.aiService.generateCompanionReply({
      topic: room.topic,
      companion: mentionedCompanion,
      latestMessage: normalizedContent,
      cleanedMessage,
      senderNickname: sender?.nickname ?? 'Room Member',
      provider: settings.provider,
      apiKey: settings.apiKey,
      model: settings.model,
      baseUrl: settings.baseUrl,
      messages: recentMessages
        .reverse()
        .map((message) => ({
          author: message.botName ?? message.author?.nickname ?? 'System',
          content: message.content,
        })),
    });

    return this.chatService.createBotMessage(
      roomId,
      answer.trim() || `@${sender?.nickname ?? 'teammate'}, I am here. Want me to start the discussion?`,
      {
        name: mentionedCompanion.name,
        emoji: mentionedCompanion.emoji ?? undefined,
      },
    );
  }

  private containsMention(content: string, botName: string) {
    return this.getMentionPatterns(botName).some((pattern) => pattern.test(content));
  }

  private stripMention(content: string, botName: string) {
    let result = content;

    for (const pattern of this.getMentionPatterns(botName)) {
      result = result.replace(pattern, '').trim();
    }

    return result.replace(/\s{2,}/g, ' ').trim();
  }

  private getMentionPatterns(botName: string) {
    const escapedName = this.escapeRegExp(botName.trim());
    const escapedCompactName = this.escapeRegExp(botName.replace(/\s+/g, ''));
    const aliases = Array.from(
      new Set(
        [escapedName, escapedCompactName, 'bot', 'BOT', 'pet', 'PET', '宠物', '电子宠物']
          .map((alias) => alias.trim())
          .filter(Boolean),
      ),
    );

    return aliases.map((alias) => new RegExp(`[@＠]\\s*${alias}`, 'gi'));
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

