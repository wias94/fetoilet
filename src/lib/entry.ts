import { create } from "zustand";

export const useEntry = create<{ entered: boolean; enter: () => void }>((set) => ({
  entered: false,
  enter: () => set({ entered: true }),
}));
