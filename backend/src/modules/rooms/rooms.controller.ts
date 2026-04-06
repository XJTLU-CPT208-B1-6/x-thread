import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RoomPhase } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { parseBooleanFlag } from '../../common/utils/query-parsers';
import { RoomGateway } from '../../gateways/room.gateway';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly roomGateway: RoomGateway,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('lobby')
  listLobby() {
    return this.roomsService.listLobbyRooms();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    dto: {
      topic: string;
      mode?: 'ONSITE' | 'REMOTE';
      maxMembers?: number;
      tags?: string[];
    },
  ) {
    return this.roomsService.createRoomSession(user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('join')
  join(@CurrentUser() user: AuthenticatedUser, @Body() dto: { code: string }) {
    return this.roomsService.joinRoomSession(user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('code/:code/history')
  getRoomHistoryByCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string,
  ) {
    return this.roomsService.getRoomByCode(code, user.userId, {
      allowHistory: true,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('code/:code')
  getRoomByCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string,
    @Query('history') history?: string,
  ) {
    return this.roomsService.getRoomByCode(code, user.userId, {
      allowHistory: parseBooleanFlag(history),
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/history')
  getRoomHistory(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.roomsService.getRoom(id, user.userId, {
      allowHistory: true,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getRoom(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('history') history?: string,
  ) {
    return this.roomsService.getRoom(id, user.userId, {
      allowHistory: parseBooleanFlag(history),
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/phase')
  setPhase(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: { phase: RoomPhase },
  ) {
    return this.roomsService.setPhase(id, user.userId, dto.phase);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  updateRoom(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: { topic?: string; tags?: string[]; maxMembers?: number; isLocked?: boolean },
  ) {
    return this.roomsService.updateRoom(id, user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/leave')
  leave(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.roomsService.leaveRoom(user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/dissolve')
  async dissolve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const result = await this.roomsService.dissolveRoom(id, user.userId);
    this.roomGateway.emitRoomDissolved(id, result);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/lock')
  toggleLock(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.roomsService.toggleLock(id, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/heartbeat')
  heartbeat(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.roomsService.heartbeat(id, user.userId);
  }
}
