import { create } from "zustand";
import { applyTheme, otherTheme, readTheme, type Theme } from "../lib/theme.ts";

interface UiState {
  editingTaskId: string | null;
  editingTrigger: HTMLElement | null;
  paletteOpen: boolean;
  theme: Theme;
  toggleTheme: () => void;
  openEditor: (id: string) => void;
  closeEditor: () => void;
  togglePalette: () => void;
  closePalette: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  editingTaskId: null,
  editingTrigger: null,
  paletteOpen: false,
  theme: readTheme(),
  toggleTheme: () => set((s) => {
    const theme = otherTheme(s.theme);
    applyTheme(theme, true);
    return { theme };
  }),
  openEditor: (id) => set({ editingTaskId: id, editingTrigger: document.activeElement as HTMLElement | null }),
  closeEditor: () => set({ editingTaskId: null, editingTrigger: null }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
  closePalette: () => set({ paletteOpen: false }),
}));
