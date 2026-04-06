import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AdminService } from './admin.service';
import { RoomGateway } from '../../gateways/room.gateway';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly roomGateway: RoomGateway,
  ) {}

  @Get('rooms')
  listAllRooms() {
    return this.adminService.listAllRooms();
  }

  @Post('rooms/:id/dissolve')
  async dissolveRoom(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const result = await this.adminService.forceDissolveRoom(id, user.userId);
    // Notify in-room clients and lobby
    this.roomGateway.emitRoomDissolved(id, result);
    return result;
  }

  @Delete('rooms/:id')
  async deleteRoom(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    // Notify clients before deleting so they can redirect
    this.roomGateway.emitRoomDissolved(id, { roomId: id, adminDeleted: true });
    const result = await this.adminService.forceDeleteRoom(id);
    return result;
  }
}
