import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AccountService } from '../account/account.service';
import { ChatService } from '../chat/chat.service';
import { RoomsService } from '../rooms/rooms.service';
import { SharedFilesService } from '../shared-files/shared-files.service';
import {
  AiService,
  MindMapGenerationStructure,
  MindMapGenerationStyle,
} from './ai.service';
import type { AiProvider } from './ai-provider.config';

type AiChatHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AiSelectedFile = {
  id: string;
  filename: string;
  mimeType?: string;
};

type AiSettingsOverride = {
  provider?: AiProvider;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
};

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly roomsService: RoomsService,
    private readonly chatService: ChatService,
    private readonly sharedFilesService: SharedFilesService,
    private readonly accountService: AccountService,
  ) {}

  @Post('extract-concepts')
  extractConcepts(@Body() dto: { text: string }) {
    return this.aiService.extractConcepts(dto.text);
  }

  @Post('summary')
  generateSummary(@Body() dto: { messages: Array<{ author: string; content: string }> }) {
    return this.aiService.generateSummary(dto.messages);
  }

  @Post('icebreaker')
  generateIcebreaker(@Body() dto: { topic: string }) {
    return this.aiService.generateIcebreaker(dto.topic);
  }

  @Post('test-connection')
  testConnection(
    @Body()
    dto: AiSettingsOverride,
  ) {
    return this.aiService.testConnection(dto);
  }

  @Post('models')
  fetchModels(
    @Body()
    dto: {
      provider?: AiProvider;
      apiKey?: string;
      baseUrl?: string;
    },
  ) {
    return this.aiService.fetchModels(dto);
  }

  @Post('rooms/:roomId/qa')
  async answerRoomQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
    @Body()
    dto: {
      message?: string;
      question?: string;
      history?: AiChatHistoryMessage[];
      selectedFiles?: AiSelectedFile[];
    } & AiSettingsOverride,
  ) {
    const room = await this.roomsService.getRoom(roomId, user.userId);
    const messages = await this.chatService.getMessages(roomId, user.userId, {
      take: 12,
    });
    const fileTree = await this.sharedFilesService.listFiles(roomId, user.userId);
    const settings = await this.accountService.resolveAiSettings(user.userId, {
      provider: dto.provider,
      apiKey: dto.apiKey,
      model: dto.model,
      baseUrl: dto.baseUrl,
    });

    const answer = await this.aiService.answerRoomQuestion({
      topic: room.topic,
      message: dto.message ?? dto.question ?? '',
      history: dto.history ?? [],
      selectedFiles: dto.selectedFiles ?? [],
      provider: settings.provider,
      apiKey: settings.apiKey,
      model: settings.model,
      baseUrl: settings.baseUrl,
      messages: messages.map((message) => ({
        author: message.nickname ?? 'Unknown',
        content: message.content,
      })),
      sharedFiles: fileTree.files.map((file) => file.filename),
    });

    return { answer };
  }

  @Post('rooms/:roomId/generate-mindmap')
  async generateMindMap(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
    @Body()
    dto: {
      includeChatHistory?: boolean;
      selectedFiles?: AiSelectedFile[];
      style?: MindMapGenerationStyle;
      structure?: MindMapGenerationStructure;
    } & AiSettingsOverride,
  ) {
    await this.roomsService.ensureOwner(roomId, user.userId);
    const room = await this.roomsService.getRoom(roomId, user.userId);
    const includeChatHistory = dto.includeChatHistory !== false;
    const messages = includeChatHistory
      ? await this.chatService.getMessages(roomId, user.userId, {
          take: 20,
        })
      : [];
    const referenceFiles = await this.resolveSelectedFileContext(
      roomId,
      user.userId,
      dto.selectedFiles,
    );
    const settings = await this.accountService.resolveAiSettings(user.userId, {
      provider: dto.provider,
      apiKey: dto.apiKey,
      model: dto.model,
      baseUrl: dto.baseUrl,
    });

    return this.aiService.generateMindMap(
      room.topic,
      messages.map((m) => ({ author: m.nickname ?? 'Unknown', content: m.content })),
      settings,
      referenceFiles,
      {
        style: dto.style,
        structure: dto.structure,
      },
    );
  }

  @Post('rooms/:roomId/expand-node')
  async expandNode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
    @Body()
    dto: {
      nodeLabel: string;
      existingLabels?: string[];
    } & AiSettingsOverride,
  ) {
    await this.roomsService.ensureOwner(roomId, user.userId);
    const room = await this.roomsService.getRoom(roomId, user.userId);
    const settings = await this.accountService.resolveAiSettings(user.userId, {
      provider: dto.provider,
      apiKey: dto.apiKey,
      model: dto.model,
      baseUrl: dto.baseUrl,
    });

    return this.aiService.expandNode(
      room.topic,
      dto.nodeLabel,
      dto.existingLabels ?? [],
      settings,
    );
  }

  @Post('rooms/:roomId/optimize-mindmap')
  async optimizeMindMap(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
    @Body()
    dto: {
      nodes: Array<{ id: string; label: string; type: string }>;
      edges: Array<{ id: string; sourceId: string; targetId: string; label?: string }>;
      includeChatHistory?: boolean;
      selectedFiles?: AiSelectedFile[];
    } & AiSettingsOverride,
  ) {
    await this.roomsService.ensureOwner(roomId, user.userId);
    const room = await this.roomsService.getRoom(roomId, user.userId);
    const includeChatHistory = dto.includeChatHistory !== false;
    const messages = includeChatHistory
      ? await this.chatService.getMessages(roomId, user.userId, {
          take: 20,
        })
      : [];
    const referenceFiles = await this.resolveSelectedFileContext(
      roomId,
      user.userId,
      dto.selectedFiles,
    );
    const settings = await this.accountService.resolveAiSettings(user.userId, {
      provider: dto.provider,
      apiKey: dto.apiKey,
      model: dto.model,
      baseUrl: dto.baseUrl,
    });

    return this.aiService.optimizeMindMap(
      room.topic,
      dto.nodes ?? [],
      dto.edges ?? [],
      settings,
      {
        messages: messages.map((message) => ({
          author: message.nickname ?? 'Unknown',
          content: message.content,
        })),
        referenceFiles,
      },
    );
  }

  private async resolveSelectedFileContext(
    roomId: string,
    userId: string,
    selectedFiles?: AiSelectedFile[],
  ) {
    const fileIds = (selectedFiles ?? []).map((file) => file.id);
    if (fileIds.length === 0) {
      return [];
    }

    return this.sharedFilesService.getAiContext(roomId, userId, fileIds);
  }
}
