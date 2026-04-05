export type PetType = 'egg' | 'baby' | 'teen' | 'adult';
export type PetMood = 'happy' | 'neutral' | 'sad' | 'sleepy' | 'excited' | 'knocking';

export interface PetState {
  id: string;
  roomId: string;
  type: PetType;
  level: number;
  health: number;
  mood: PetMood;
}

export interface PetGrowthEvent {
  event: string;
  timestamp: number;
  delta: number;
}
