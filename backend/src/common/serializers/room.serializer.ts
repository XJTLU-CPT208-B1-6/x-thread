type RoomWithRelations = {
  id: string;
  code: string;
  topic: string;
  mode: string;
  phase: string;
  botEnabled?: boolean;
  botProfileId?: string | null;
  maxMembers: number;
  isPublic?: boolean;
  isLocked?: boolean;
  tags?: string[];
  ownerId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  members?: Array<{
    userId: string;
    role: string;
    status?: string;
    joinedAt?: Date;
    lastSeenAt?: Date;
    user?: {
      id: string;
      nickname: string;
      avatar?: string | null;
      personalityType?: 'I' | 'E' | null;
    } | null;
  }>;
  botProfile?: {
    id: string;
    kind: string;
    name: string;
    emoji: string;
    description: string;
    styleGuide: string;
    isDefault: boolean;
  } | null;
  companionSelections?: Array<{
    companionProfile: {
      id: string;
      kind: string;
      name: string;
      emoji: string;
      description: string;
      styleGuide: string;
      isDefault: boolean;
    };
  }>;
};

export function serializeRoom(room: RoomWithRelations) {
  const activeCompanions =
    room.companionSelections?.map((selection) => ({
      id: selection.companionProfile.id,
      kind: selection.companionProfile.kind,
      name: selection.companionProfile.name,
      emoji: selection.companionProfile.emoji,
      description: selection.companionProfile.description,
      styleGuide: selection.companionProfile.styleGuide,
      isDefault: selection.companionProfile.isDefault,
    })) ?? [];

  return {
    id: room.id,
    code: room.code,
    topic: room.topic,
    mode: room.mode,
    phase: room.phase,
    botEnabled: room.botEnabled ?? false,
    botProfileId: room.botProfileId ?? null,
    botProfile: room.botProfile
      ? {
          id: room.botProfile.id,
          kind: room.botProfile.kind,
          name: room.botProfile.name,
          emoji: room.botProfile.emoji,
          description: room.botProfile.description,
          styleGuide: room.botProfile.styleGuide,
          isDefault: room.botProfile.isDefault,
        }
      : null,
    activeCompanions,
    maxMembers: room.maxMembers,
    isPublic: room.isPublic ?? true,
    isLocked: room.isLocked ?? false,
    tags: room.tags ?? [],
    ownerId: room.ownerId ?? null,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    members:
      room.members?.map((member) => ({
        userId: member.userId,
        nickname: member.user?.nickname ?? 'Unknown',
        avatar: member.user?.avatar ?? null,
        personalityType: member.user?.personalityType ?? null,
        role: member.role,
        status: member.status ?? 'ACTIVE',
        joinedAt: member.joinedAt,
        lastSeenAt: member.lastSeenAt,
      })) ?? [],
  };
}
