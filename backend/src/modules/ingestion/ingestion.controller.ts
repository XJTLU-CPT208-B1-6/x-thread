import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { InputEventKind } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { IngestionService } from './ingestion.service';

@UseGuards(JwtAuthGuard)
@Controller('rooms/:roomId/inputs')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
  ) {
    return this.ingestionService.listRecent(roomId, user.userId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
    @Body()
    dto: {
      content: string;
      kind?: InputEventKind;
      source?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.ingestionService.acceptInput(roomId, user.userId, dto);
  }
}
