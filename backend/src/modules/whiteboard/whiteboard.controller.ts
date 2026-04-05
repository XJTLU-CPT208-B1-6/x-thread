import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { parseBooleanFlag } from '../../common/utils/query-parsers';
import { WhiteboardService } from './whiteboard.service';

@UseGuards(JwtAuthGuard)
@Controller('rooms/:roomId/whiteboard')
export class WhiteboardController {
  constructor(private readonly whiteboardService: WhiteboardService) {}

  @Get()
  getWhiteboard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
    @Query('history') history?: string,
  ) {
    return this.whiteboardService.getWhiteboard(roomId, user.userId, {
      allowHistory: parseBooleanFlag(history),
    });
  }

  @Put()
  saveWhiteboard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
    @Body() dto: { contentHtml?: string },
  ) {
    return this.whiteboardService.saveWhiteboard(
      roomId,
      user.userId,
      user.nickname,
      dto,
    );
  }
}
