import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import {
  parseBooleanFlag,
  parseOptionalDate,
  parseOptionalInt,
} from '../../common/utils/query-parsers';
import { ChatService } from './chat.service';

@UseGuards(JwtAuthGuard)
@Controller('rooms/:roomId/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  getMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
    @Query('take') take?: string,
    @Query('query') query?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('history') history?: string,
  ) {
    return this.chatService.getMessages(roomId, user.userId, {
      take: parseOptionalInt(take, 50, { min: 1, max: 200 }),
      query,
      from: parseOptionalDate(from),
      to: parseOptionalDate(to),
      allowHistory: parseBooleanFlag(history),
    });
  }

  @Post()
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
    @Body() dto: { content: string; type?: 'TEXT' | 'VOICE_TRANSCRIPT' },
  ) {
    return this.chatService.createMessage(
      roomId,
      user.userId,
      dto.content,
      dto.type ?? 'TEXT',
    );
  }
}
