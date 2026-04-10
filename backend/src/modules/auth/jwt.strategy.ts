import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET') ?? 'changeme',
    });
  }

  validate(payload: {
    sub: string;
    nickname?: string;
    personalityType?: 'I' | 'E' | null;
    account?: string | null;
    email?: string | null;
    isGuest?: boolean;
    isAdmin?: boolean;
  }) {
    return {
      userId: payload.sub,
      account: payload.account ?? null,
      email: payload.email ?? null,
      nickname: payload.nickname ?? 'Guest',
      personalityType: payload.personalityType ?? null,
      isGuest: payload.isGuest ?? true,
      isAdmin: payload.isAdmin ?? false,
    };
  }
}
