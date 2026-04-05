import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PetMood } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PetService } from './pet.service';

@UseGuards(JwtAuthGuard)
@Controller('rooms/:roomId/pet')
export class PetController {
  constructor(private readonly petService: PetService) {}

  @Get()
  getPet(@CurrentUser() user: AuthenticatedUser, @Param('roomId') roomId: string) {
    return this.petService.getPet(roomId, user.userId);
  }

  @Patch('mood')
  updateMood(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
    @Body() dto: { mood: PetMood },
  ) {
    return this.petService.updateMood(roomId, dto.mood, user.userId);
  }

  @Post('feed')
  feed(@CurrentUser() user: AuthenticatedUser, @Param('roomId') roomId: string) {
    return this.petService.feed(roomId, user.userId);
  }
}
