export interface User {
  id: string;
  name: string;  // maps to nickname on backend
  avatar?: string;
}

export type RoomMode = 'ONSITE' | 'REMOTE';
export type RoomPhase = 'LOBBY' | 'ICEBREAK' | 'DISCUSS' | 'REVIEW' | 'CLOSED';

export interface Room {
  id: string;
  code: string;
  topic: string;
  mode: RoomMode;
  phase: RoomPhase;
  maxMembers: number;
  createdAt: string;
  updatedAt?: string;
  members?: RoomMember[];
}

export interface RoomMember {
  userId: string;
  nickname: string;
  avatar?: string | null;
  role: 'OWNER' | 'MEMBER' | 'OBSERVER';
  status: 'ACTIVE' | 'DISCONNECTED' | 'LEFT';
  joinedAt?: string;
  lastSeenAt?: string | null;
}
