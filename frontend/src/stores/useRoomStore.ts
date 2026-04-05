import { create } from 'zustand';
import { Room, RoomMember } from '../types/room';

interface RoomState {
  currentRoom: Room | null;
  members: RoomMember[];
  setRoom: (room: Room) => void;
  setMembers: (members: RoomMember[]) => void;
  clearRoom: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  currentRoom: null,
  members: [],
  setRoom: (room) => set({ currentRoom: room, members: room.members ?? [] }),
  setMembers: (members) =>
    set((state) => ({
      members,
      currentRoom: state.currentRoom ? { ...state.currentRoom, members } : null,
    })),
  clearRoom: () => set({ currentRoom: null, members: [] }),
}));
