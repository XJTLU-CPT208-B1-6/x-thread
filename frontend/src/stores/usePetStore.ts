import { create } from 'zustand';
import { PetState } from '../types/pet';

interface PetStore {
  currentPet: PetState | null;
  setPetState: (pet: PetState) => void;
  clearPet: () => void;
}

export const usePetStore = create<PetStore>((set) => ({
  currentPet: null,
  setPetState: (pet) => set({ currentPet: pet }),
  clearPet: () => set({ currentPet: null }),
}));
