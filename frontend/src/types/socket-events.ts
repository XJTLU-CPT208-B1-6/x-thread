import { MindMapNode, MindMapEdge } from './mindmap';

import { type PersonalityType } from '../lib/personality';

export interface ChatMessage {
  id: string;
  roomId: string;
  authorId: string | null;
  nickname: string;
  avatar?: string | null;
  personalityType?: PersonalityType | null;
  content: string;
  type: 'TEXT' | 'VOICE_TRANSCRIPT' | 'SYSTEM';
  botName?: string | null;
  botEmoji?: string | null;
  // keep msgType alias for components using old name
  msgType?: 'text' | 'system' | 'ai_notify';
  createdAt: string;
}

export interface AgendaData {
  id: string;
  checkpoints: { name: string; desc: string; status: 'pending' | 'in_progress' | 'completed' }[];
}

export interface SummaryData {
  text: string;
  updatedAt: string;
}
