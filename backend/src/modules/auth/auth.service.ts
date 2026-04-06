import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: {
    account: string;
    nickname: string;
    password: string;
  }) {
    const account = this.normalizeAccount(dto.account);
    const nickname = dto.nickname.trim();
    const password = dto.password.trim();

    if (!nickname) {
      throw new BadRequestException('Nickname is required');
    }
    if (password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    const accountExists = await this.prisma.user.findFirst({
      where: { username: account },
    });
    if (accountExists) {
      throw new ConflictException('Account already exists');
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        username: account,
        nickname,
        passwordHash: hash,
        isGuest: false,
      },
    });

    return this.buildSession(user);
  }

  async login(dto: { account: string; password: string }) {
    const account = dto.account.trim().toLowerCase();
    if (!account || !dto.password.trim()) {
      throw new BadRequestException('Account and password are required');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: account }, { email: account }],
      },
    });
    if (!user?.passwordHash || user.isGuest || !user.username) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildSession(user);
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      user: this.serializeUser(user),
    };
  }

  async createGuestSession(nickname: string) {
    const cleanNickname = nickname.trim();
    if (!cleanNickname) {
      throw new BadRequestException('Nickname is required');
    }

    const user = await this.prisma.user.create({
      data: {
        nickname: cleanNickname,
        isGuest: true,
      },
    });

    return this.buildSession(user);
  }

  buildSession(user: {
    id: string;
    username?: string | null;
    email?: string | null;
    nickname: string;
    avatar?: string | null;
    isGuest: boolean;
    isAdmin?: boolean;
  }) {
    const payload = {
      sub: user.id,
      account: user.username ?? null,
      email: user.email ?? null,
      nickname: user.nickname,
      isGuest: user.isGuest,
      isAdmin: user.isAdmin ?? false,
    };

    return {
      accessToken: this.jwt.sign(payload),
      user: this.serializeUser(user),
    };
  }

  private serializeUser(user: {
    id: string;
    username?: string | null;
    email?: string | null;
    nickname: string;
    avatar?: string | null;
    isGuest: boolean;
    isAdmin?: boolean;
  }) {
    return {
      id: user.id,
      account: user.username ?? null,
      email: user.email ?? null,
      nickname: user.nickname,
      avatar: user.avatar ?? null,
      isGuest: user.isGuest,
      isAdmin: user.isAdmin ?? false,
    };
  }

  private normalizeAccount(value: string) {
    const account = value.trim().toLowerCase();
    const accountPattern = /^[a-z][a-z0-9_]{2,23}$/;
    if (!accountPattern.test(account)) {
      throw new BadRequestException(
        'Account must start with a letter and use 3-24 lowercase letters, numbers, or underscores',
      );
    }
    return account;
  }

  private async sendVerificationEmail(email: string, code: string) {
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    const port = Number(this.config.get<string>('SMTP_PORT') ?? '587');
    const secure = `${this.config.get<string>('SMTP_SECURE') ?? ''}`.toLowerCase() === 'true';
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const pass = this.config.get<string>('SMTP_PASS')?.trim();
    const from = this.config.get<string>('SMTP_FROM')?.trim();

    if (host && from) {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: user && pass ? { user, pass } : undefined,
      });
      /*

      await transporter.sendMail({
        from,
        to: email,
        subject: 'X-Thread 注册验证码',
        text: `你的 X-Thread 注册验证码是 ${code}，10 分钟内有效。`,
        html: `<p>你的 <strong>X-Thread</strong> 注册验证码是：</p><p style="font-size:24px;font-weight:700;letter-spacing:4px;">${code}</p><p>10 分钟内有效。</p>`,
      });

      */
      await transporter.sendMail({
        from,
        to: email,
        subject: 'X-Thread verification code',
        text: `Your X-Thread verification code is ${code}. It expires in 10 minutes.`,
        html: `<p>Your <strong>X-Thread</strong> verification code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px;">${code}</p><p>It expires in 10 minutes.</p>`,
      });

      return { mode: 'email' as const };
    }

    console.log(`[Auth] Registration code for ${email}: ${code}`);
    return {
      mode: 'console' as const,
      devCode: this.config.get<string>('NODE_ENV') === 'production' ? undefined : code,
    };
  }
}
