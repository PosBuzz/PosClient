import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Col, Input, InputNumber, Row, Select, Typography } from "antd";
import {
  getPaymentProviderOptions,
  getPaymentProviderPlaceholder,
  paymentMethodRequiresProvider,
} from "../utils/payment-provider.utils";
import { PaymentMethod } from "../types/sale.types";
import { PurchasePayment } from "../types/purchase-payment.types";

const { Option } = Select;
const { Text } = Typography;

interface PaymentMethodSectionProps {
  payments: PurchasePayment[];
  onChange: (payments: PurchasePayment[]) => void;
  maxAmount: number;
  compact?: boolean;
  size?: "small" | "middle" | "large";
  validationState?: Record<
    string,
    { status: "success" | "warning" | "error" | "validating" | ""; help: string }
  >;
  validationPrefix?: string;
}

export default function PaymentMethodSection({
  payments,
  onChange,
  maxAmount,
  compact = false,
  size = "middle",
  validationState,
  validationPrefix,
}: PaymentMethodSectionProps) {
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remaining = Math.max(0, maxAmount - totalPaid);

  const getValidation = (index: number, field: string) => {
    if (!validationState || !validationPrefix) {
      return { status: undefined, help: undefined };
    }

    const item = validationState[`${validationPrefix}_payment_${index}_${field}`];
    const status =
      item?.status === "error" || item?.status === "warning"
        ? item.status
        : undefined;

    return { status, help: item?.help };
  };

  const addPayment = () => {
    const remainingAmount = Math.max(0, maxAmount - totalPaid);
    const newPayment: PurchasePayment = {
      payment_method: PaymentMethod.CASH,
      amount: remainingAmount > 0 ? remainingAmount : 0,
      reference: "",
    };
    onChange([...payments, newPayment]);
  };

  const updatePayment = (
    index: number,
    field: keyof PurchasePayment,
    value: any,
  ) => {
    const updated = [...payments];
    updated[index] = { ...updated[index], [field]: value };

    // Reset payment_type when changing method
    if (field === "payment_method") {
      updated[index].payment_type = undefined;
    }

    onChange(updated);
  };

  const removePayment = (index: number) => {
    onChange(payments.filter((_, i) => i !== index));
  };

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
        <Text strong>Payment Methods</Text>
        <Button
          type="dashed"
          size="small"
          icon={<PlusOutlined />}
          onClick={addPayment}
        >
          Add Payment Method
        </Button>
      </Row>

      {payments.map((payment, index) => {
        const requiresProvider = paymentMethodRequiresProvider(
          payment.payment_method,
        );
        const providerOptions = getPaymentProviderOptions(
          payment.payment_method,
        );
        const providerError = getValidation(index, "payment_type");
        const amountError = getValidation(index, "amount");

        return (
          <div key={index} style={{ marginBottom: compact ? 4 : 8 }}>
            <Row gutter={compact ? 4 : 8}>
              {/* Payment Method dropdown */}
              <Col
                span={requiresProvider ? (compact ? 5 : 6) : compact ? 8 : 10}
              >
                <Select
                  size={size}
                  value={payment.payment_method}
                  onChange={(value) =>
                    updatePayment(index, "payment_method", value)
                  }
                  style={{ width: "100%" }}
                  placeholder="Method"
                  popupMatchSelectWidth={false}
                >
                  <Option value={PaymentMethod.CASH}>Cash</Option>
                  <Option value={PaymentMethod.CARD}>Card</Option>
                  <Option value={PaymentMethod.CHEQUE}>Cheque</Option>
                  <Option value={PaymentMethod.BANK_TRANSFER}>
                    Bank Transfer
                  </Option>
                  <Option value={PaymentMethod.MOBILE_MONEY}>
                    Mobile Money
                  </Option>
                  <Option value={PaymentMethod.MFS}>MFS</Option>
                </Select>
              </Col>

              {/* Bank or MFS sub-selector */}
              {requiresProvider && (
                <Col span={compact ? 5 : 7}>
                  <Select
                    size={size}
                    showSearch
                    allowClear
                    placeholder={getPaymentProviderPlaceholder(
                      payment.payment_method,
                    )}
                    value={payment.payment_type || undefined}
                    onChange={(value) =>
                      updatePayment(index, "payment_type", value)
                    }
                    status={providerError.status}
                    style={{ width: "100%" }}
                    optionFilterProp="label"
                    options={providerOptions}
                    popupMatchSelectWidth={false}
                    listHeight={200}
                  />
                  {providerError.help && (
                    <Text type="danger" style={{ fontSize: 12 }}>
                      {providerError.help}
                    </Text>
                  )}
                </Col>
              )}

              {/* Amount input */}
              <Col
                span={requiresProvider ? (compact ? 3 : 4) : compact ? 5 : 6}
              >
                <InputNumber
                  size={size}
                  value={payment.amount}
                  onChange={(value) =>
                    updatePayment(index, "amount", value || 0)
                  }
                  min={0}
                  precision={2}
                  status={amountError.status}
                  style={{ width: "100%" }}
                  placeholder="0.00"
                />
                {amountError.help && (
                  <Text type="danger" style={{ fontSize: 12 }}>
                    {amountError.help}
                  </Text>
                )}
              </Col>

              {/* Reference text input */}
              <Col
                span={
                  requiresProvider ? (compact ? 4 : 5) : compact ? 5 : 6
                }
              >
                <Input
                  size={size}
                  value={payment.reference}
                  onChange={(e) =>
                    updatePayment(index, "reference", e.target.value)
                  }
                  placeholder="Reference"
                />
              </Col>

              {/* Delete row button */}
              <Col span={compact ? 1 : 2}>
                <Button
                  size={size}
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removePayment(index)}
                  disabled={payments.length <= 1}
                />
              </Col>
            </Row>
          </div>
        );
      })}

      {/* Payment summary */}
      {maxAmount > 0 && (
        <Row
          gutter={16}
          style={{
            marginTop: 8,
            padding: "8px 12px",
            borderRadius: 4,
          }}
        >
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Total Cost
            </Text>
            <br />
            <Text strong>{maxAmount.toFixed(2)}</Text>
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Paying
            </Text>
            <br />
            <Text strong style={{ color: "#52c41a" }}>
              {totalPaid.toFixed(2)}
            </Text>
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Remaining
            </Text>
            <br />
            <Text strong style={{ color: remaining > 0 ? "#ff4d4f" : "#52c41a" }}>
              {remaining.toFixed(2)}
            </Text>
          </Col>
        </Row>
      )}
    </div>
  );
}
