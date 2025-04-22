import React, { createContext, useContext } from "react";
import { message } from "antd";

const AntdMessageContext = createContext<ReturnType<typeof message.useMessage> | null>(null);

export const AntdMessageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const messageApi = message.useMessage();
  return (
    <AntdMessageContext.Provider value={messageApi}>
      {messageApi[1] /* contextHolder */}
      {children}
    </AntdMessageContext.Provider>
  );
};

export const useAntdMessage = () => {
  const ctx = useContext(AntdMessageContext);
  if (!ctx) throw new Error("useAntdMessage must be used within AntdMessageProvider");
  return ctx[0]; // messageApi
};
