type RoomWithRelations = {
  id: string;
  code: string;
  topic: string;
  mode: string;
  phase: string;
  maxMembers: number;
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
    } | null;
  }>;
  pet?: {
    id: string;
    roomId: string;
    name: string;
    mood: string;
    energy: number;
    createdAt: Date;
    updatedAt: Date;
  } | null;
};

export function serializeRoom(room: RoomWithRelations) {
  return {
    id: room.id,
    code: room.code,
    topic: room.topic,
    mode: room.mode,
    phase: room.phase,
    maxMembers: room.maxMembers,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    members:
      room.members?.map((member) => ({
        userId: member.userId,
        nickname: member.user?.nickname ?? 'Unknown',
        avatar: member.user?.avatar ?? null,
        role: member.role,
        status: member.status ?? 'ACTIVE',
        joinedAt: member.joinedAt,
        lastSeenAt: member.lastSeenAt,
      })) ?? [],
    pet: room.pet ?? null,
  };
}
