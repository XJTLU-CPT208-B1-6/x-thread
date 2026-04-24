import { describe, expect, it } from 'vitest';
import { buildVoiceCards, extractLatestAiSummary, resolveStageHint } from './remoteRoomUi';

describe('resolveStageHint', () => {
  const copy = {
    stageHintVoice: 'voice',
    stageHintMap: 'map',
    stageHintAi: 'ai',
    stageHintBoard: 'board',
    stageHintFiles: 'files',
    stageHintChat: 'chat',
    stageHintGame: 'game',
  };

  it('returns voice hint for voice tab', () => {
    expect(resolveStageHint('voice', copy)).toBe('voice');
  });

  it('returns game hint for game tab', () => {
    expect(resolveStageHint('game', copy)).toBe('game');
  });

  it('returns chat hint for chat tab', () => {
    expect(resolveStageHint('chat', copy)).toBe('chat');
  });
});

describe('extractLatestAiSummary', () => {
  it('returns latest ai_notify message', () => {
    const messages = [
      { id: '1', msgType: 'text', type: 'TEXT', content: 'a' },
      { id: '2', msgType: 'ai_notify', type: 'VOICE_TRANSCRIPT', content: 'summary-1' },
      { id: '3', msgType: 'ai_notify', type: 'VOICE_TRANSCRIPT', content: 'summary-2' },
    ] as any;
    expect(extractLatestAiSummary(messages)?.content).toBe('summary-2');
  });

  it('returns null when no ai summary', () => {
    const messages = [{ id: '1', msgType: 'text', type: 'TEXT', content: 'a' }] as any;
    expect(extractLatestAiSummary(messages)).toBeNull();
  });
});

describe('buildVoiceCards', () => {
  it('maps room members and marks online status', () => {
    const members = [
      { userId: 'u1', nickname: 'Alice' },
      { userId: 'u2', nickname: 'Bob' },
    ] as any;
    const participants = [{ socketId: 's1', userId: 'u1', nickname: 'Alice' }];
    const cards = buildVoiceCards(members, participants, 'u1');
    expect(cards).toHaveLength(2);
    expect(cards[0].isOnline).toBe(true);
    expect(cards[0].isSelf).toBe(true);
    expect(cards[1].isOnline).toBe(false);
  });

  it('falls back to participants when room members are empty', () => {
    const participants = [{ socketId: 's1', userId: 'u1', nickname: 'Alice' }];
    const cards = buildVoiceCards([], participants, 'u1');
    expect(cards).toEqual([
      { id: 's1', label: 'Alice', isOnline: true, isSelf: true, socketId: 's1' },
    ]);
  });
});
