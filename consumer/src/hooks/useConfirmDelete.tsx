import { ExclamationCircleFilled } from "@ant-design/icons";
import { useModalStore } from "../stores/modalStore";

type UseConfirmDeleteProps = {
  title: string;
  content: string;
  onConfirm: () => Promise<void>;
  onCancel?: () => void;
};

export const useConfirmDelete = ({
  title,
  content,
  onConfirm,
  onCancel,
}: UseConfirmDeleteProps) => {
  const { modal } = useModalStore();

  const showDeleteConfirm = () => {
    modal?.confirm({
      title,
      icon: <ExclamationCircleFilled />,
      content,
      okText: "Yes",
      okType: "danger",
      cancelText: "No",
      onOk: async () => {
        try {
          await onConfirm();
        } catch (error) {
          console.error("Delete operation failed:", error);
          modal.error({
            title: "Operation Failed",
            content: "Failed to delete. Please try again later.",
          });
        }
      },
      onCancel: onCancel,
    });
  };

  return { showDeleteConfirm };
};
