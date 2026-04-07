import { create } from 'zustand';
import type { PetData, PetType, Position } from '../types/pet';
import { petService } from '../services/api-client';

interface PetStore {
  petData: PetData | null;
  isLoading: boolean;
  error: string | null;
  position: Position;
  
  setPetData: (data: PetData | null) => void;
  setPosition: (pos: Position) => void;
  updateEnergy: (delta: number) => void;
  updateMood: (mood: number) => void;
  
  fetchPetData: (roomId: string) => Promise<void>;
  feedPet: (roomId: string) => Promise<void>;
  changePetType: (roomId: string, petType: PetType) => Promise<void>;
}

export const usePetStore = create<PetStore>((set, get) => ({
  petData: null,
  isLoading: false,
  error: null,
  position: { x: 0, y: 0 },

  setPetData: (data) => set({ petData: data }),
  setPosition: (pos) => set({ position: pos }),
  
  updateEnergy: (delta) => set((state) => {
    if (!state.petData) return state;
    return {
      petData: {
        ...state.petData,
        energy: Math.min(100, Math.max(0, state.petData.energy + delta))
      }
    };
  }),
  
  updateMood: (mood) => set((state) => {
    if (!state.petData) return state;
    return {
      petData: {
        ...state.petData,
        mood: Math.min(100, Math.max(0, mood))
      }
    };
  }),

  fetchPetData: async (roomId: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await petService.getPet(roomId);
      set({ petData: data, isLoading: false });
    } catch (err: any) {
      set({ error: err?.message || 'Failed to fetch pet data', isLoading: false });
    }
  },

  feedPet: async (roomId: string) => {
    try {
      const result = await petService.feedPet(roomId);
      set({ petData: result.pet });
    } catch (err: any) {
      set({ error: err?.message || 'Failed to feed pet' });
    }
  },

  changePetType: async (roomId: string, petType: PetType) => {
    try {
      const data = await petService.changePetType(roomId, petType);
      set({ petData: data });
    } catch (err: any) {
      set({ error: err?.message || 'Failed to change pet type' });
    }
  },
}));

