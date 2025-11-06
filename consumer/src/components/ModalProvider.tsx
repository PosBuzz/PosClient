import { Modal } from "antd";
import { useEffect } from "react";
import { useModalStore } from "../stores/modalStore";

export const ModalProvider = ({ children }: { children: React.ReactNode }) => {
  const [modal, contextHolder] = Modal.useModal();
  const { setModal } = useModalStore();

  useEffect(() => {
    setModal(modal);
  }, [modal, setModal]);

  return (
    <>
      {contextHolder}
      {children}
    </>
  );
};
