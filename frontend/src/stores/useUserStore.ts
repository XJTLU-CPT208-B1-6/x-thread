import { create } from 'zustand';
import { type PersonalityType } from '../lib/personality';

export interface User {
  id: string;    // userId from backend
  name: string;  // nickname from backend
  account?: string | null;
  email?: string | null;
  realName?: string | null;
  xjtluEmail?: string | null;
  avatar?: string | null;
  personalityType?: PersonalityType | null;
  isGuest?: boolean;
  isAdmin?: boolean;
}

interface UserStore {
  user: User | null;
  setUser: (user: User) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));
