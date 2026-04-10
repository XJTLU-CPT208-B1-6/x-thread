import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanionKind, MemberPresenceStatus } from '@prisma/client';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { normalizePersonalityType } from '../../common/utils/personality-type';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getDefaultAiModel,
  isCustomOpenAiProvider,
  normalizeAiProvider,
  normalizeCustomBaseUrl,
} from '../ai/ai-provider.config';

const HISTORY_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_COMPANION_NAME_LENGTH = 24;
const MAX_COMPANION_EMOJI_LENGTH = 8;
const MAX_COMPANION_DESCRIPTION_LENGTH = 140;
const MAX_COMPANION_STYLE_GUIDE_LENGTH = 48;
const MAX_COMPANION_PROMPT_LENGTH = 600;

type CompanionTemplate = {
  slug: string;
  kind: CompanionKind;
  name: string;
  emoji: string;
  description: string;
  styleGuide: string;
  systemPrompt: string;
};

const DEFAULT_COMPANION_TEMPLATES: CompanionTemplate[] = [
  {
    slug: 'default-cat',
    kind: CompanionKind.CAT,
    name: '绒绒猫',
    emoji: '🐈',
    description: '温柔安抚型，适合缓和紧张气氛、接住略显犹豫的表达。',
    styleGuide: '轻声安抚，温和追问',
    systemPrompt:
      '你是一只温柔、细腻、会缓和气氛的猫咪陪伴 bot。你说话轻柔、有分寸，擅长安抚、接话、鼓励别人把想法说完整，并在紧张时帮大家把讨论拉回友善状态。',
  },
  {
    slug: 'default-dog',
    kind: CompanionKind.DOG,
    name: '阿汪',
    emoji: '🐕',
    description: '热情鼓励型，适合带动大家开口、推动第一轮发言。',
    styleGuide: '热情鼓劲，主动破冰',
    systemPrompt:
      '你是一只热情、外向、非常会鼓励人的小狗陪伴 bot。你会用积极轻快的方式帮大家开口、邀请更多人参与，并把冷场转成轻松的互动。',
  },
  {
    slug: 'default-computer',
    kind: CompanionKind.COMPUTER,
    name: '小机',
    emoji: '💻',
    description: '理性梳理型，适合把零散观点整理成问题、选项和下一步。',
    styleGuide: '结构清晰，推进讨论',
    systemPrompt:
      '你是一个拟人化电脑陪伴 bot，冷静、机灵、结构感强。你擅长把零散表达整理成问题、选项和下一步，帮助讨论保持节奏，但语气仍然友好自然。',
  },
  {
    slug: 'default-dolphin',
    kind: CompanionKind.DOLPHIN,
    name: '泡泡豚',
    emoji: '🐬',
    description: '灵动联想型，适合抛出新角度、创意类延伸和轻松话题。',
    styleGuide: '轻快联想，创意延展',
    systemPrompt:
      '你是一只聪明灵动的海豚陪伴 bot，擅长从不同角度联想、制造轻松氛围，并提出有趣但不过分发散的问题，让讨论更有流动感。',
  },
];

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getOverview(userId: string) {
    const user = await this.ensureRegisteredUser(userId);
    await this.ensureDefaultCompanions(userId);

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

    const [aiSettings, companions] = await Promise.all([
      this.getAiSettings(userId),
      this.listCompanions(userId),
    ]);

    return {
      user: this.serializeUser(user),
      aiSettings: {
        provider: aiSettings.provider,
        model: aiSettings.model,
        hasApiKey: Boolean(aiSettings.apiKey.trim()),
      },
      companions,
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
      apiKey: await this.readStoredApiKey(userId, stored?.apiKeyEncrypted),
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

  async listCompanions(userId: string) {
    await this.ensureRegisteredUser(userId);
    await this.ensureDefaultCompanions(userId);

    const companions = await this.prisma.userCompanionProfile.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    return companions.map((companion) => this.serializeCompanion(companion));
  }

  async createCompanion(
    userId: string,
    dto: {
      name?: string;
      emoji?: string;
      description?: string;
      styleGuide?: string;
      systemPrompt?: string;
    },
  ) {
    await this.ensureRegisteredUser(userId);
    await this.ensureDefaultCompanions(userId);

    const name = this.requireCompanionText(
      dto.name,
      'Companion name is required',
      MAX_COMPANION_NAME_LENGTH,
    );
    const emoji = this.normalizeCompanionEmoji(dto.emoji);
    const description = this.requireCompanionText(
      dto.description,
      'Companion description is required',
      MAX_COMPANION_DESCRIPTION_LENGTH,
    );
    const styleGuide = this.requireCompanionText(
      dto.styleGuide,
      'Companion style guide is required',
      MAX_COMPANION_STYLE_GUIDE_LENGTH,
    );
    const systemPrompt = this.requireCompanionText(
      dto.systemPrompt,
      'Companion persona prompt is required',
      MAX_COMPANION_PROMPT_LENGTH,
    );

    const companion = await this.prisma.userCompanionProfile.create({
      data: {
        userId,
        kind: CompanionKind.CUSTOM,
        slug: `custom-${randomBytes(6).toString('hex')}`,
        name,
        emoji,
        description,
        styleGuide,
        systemPrompt,
        isDefault: false,
      },
    });

    return {
      companion: this.serializeCompanion(companion),
    };
  }

  async deleteCompanion(userId: string, companionId: string) {
    await this.ensureRegisteredUser(userId);

    const companion = await this.prisma.userCompanionProfile.findFirst({
      where: {
        id: companionId,
        userId,
      },
    });

    if (!companion) {
      throw new NotFoundException('Companion profile not found');
    }

    if (companion.isDefault) {
      throw new BadRequestException('Default companion profiles cannot be deleted');
    }

    const affectedRooms = await this.prisma.roomCompanionSelection.findMany({
      where: {
        companionProfileId: companionId,
      },
      select: {
        roomId: true,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.roomCompanionSelection.deleteMany({
        where: {
          companionProfileId: companionId,
        },
      });

      for (const { roomId } of affectedRooms) {
        const remainingSelections = await tx.roomCompanionSelection.findMany({
          where: { roomId },
          orderBy: { createdAt: 'asc' },
          select: { companionProfileId: true },
        });

        await tx.room.update({
          where: { id: roomId },
          data: {
            botEnabled: remainingSelections.length > 0,
            botProfileId: remainingSelections[0]?.companionProfileId ?? null,
          },
        });
      }

      await tx.userCompanionProfile.delete({
        where: { id: companionId },
      });
    });

    return { ok: true };
  }

  async updateProfile(
    userId: string,
    dto: {
      nickname?: string;
      realName?: string;
      xjtluEmail?: string;
      personalityType?: string;
      avatarDataUrl?: string;
      clearAvatar?: boolean;
    },
  ) {
    const user = await this.ensureRegisteredUser(userId);
    const nickname = dto.nickname?.trim();
    const realName = dto.realName?.trim() ?? undefined;
    const xjtluEmail = dto.xjtluEmail?.trim() ?? undefined;
    const personalityType =
      dto.personalityType === undefined
        ? user.personalityType ?? null
        : normalizePersonalityType(dto.personalityType);

    const nextAvatar =
      dto.clearAvatar || dto.avatarDataUrl === ''
        ? null
        : dto.avatarDataUrl === undefined
          ? user.avatar ?? null
          : this.validateAvatarDataUrl(dto.avatarDataUrl);

    if (dto.nickname !== undefined && !nickname) {
      throw new BadRequestException('Nickname is required');
    }

    if (dto.personalityType !== undefined && !personalityType) {
      throw new BadRequestException('Personality type must be I or E');
    }

    if (
      xjtluEmail !== undefined &&
      xjtluEmail !== '' &&
      !xjtluEmail.endsWith('@xjtlu.edu.cn') &&
      !xjtluEmail.endsWith('@student.xjtlu.edu.cn')
    ) {
      throw new BadRequestException(
        'XJTLU email must end with @xjtlu.edu.cn or @student.xjtlu.edu.cn',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        nickname: nickname ?? user.nickname,
        realName: realName !== undefined ? (realName || null) : user.realName,
        xjtluEmail: xjtluEmail !== undefined ? (xjtluEmail || null) : user.xjtluEmail,
        personalityType,
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
    await this.prisma.userCompanionProfile.deleteMany({
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
    const storedApiKey = await this.readStoredApiKey(userId, stored?.apiKeyEncrypted);
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

  async ensureDefaultCompanions(userId: string) {
    await this.ensureRegisteredUser(userId);

    const existing = await this.prisma.userCompanionProfile.findMany({
      where: {
        userId,
        slug: {
          in: DEFAULT_COMPANION_TEMPLATES.map((template) => template.slug),
        },
      },
      select: { slug: true },
    });

    const existingSlugs = new Set(existing.map((item) => item.slug));
    const missingTemplates = DEFAULT_COMPANION_TEMPLATES.filter(
      (template) => !existingSlugs.has(template.slug),
    );

    if (missingTemplates.length === 0) {
      return;
    }

    await this.prisma.userCompanionProfile.createMany({
      data: missingTemplates.map((template) => ({
        userId,
        slug: template.slug,
        kind: template.kind,
        name: template.name,
        emoji: template.emoji,
        description: template.description,
        styleGuide: template.styleGuide,
        systemPrompt: template.systemPrompt,
        isDefault: true,
      })),
    });
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
    personalityType?: 'I' | 'E' | null;
    realName?: string | null;
    xjtluEmail?: string | null;
    avatar?: string | null;
    isGuest: boolean;
    isAdmin?: boolean;
  }) {
    return {
      id: user.id,
      account: user.username ?? null,
      email: user.email ?? null,
      nickname: user.nickname,
      personalityType: user.personalityType ?? null,
      realName: user.realName ?? null,
      xjtluEmail: user.xjtluEmail ?? null,
      avatar: user.avatar ?? null,
      isGuest: user.isGuest,
      isAdmin: user.isAdmin ?? false,
    };
  }

  private serializeCompanion(companion: {
    id: string;
    kind: CompanionKind;
    name: string;
    emoji: string;
    description: string;
    styleGuide: string;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: companion.id,
      kind: companion.kind,
      name: companion.name,
      emoji: companion.emoji,
      description: companion.description,
      styleGuide: companion.styleGuide,
      isDefault: companion.isDefault,
      createdAt: companion.createdAt,
      updatedAt: companion.updatedAt,
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

  private requireCompanionText(
    value: string | undefined,
    message: string,
    maxLength: number,
  ) {
    const normalized = value?.trim() ?? '';
    if (!normalized) {
      throw new BadRequestException(message);
    }
    if (normalized.length > maxLength) {
      throw new BadRequestException(`Field exceeds maximum length of ${maxLength}`);
    }
    return normalized;
  }

  private normalizeCompanionEmoji(value?: string) {
    const emoji = value?.trim() || '✨';
    if (emoji.length > MAX_COMPANION_EMOJI_LENGTH) {
      throw new BadRequestException(
        `Companion emoji must be shorter than ${MAX_COMPANION_EMOJI_LENGTH} characters`,
      );
    }
    return emoji;
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

  private async readStoredApiKey(userId: string, encryptedValue?: string | null) {
    if (!encryptedValue) {
      return '';
    }

    try {
      return this.decrypt(encryptedValue);
    } catch (error) {
      this.logger.warn(
        `Failed to decrypt stored AI API key for user ${userId}. Clearing the invalid value.`,
      );

      try {
        await this.prisma.userAiSettings.update({
          where: { userId },
          data: { apiKeyEncrypted: null },
        });
      } catch (cleanupError) {
        this.logger.error(
          `Failed to clear invalid AI API key for user ${userId}`,
          cleanupError instanceof Error ? cleanupError.stack : undefined,
        );
      }

      return '';
    }
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
