// stores/messageStore.ts
import { HookAPI } from "antd/es/modal/useModal";
import { create } from "zustand";

interface ModalStore {
  modal: HookAPI | null;
  setModal: (modal: HookAPI) => void;
}

export const useModalStore = create<ModalStore>((set) => ({
  modal: null,
  setModal: (modal) => set({ modal: modal }),
}));
