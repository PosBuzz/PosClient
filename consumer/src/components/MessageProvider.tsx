import { message } from "antd";
import { useEffect } from "react";
import { useMessageStore } from "../stores/messageStore";

export const MessageProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [messageApi, contextHolder] = message.useMessage();
  const { setMessageApi } = useMessageStore();

  useEffect(() => {
    setMessageApi(messageApi);
  }, [messageApi, setMessageApi]);

  return (
    <>
      {contextHolder}
      {children}
    </>
  );
};
