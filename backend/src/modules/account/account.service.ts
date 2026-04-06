import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MemberPresenceStatus } from '@prisma/client';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import {
  getDefaultAiModel,
  isCustomOpenAiProvider,
  normalizeAiProvider,
  normalizeCustomBaseUrl,
} from '../ai/ai-provider.config';
import { PrismaService } from '../../prisma/prisma.service';
const HISTORY_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getOverview(userId: string) {
    const user = await this.ensureRegisteredUser(userId);
    const memberships = await this.prisma.roomMember.findMany({
      where: { userId },
      include: {
        room: {
          select: {
            id: true,
            code: true,
            topic: true,
            phase: true,
            mode: true,
            maxMembers: true,
            createdAt: true,
            updatedAt: true,
            members: {
              where: {
                status: {
                  not: MemberPresenceStatus.LEFT,
                },
              },
              select: { userId: true },
            },
          },
        },
      },
    });

    const activeRooms = memberships
      .filter((membership) => membership.status !== MemberPresenceStatus.LEFT)
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
      .map((membership) => this.serializeRoomMembership(membership));

    const roomHistory = memberships
      .filter(
        (membership) =>
          membership.status === MemberPresenceStatus.LEFT &&
          membership.leftAt &&
          membership.leftAt.getTime() >= Date.now() - HISTORY_RETENTION_MS,
      )
      .sort(
        (a, b) =>
          (b.leftAt?.getTime() ?? b.joinedAt.getTime()) -
          (a.leftAt?.getTime() ?? a.joinedAt.getTime()),
      )
      .map((membership) => this.serializeRoomMembership(membership));

    const aiSettings = await this.getAiSettings(userId);

    return {
      user: this.serializeUser(user),
      aiSettings: {
        provider: aiSettings.provider,
        model: aiSettings.model,
        hasApiKey: Boolean(aiSettings.apiKey.trim()),
      },
      activeRooms,
      roomHistory,
    };
  }

  async getAiSettings(userId: string) {
    await this.ensureRegisteredUser(userId);

    const stored = await this.prisma.userAiSettings.findUnique({
      where: { userId },
    });
    const provider = normalizeAiProvider(stored?.provider);

    return {
      provider,
      apiKey: stored?.apiKeyEncrypted ? this.decrypt(stored.apiKeyEncrypted) : '',
      model: stored?.model?.trim() || getDefaultAiModel(provider),
      baseUrl: isCustomOpenAiProvider(provider) ? stored?.baseUrl?.trim() || '' : '',
    };
  }

  async updateAiSettings(
    userId: string,
    dto: {
      provider?: string;
      apiKey?: string;
      model?: string;
      baseUrl?: string;
    },
  ) {
    await this.ensureRegisteredUser(userId);

    const provider = normalizeAiProvider(dto.provider);
    const apiKey = dto.apiKey?.trim() ?? '';
    const model = dto.model?.trim() || getDefaultAiModel(provider);
    const baseUrl = isCustomOpenAiProvider(provider)
      ? normalizeCustomBaseUrl(dto.baseUrl)
      : null;

    await this.prisma.userAiSettings.upsert({
      where: { userId },
      update: {
        provider,
        apiKeyEncrypted: apiKey ? this.encrypt(apiKey) : null,
        model,
        baseUrl,
      },
      create: {
        userId,
        provider,
        apiKeyEncrypted: apiKey ? this.encrypt(apiKey) : null,
        model,
        baseUrl,
      },
    });

    return {
      settings: {
        provider,
        apiKey,
        model,
        baseUrl: baseUrl ?? '',
      },
    };
  }

  async updateProfile(
    userId: string,
    dto: {
      nickname?: string;
      realName?: string;
      xjtluEmail?: string;
      avatarDataUrl?: string;
      clearAvatar?: boolean;
    },
  ) {
    const user = await this.ensureRegisteredUser(userId);
    const nickname = dto.nickname?.trim();
    const realName = dto.realName?.trim() ?? undefined;
    const xjtluEmail = dto.xjtluEmail?.trim() ?? undefined;

    const nextAvatar =
      dto.clearAvatar || dto.avatarDataUrl === ''
        ? null
        : dto.avatarDataUrl === undefined
          ? user.avatar ?? null
          : this.validateAvatarDataUrl(dto.avatarDataUrl);

    if (dto.nickname !== undefined && !nickname) {
      throw new BadRequestException('Nickname is required');
    }

    if (xjtluEmail !== undefined && xjtluEmail !== '' && !xjtluEmail.endsWith('@xjtlu.edu.cn') && !xjtluEmail.endsWith('@student.xjtlu.edu.cn')) {
      throw new BadRequestException('XJTLU email must end with @xjtlu.edu.cn or @student.xjtlu.edu.cn');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        nickname: nickname ?? user.nickname,
        realName: realName !== undefined ? (realName || null) : user.realName,
        xjtluEmail: xjtluEmail !== undefined ? (xjtluEmail || null) : user.xjtluEmail,
        avatar: nextAvatar,
      },
    });

    return {
      user: this.serializeUser(updated),
    };
  }

  async cancelAccount(userId: string) {
    await this.ensureRegisteredUser(userId);

    const activeMembershipCount = await this.prisma.roomMember.count({
      where: {
        userId,
        status: {
          not: MemberPresenceStatus.LEFT,
        },
      },
    });

    if (activeMembershipCount > 0) {
      throw new BadRequestException(
        'Leave or dissolve all active rooms before cancelling this account',
      );
    }

    await this.prisma.userAiSettings.deleteMany({
      where: { userId },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        username: null,
        email: null,
        passwordHash: null,
        avatar: null,
        isGuest: true,
        nickname: `Cancelled User ${userId.slice(-6)}`,
      },
    });

    return { ok: true };
  }

  async resolveAiSettings(
    userId: string,
    override?: {
      provider?: string;
      apiKey?: string;
      model?: string;
      baseUrl?: string;
    },
  ) {
    await this.ensureRegisteredUser(userId);

    const stored = await this.prisma.userAiSettings.findUnique({
      where: { userId },
    });
    const provider = normalizeAiProvider(override?.provider ?? stored?.provider);
    const storedApiKey = stored?.apiKeyEncrypted ? this.decrypt(stored.apiKeyEncrypted) : '';
    const apiKey = override?.apiKey?.trim() || storedApiKey;
    const model =
      override?.model?.trim() || stored?.model?.trim() || getDefaultAiModel(provider);
    const baseUrl = isCustomOpenAiProvider(provider)
      ? normalizeCustomBaseUrl(override?.baseUrl ?? stored?.baseUrl)
      : '';

    return {
      provider,
      apiKey,
      model,
      baseUrl,
    };
  }

  private async ensureRegisteredUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.isGuest || !user.username) {
      throw new ForbiddenException('A registered account is required');
    }

    return user;
  }

  private serializeUser(user: {
    id: string;
    username?: string | null;
    email?: string | null;
    nickname: string;
    realName?: string | null;
    xjtluEmail?: string | null;
    avatar?: string | null;
    isGuest: boolean;
  }) {
    return {
      id: user.id,
      account: user.username ?? null,
      email: user.email ?? null,
      nickname: user.nickname,
      realName: user.realName ?? null,
      xjtluEmail: user.xjtluEmail ?? null,
      avatar: user.avatar ?? null,
      isGuest: user.isGuest,
    };
  }

  private serializeRoomMembership(membership: {
    role: string;
    status: string;
    joinedAt: Date;
    lastSeenAt: Date;
    leftAt?: Date | null;
    room: {
      id: string;
      code: string;
      topic: string;
      phase: string;
      mode: string;
      maxMembers: number;
      createdAt: Date;
      updatedAt: Date;
      members: Array<{ userId: string }>;
    };
  }) {
    return {
      roomId: membership.room.id,
      code: membership.room.code,
      topic: membership.room.topic,
      phase: membership.room.phase,
      mode: membership.room.mode,
      role: membership.role,
      status: membership.status,
      joinedAt: membership.joinedAt,
      lastSeenAt: membership.lastSeenAt,
      leftAt: membership.leftAt ?? null,
      memberCount: membership.room.members.length,
      maxMembers: membership.room.maxMembers,
      roomCreatedAt: membership.room.createdAt,
      roomUpdatedAt: membership.room.updatedAt,
    };
  }

  private getCryptoKey() {
    const secret =
      this.config.get<string>('ACCOUNT_DATA_SECRET')?.trim() ||
      this.config.get<string>('JWT_SECRET')?.trim() ||
      'x-thread-account-secret';

    return createHash('sha256').update(secret).digest();
  }

  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getCryptoKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  private decrypt(value: string) {
    const payload = Buffer.from(value, 'base64');
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const content = payload.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.getCryptoKey(), iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(content), decipher.final()]).toString('utf8');
  }

  private validateAvatarDataUrl(value: string) {
    const avatar = value.trim();
    const avatarPattern = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i;

    if (!avatarPattern.test(avatar)) {
      throw new BadRequestException('Avatar must be a PNG, JPG, WEBP, or GIF image');
    }

    if (avatar.length > 900_000) {
      throw new BadRequestException('Avatar image is too large');
    }

    return avatar;
  }
}
