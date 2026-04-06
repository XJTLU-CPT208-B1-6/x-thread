import { describe, it, expect } from 'vitest';
import { formatTime, resolveRoomPathFromPhase } from './roomUtils';

describe('formatTime', () => {
  it('returns "暂无" for null', () => {
    expect(formatTime(null)).toBe('暂无');
  });

  it('returns "暂无" for undefined', () => {
    expect(formatTime(undefined)).toBe('暂无');
  });

  it('returns a non-empty string for a valid ISO date', () => {
    const result = formatTime('2024-01-15T10:30:00Z');
    expect(result).toBeTruthy();
    expect(result).not.toBe('暂无');
  });
});

describe('resolveRoomPathFromPhase', () => {
  it('returns icebreak path for ICEBREAK phase', () => {
    expect(resolveRoomPathFromPhase('ABC123', 'ICEBREAK')).toBe('/room/ABC123/icebreak');
  });

  it('returns discuss path for DISCUSS phase', () => {
    expect(resolveRoomPathFromPhase('ABC123', 'DISCUSS')).toBe('/room/ABC123/discuss');
  });

  it('returns review path for REVIEW phase', () => {
    expect(resolveRoomPathFromPhase('ABC123', 'REVIEW')).toBe('/room/ABC123/review');
  });

  it('returns lobby path for LOBBY phase', () => {
    expect(resolveRoomPathFromPhase('ABC123', 'LOBBY')).toBe('/room/ABC123/lobby');
  });

  it('returns lobby path for unknown phase', () => {
    expect(resolveRoomPathFromPhase('ABC123', 'UNKNOWN')).toBe('/room/ABC123/lobby');
  });
});
