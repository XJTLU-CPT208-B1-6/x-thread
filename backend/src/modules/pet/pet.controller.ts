import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { UpdateMoodDto, ChangePetTypeDto, PetDto, FeedResultDto } from './dto/pet.dto';
import { PetService } from './pet.service';

@UseGuards(JwtAuthGuard)
@Controller('rooms/:roomId/pet')
export class PetController {
  constructor(private readonly petService: PetService) {}

  @Get()
  async getPet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
  ): Promise<PetDto> {
    return this.petService.getPet(roomId, user.userId);
  }

  @Patch('mood')
  async updateMood(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
    @Body() dto: UpdateMoodDto,
  ): Promise<PetDto> {
    return this.petService.updateMood(roomId, dto.mood, user.userId);
  }

  @Post('feed')
  async feedPet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
  ): Promise<FeedResultDto> {
    const result = await this.petService.feed(roomId, user.userId);
    return {
      pet: result.pet,
      energyGained: result.energyGained,
      message: `Fed pet! Energy increased by ${result.energyGained}`,
    };
  }

  @Patch('type')
  async changePetType(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roomId') roomId: string,
    @Body() dto: ChangePetTypeDto,
  ): Promise<PetDto> {
    return this.petService.changePetTypeWithAuth(roomId, dto.petType, user.userId);
  }
}
