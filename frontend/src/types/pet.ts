export type PetType = 'cat' | 'dog';
export type PetAnimationState = 'idle' | 'happy' | 'busy' | 'hungry' | 'reaction';

export interface PetData {
  id: string;
  roomId: string;
  petType: PetType;
  name: string;
  mood: number;
  energy: number;
  level: number;
  updatedAt: string;
}

export interface Position {
  x: number;
  y: number;
}

export interface StateTransition {
  state: PetAnimationState;
  duration?: number;
}
