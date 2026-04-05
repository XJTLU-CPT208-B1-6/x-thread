import { create } from 'zustand';

export type WhiteboardSnapshot = {
  roomId: string;
  contentHtml: string;
  updatedAt: string | null;
  updatedByUserId: string | null;
  updatedByNickname: string | null;
};

interface WhiteboardStore {
  board: WhiteboardSnapshot | null;
  setBoard: (board: WhiteboardSnapshot) => void;
  clear: () => void;
}

export const useWhiteboardStore = create<WhiteboardStore>((set) => ({
  board: null,
  setBoard: (board) => set({ board }),
  clear: () => set({ board: null }),
}));
