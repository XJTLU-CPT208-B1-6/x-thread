import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(
    @Body()
    dto: {
      account: string;
      nickname: string;
      personalityType: string;
      password: string;
    },
  ) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: { account: string; password: string }) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getCurrentUser(user.userId);
  }

  @Post('guest')
  guest(@Body() dto: { nickname: string }) {
    return this.authService.createGuestSession(dto.nickname);
  }
}
