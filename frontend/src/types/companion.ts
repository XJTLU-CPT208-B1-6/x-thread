export type CompanionKind = 'CAT' | 'DOG' | 'COMPUTER' | 'DOLPHIN' | 'CUSTOM';

export interface CompanionProfile {
  id: string;
  kind: CompanionKind;
  name: string;
  emoji: string;
  description: string;
  styleGuide: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}
