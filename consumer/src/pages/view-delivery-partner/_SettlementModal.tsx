import { useMutation } from "@tanstack/react-query";
import {
  Alert,
  Checkbox,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Typography,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { deliveryPartnersApi } from "../../api/delivery-partners-api";
import { Money } from "../../components/Currency";
import { useMessageStore } from "../../stores/messageStore";
import type {
  PartnerOrder,
  SettlementDirection,
} from "../../types/delivery-partner.types";
import { getErrorMessage } from "../../utils/api-error";
import { expectedPayout } from "../../utils/delivery-partner.utils";

const { Text } = Typography;

export const SETTLEMENT_METHODS = [
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "MFS", label: "MFS (bKash / Nagad)" },
  { value: "CASH", label: "Cash" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "CARD", label: "Card" },
  { value: "MOBILE_MONEY", label: "Mobile money" },
];

type Values = {
  amount: number;
  payment_method: string;
  settlement_date: Dayjs;
  reference?: string;
  note?: string;
  adjust_difference?: boolean;
};

type Props = {
  partnerId: number;
  partnerName: string;
  direction: SettlementDirection;
  orders: PartnerOrder[];
  balance: number;
  onClose: () => void;
  onDone: () => void;
};

export default function SettlementModal({
  partnerId,
  partnerName,
  direction,
  orders,
  balance,
  onClose,
  onDone,
}: Props) {
  const [form] = Form.useForm<Values>();
  const { messageApi } = useMessageStore();
  const expected = orders.length ? expectedPayout(orders) : null;
  const suggested =
    expected ??
    (direction === "RECEIVED" ? Math.max(balance, 0) : Math.max(-balance, 0));
  const amount = Form.useWatch("amount", form);
  const gap =
    expected !== null && amount !== undefined && amount !== null
      ? Math.round((expected - Number(amount)) * 100) / 100
      : 0;

  const save = useMutation({
    mutationFn: (values: Values) =>
      deliveryPartnersApi.createSettlement(partnerId, {
        direction,
        amount: values.amount,
        payment_method: values.payment_method,
        reference: values.reference?.trim() || undefined,
        note: values.note?.trim() || undefined,
        settlement_date: values.settlement_date.format("YYYY-MM-DD"),
        sale_ids: orders.length ? orders.map((o) => o.id) : undefined,
        adjust_difference:
          orders.length && gap !== 0 ? !!values.adjust_difference : undefined,
      }),
    onSuccess: () => {
      messageApi?.success(
        direction === "RECEIVED"
          ? "Payout recorded"
          : "Payment to partner recorded",
      );
      onDone();
    },
    onError: (error) =>
      messageApi?.error(getErrorMessage(error, "Failed to record payout")),
  });

  return (
    <Modal
      open
      title={
        direction === "RECEIVED"
          ? `Record payout from ${partnerName}`
          : `Record payment to ${partnerName}`
      }
      okText="Save"
      confirmLoading={save.isPending}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      {orders.length > 0 ? (
        <Alert
          type="info"
          style={{ marginBottom: 16 }}
          message={
            <span>
              Covers {orders.length} order(s). They add up to{" "}
              <Money value={expected} strong />.
            </span>
          }
        />
      ) : (
        direction === "RECEIVED" && (
          <Alert
            type="info"
            style={{ marginBottom: 16 }}
            message="No orders chosen: the payout lowers the balance but no order is marked settled. To settle orders, pick them in the 'Waiting for payout' tab first."
          />
        )
      )}
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          amount: suggested > 0 ? suggested : undefined,
          payment_method: "BANK_TRANSFER",
          settlement_date: dayjs(),
          adjust_difference: false,
        }}
        onFinish={(values) => save.mutate(values)}
      >
        <Form.Item
          label={direction === "RECEIVED" ? "Amount received" : "Amount paid"}
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
        {orders.length > 0 && gap !== 0 && (
          <Form.Item name="adjust_difference" valuePropName="checked">
            <Checkbox>
              <Text>
                The partner paid <Money value={Math.abs(gap)} />{" "}
                {gap > 0 ? "less" : "more"} than these orders add up to. Write
                the difference off so these orders end at zero.
              </Text>
            </Checkbox>
          </Form.Item>
        )}
        <Form.Item
          label="Method"
          name="payment_method"
          rules={[{ required: true }]}
        >
          <Select options={SETTLEMENT_METHODS} />
        </Form.Item>
        <Form.Item
          label="Date"
          name="settlement_date"
          rules={[{ required: true }]}
        >
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item label="Reference" name="reference" rules={[{ max: 200 }]}>
          <Input placeholder="Transaction or invoice number" />
        </Form.Item>
        <Form.Item label="Note" name="note" rules={[{ max: 1000 }]}>
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
