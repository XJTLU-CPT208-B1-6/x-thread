import type { ChatMessage } from '../types/socket-events';
import type { RoomMember } from '../types/room';

export type RemoteFeatureTab = 'voice' | 'mindmap' | 'ai' | 'whiteboard' | 'files' | 'game';

export type RemoteStageCopy = {
  stageHintVoice: string;
  stageHintMap: string;
  stageHintAi: string;
  stageHintBoard: string;
  stageHintFiles: string;
  stageHintGame: string;
};

export type VoicePeer = {
  socketId: string;
  userId: string;
  nickname: string;
};

export type VoiceCard = {
  id: string;
  label: string;
  isOnline: boolean;
  isSelf: boolean;
  socketId: string | null;
};

export const resolveStageHint = (activeTab: RemoteFeatureTab, copy: RemoteStageCopy) => {
  if (activeTab === 'voice') return copy.stageHintVoice;
  if (activeTab === 'mindmap') return copy.stageHintMap;
  if (activeTab === 'ai') return copy.stageHintAi;
  if (activeTab === 'whiteboard') return copy.stageHintBoard;
  if (activeTab === 'files') return copy.stageHintFiles;
  return copy.stageHintGame;
};

export const extractLatestAiSummary = (messages: ChatMessage[]) =>
  [...messages]
    .reverse()
    .find((message) => message.msgType === 'ai_notify' || message.type === 'VOICE_TRANSCRIPT') ?? null;

export const buildVoiceCards = (
  roomMembers: RoomMember[],
  participants: VoicePeer[],
  currentUserId?: string,
): VoiceCard[] => {
  if (roomMembers.length === 0) {
    return participants.map((participant) => ({
      id: participant.socketId,
      label: participant.nickname,
      isOnline: true,
      isSelf: participant.userId === currentUserId,
      socketId: participant.socketId,
    }));
  }

  const participantByUserId = new Map(participants.map((participant) => [participant.userId, participant]));
  return roomMembers.map((member) => {
    const participant = participantByUserId.get(member.userId);
    return {
      id: member.userId,
      label: member.nickname,
      isOnline: Boolean(participant),
      isSelf: member.userId === currentUserId,
      socketId: participant?.socketId ?? null,
    };
  });
};
