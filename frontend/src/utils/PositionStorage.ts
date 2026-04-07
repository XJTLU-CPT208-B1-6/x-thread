import type { Position } from '../types/pet';

const STORAGE_KEY_PREFIX = 'pet_position_';

export class PositionStorage {
  static getKey(roomId: string): string {
    return `${STORAGE_KEY_PREFIX}${roomId}`;
  }

  static getDefaultPosition(): Position {
    if (typeof window === 'undefined') {
      return { x: 0, y: 0 };
    }
    return {
      x: window.innerWidth - 276,
      y: window.innerHeight - 276
    };
  }

  static save(roomId: string, position: Position): void {
    try {
      const key = this.getKey(roomId);
      localStorage.setItem(key, JSON.stringify(position));
    } catch (e) {
      console.warn('Failed to save pet position:', e);
    }
  }

  static load(roomId: string): Position {
    try {
      const key = this.getKey(roomId);
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load pet position:', e);
    }
    return this.getDefaultPosition();
  }

  static clear(roomId: string): void {
    try {
      const key = this.getKey(roomId);
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('Failed to clear pet position:', e);
    }
  }
}
