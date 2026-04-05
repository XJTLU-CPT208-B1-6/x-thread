import { MindMapNode, MindMapEdge } from './mindmap';
import { PetState } from './pet';

export interface ChatMessage {
  id: string;
  roomId: string;
  authorId: string | null;
  nickname: string;
  avatar?: string | null;
  content: string;
  type: 'TEXT' | 'VOICE_TRANSCRIPT' | 'SYSTEM';
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
