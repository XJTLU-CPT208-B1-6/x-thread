import { CompanionProfile } from './companion';
import { type PersonalityType } from '../lib/personality';

export interface User {
  id: string;
  name: string;  // maps to nickname on backend
  avatar?: string;
  personalityType?: PersonalityType | null;
}

export type RoomMode = 'ONSITE' | 'REMOTE';
export type RoomPhase = 'LOBBY' | 'ICEBREAK' | 'DISCUSS' | 'REVIEW' | 'CLOSED';

export interface Room {
  id: string;
  code: string;
  topic: string;
  mode: RoomMode;
  phase: RoomPhase;
  botEnabled?: boolean;
  botProfileId?: string | null;
  botProfile?: CompanionProfile | null;
  activeCompanions?: CompanionProfile[];
  maxMembers: number;
  isPublic?: boolean;
  isLocked?: boolean;
  tags?: string[];
  ownerId?: string | null;
  createdAt: string;
  updatedAt?: string;
  members?: RoomMember[];
}

export interface RoomMember {
  userId: string;
  nickname: string;
  avatar?: string | null;
  personalityType?: PersonalityType | null;
  role: 'OWNER' | 'MEMBER' | 'OBSERVER';
  status: 'ACTIVE' | 'DISCONNECTED' | 'LEFT';
  joinedAt?: string;
  lastSeenAt?: string | null;
}
