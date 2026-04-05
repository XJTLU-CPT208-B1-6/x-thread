import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AccountService } from './account.service';

@UseGuards(JwtAuthGuard)
@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get('overview')
  getOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.accountService.getOverview(user.userId);
  }

  @Get('ai-settings')
  getAiSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.accountService.getAiSettings(user.userId);
  }

  @Put('ai-settings')
  updateAiSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    dto: {
      provider?: string;
      apiKey?: string;
      model?: string;
      baseUrl?: string;
    },
  ) {
    return this.accountService.updateAiSettings(user.userId, dto);
  }

  @Put('profile')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    dto: {
      nickname?: string;
      avatarDataUrl?: string;
      clearAvatar?: boolean;
    },
  ) {
    return this.accountService.updateProfile(user.userId, dto);
  }

  @Post('cancel')
  cancelAccount(@CurrentUser() user: AuthenticatedUser) {
    return this.accountService.cancelAccount(user.userId);
  }
}
