import { useMutation } from "@tanstack/react-query";
import { Form, Input, InputNumber, Modal, Radio } from "antd";
import { deliveryPartnersApi } from "../../api/delivery-partners-api";
import { useMessageStore } from "../../stores/messageStore";
import { getErrorMessage } from "../../utils/api-error";

type Values = { direction: "up" | "down"; amount: number; note: string };

export default function AdjustmentModal({
  partnerId,
  onClose,
  onDone,
}: {
  partnerId: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form] = Form.useForm<Values>();
  const { messageApi } = useMessageStore();
  const save = useMutation({
    mutationFn: (values: Values) =>
      deliveryPartnersApi.createAdjustment(partnerId, {
        amount: values.direction === "up" ? values.amount : -values.amount,
        note: values.note.trim(),
      }),
    onSuccess: () => {
      messageApi?.success("Adjustment recorded");
      onDone();
    },
    onError: (error) =>
      messageApi?.error(getErrorMessage(error, "Failed to record adjustment")),
  });
  return (
    <Modal
      open
      title="Adjust balance"
      okText="Save"
      confirmLoading={save.isPending}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ direction: "down" }}
        onFinish={(values) => save.mutate(values)}
      >
        <Form.Item name="direction" label="Effect">
          <Radio.Group>
            <Radio value="up">Partner owes you more</Radio>
            <Radio value="down">Partner owes you less</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item
          label="Amount"
          name="amount"
          rules={[{ required: true, message: "Enter the amount" }]}
        >
          <InputNumber
            min={0.01}
            precision={2}
            style={{ width: "100%" }}
            suffix="BDT"
          />
        </Form.Item>
        <Form.Item
          label="Reason"
          name="note"
          rules={[
            {
              required: true,
              whitespace: true,
              message: "Say why the balance changes",
            },
            { max: 500 },
          ]}
        >
          <Input.TextArea
            rows={2}
            placeholder="e.g. damaged parcel claim, opening balance"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
