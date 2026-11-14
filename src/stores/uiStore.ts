import { create } from "zustand";

interface UiState {
  editingTaskId: string | null;
  paletteOpen: boolean;
  openEditor: (id: string) => void;
  closeEditor: () => void;
  togglePalette: () => void;
  closePalette: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  editingTaskId: null,
  paletteOpen: false,
  openEditor: (id) => set({ editingTaskId: id }),
  closeEditor: () => set({ editingTaskId: null }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
  closePalette: () => set({ paletteOpen: false }),
}));
