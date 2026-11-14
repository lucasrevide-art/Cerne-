import { create } from "zustand";

interface UiState {
  editingTaskId: string | null;
  openEditor: (id: string) => void;
  closeEditor: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  editingTaskId: null,
  openEditor: (id) => set({ editingTaskId: id }),
  closeEditor: () => set({ editingTaskId: null }),
}));
