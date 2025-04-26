// stores/messageStore.ts
import { create } from "zustand";
import { MessageInstance } from "antd/es/message/interface";

interface MessageStore {
  messageApi: MessageInstance | null;
  setMessageApi: (api: MessageInstance) => void;
}

export const useMessageStore = create<MessageStore>((set) => ({
  messageApi: null,
  setMessageApi: (api) => set({ messageApi: api }),
}));
