import { create } from 'zustand';

export interface User {
  id: string;    // userId from backend
  name: string;  // nickname from backend
  account?: string | null;
  email?: string | null;
  realName?: string | null;
  xjtluEmail?: string | null;
  avatar?: string | null;
  isGuest?: boolean;
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
