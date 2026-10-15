import { takaPrefix } from "../../../components/Currency";
import {
  CalendarOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Input,
  Row,
  Select,
  Space,
  Typography,
} from "antd";
import InputNumber from "../../../components/NumberInput";
import dayjs from "dayjs";
import { ValidationState, VariantBatchInput } from "../types";
import VendorSelector from "./VendorSelector";
import ProfitInput from "./ProfitInput";
import { priceFromProfit, profitFromPrice } from "../../../utils/number";
import PaymentMethodSection from "../../../components/PaymentMethodSection";
import { PurchasePayment } from "../../../types/purchase-payment.types";
import { PaymentMethod } from "../../../types/sale.types";

// Initial inventory batch editor for a variant (branch, ref, qty, cost, vendor, expiry).

const { Text } = Typography;

interface Option {
  id: number;
  name: string;
}

interface VariantBatchSectionProps {
  variantId: string;
  variantName: string;
  batches: VariantBatchInput[];
  branches: Option[];
  regularPrice: number | string | null;
  wholesalePrice?: number | string | null;
  onPriceChange: (prices: {
    regular_price?: number | null;
    wholesale_price?: number | null;
  }) => void;
  validationState: ValidationState;
  onChange: (batches: VariantBatchInput[]) => void;
}

const createBatchRef = () => {
  // Creates a readable, mostly-unique batch reference from variant name + timestamp.
  // here we take the last 6 digits of the timestamp to keep it short
  return Date.now().toString().slice(-6);
};

const getError = (
  validationState: ValidationState,
  variantId: string,
  index: number,
  field:
    "branch_id" | "batch_number" | "quantity" | "cost_price" | "expiry_date",
) => {
  // Validation keys encode variant + batch row index + field name.
  const key = `variant_${variantId}_batch_${index}_${field}`;
  const status = validationState[key]?.status;
  return {
    status: status === "error" || status === "warning" ? status : undefined,
    help: validationState[key]?.help,
  };
};

export default function VariantBatchSection({
  variantId,
  batches,
  branches,
  regularPrice,
  wholesalePrice,
  onPriceChange,
  validationState,
  onChange,
}: VariantBatchSectionProps) {
  const addBatch = () => {
    // Appends one default batch row with default payment.
    const batchTotal = 0;
    onChange([
      ...batches,
      {
        branch_id: null,
        batch_number: "",
        quantity: 1,
        cost_price: 0,
        payments: [
          {
            payment_method: PaymentMethod.CASH,
            amount: batchTotal,
            reference: "",
          },
        ],
      },
    ]);
  };

  const updateBatch = (
    index: number,
    field: keyof VariantBatchInput,
    value: number | string | undefined | null,
  ) => {
    // Updates one batch row in an immutable way.
    const next = [...batches];
    next[index] = {
      ...next[index],
      [field]: value,
    };

    // Auto-update payment amount when cost/quantity changes and there's only one CASH payment
    if (
      (field === "cost_price" || field === "quantity") &&
      next[index].payments?.length === 1 &&
      next[index].payments![0].payment_method === PaymentMethod.CASH
    ) {
      const qty =
        field === "quantity" ? (value as number) || 0 : next[index].quantity;
      const cost =
        field === "cost_price"
          ? Number(value) || 0
          : Number(next[index].cost_price);
      const updatedPayments = [...next[index].payments!];
      updatedPayments[0] = { ...updatedPayments[0], amount: qty * cost };
      next[index] = { ...next[index], payments: updatedPayments };
    }

    onChange(next);
  };

  const updateBatchPayments = (index: number, payments: PurchasePayment[]) => {
    const next = [...batches];
    next[index] = { ...next[index], payments };
    onChange(next);
  };

  const removeBatch = (index: number) => {
    // Removes one batch row by index.
    const next = [...batches];
    next.splice(index, 1);
    onChange(next);
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={12}>
      <Row justify="space-between" align="middle">
        <Text strong>Inventory</Text>
        <Button icon={<PlusOutlined />} onClick={addBatch}>
          Add Inventory
        </Button>
      </Row>

      {batches.length === 0 && (
        <Text type="secondary">
          No batches added. Add if you want initial stock.
        </Text>
      )}

      {batches.map((batch, index) => {
        const batchTotal =
          (Number(batch.cost_price) || 0) * (batch.quantity || 0);
        const cost = Number(batch.cost_price);
        const regular = Number(regularPrice);
        const wholesale = Number(wholesalePrice);
        const profitOf = (price: number) => profitFromPrice(price, cost);
        const regularProfit =
          regularPrice !== null &&
          regularPrice !== undefined &&
          regularPrice !== "" &&
          Number.isFinite(regular)
            ? profitOf(regular)
            : undefined;
        const wholesaleProfit =
          wholesalePrice !== null &&
          wholesalePrice !== undefined &&
          wholesalePrice !== "" &&
          Number.isFinite(wholesale)
            ? profitOf(wholesale)
            : undefined;
        const updatePriceFromProfit = (
          field: "regular_price" | "wholesale_price",
          value: number | null,
        ) => {
          if (cost <= 0) return;
          // Cleared box clears the price; otherwise price is cost + profit, in whole paisa
          if (value === null || !Number.isFinite(value)) {
            onPriceChange({ [field]: null });
            return;
          }
          onPriceChange({ [field]: priceFromProfit(value, cost) });
        };

        return (
          <Card key={`${variantId}-batch-${index}`} size="small">
            {/* Main batch row */}
            <Row gutter={[8, 8]} align="middle">
              <Col xs={24} md={4} style={{ minWidth: 0 }}>
                <Text strong>Branch *</Text>
                <Select
                  style={{ width: "100%", minWidth: 0 }}
                  placeholder="Select branch"
                  value={batch.branch_id || undefined}
                  options={branches.map((branch) => ({
                    value: branch.id,
                    label: branch.name,
                  }))}
                  status={
                    getError(validationState, variantId, index, "branch_id")
                      .status
                  }
                  onChange={(value) => updateBatch(index, "branch_id", value)}
                />
                {getError(validationState, variantId, index, "branch_id")
                  .help && (
                  <Text type="danger">
                    {
                      getError(validationState, variantId, index, "branch_id")
                        .help
                    }
                  </Text>
                )}
              </Col>

              <Col xs={24} md={4} style={{ minWidth: 0 }}>
                <Text strong>Batch No *</Text>
                <Space.Compact style={{ width: "100%" }}>
                  <Input
                    value={batch.batch_number}
                    placeholder="Generate batch"
                    status={
                      getError(
                        validationState,
                        variantId,
                        index,
                        "batch_number",
                      ).status
                    }
                    onChange={(event) =>
                      updateBatch(index, "batch_number", event.target.value)
                    }
                  />
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() =>
                      updateBatch(index, "batch_number", createBatchRef())
                    }
                  />
                </Space.Compact>
                {getError(validationState, variantId, index, "batch_number")
                  .help && (
                  <Text type="danger">
                    {
                      getError(
                        validationState,
                        variantId,
                        index,
                        "batch_number",
                      ).help
                    }
                  </Text>
                )}
              </Col>

              <Col xs={24} md={4} style={{ minWidth: 0 }}>
                <Text strong>Quantity *</Text>
                <InputNumber
                  style={{ width: "100%" }}
                  placeholder="0"
                  min={1}
                  precision={0}
                  value={batch.quantity}
                  status={
                    getError(validationState, variantId, index, "quantity")
                      .status
                  }
                  onChange={(value) =>
                    updateBatch(index, "quantity", value || 1)
                  }
                />
                {getError(validationState, variantId, index, "quantity")
                  .help && (
                  <Text type="danger">
                    {
                      getError(validationState, variantId, index, "quantity")
                        .help
                    }
                  </Text>
                )}
              </Col>

              <Col xs={24} md={3} style={{ minWidth: 0 }}>
                <Text strong>Cost Price *</Text>
                <InputNumber
                  style={{ width: "100%" }}
                  placeholder="0.00"
                  min={0}
                  precision={2}
                  prefix={takaPrefix}
                  value={
                    batch.cost_price === null ||
                    batch.cost_price === undefined ||
                    batch.cost_price === ""
                      ? undefined
                      : Number(batch.cost_price)
                  }
                  status={
                    getError(validationState, variantId, index, "cost_price")
                      .status
                  }
                  onChange={(value) =>
                    updateBatch(
                      index,
                      "cost_price",
                      value === null ? null : value,
                    )
                  }
                />
                {getError(validationState, variantId, index, "cost_price")
                  .help && (
                  <Text type="danger">
                    {
                      getError(validationState, variantId, index, "cost_price")
                        .help
                    }
                  </Text>
                )}
              </Col>

              <Col xs={24} md={3} style={{ minWidth: 0 }}>
                <Text strong>Profit % (Regular)</Text>
                <ProfitInput
                  disabled={cost <= 0}
                  value={regularProfit}
                  onChange={(value) =>
                    updatePriceFromProfit("regular_price", value)
                  }
                />
              </Col>

              <Col xs={24} md={3} style={{ minWidth: 0 }}>
                <Text strong>Profit % (Wholesale)</Text>
                <ProfitInput
                  disabled={cost <= 0}
                  value={wholesaleProfit}
                  onChange={(value) =>
                    updatePriceFromProfit("wholesale_price", value)
                  }
                />
              </Col>

              <Col xs={24} md={4} style={{ minWidth: 0 }}>
                <Text strong>Vendor</Text>
                <VendorSelector
                  value={
                    typeof batch.vendor_id === "number"
                      ? batch.vendor_id
                      : undefined
                  }
                  onChange={(value) => updateBatch(index, "vendor_id", value)}
                />
              </Col>

              <Col xs={24} md={6}>
                <Text strong>Product Location (optional)</Text>
                <Input
                  value={batch.location}
                  placeholder="e.g. Aisle A, Shelf 3"
                  onChange={(event) =>
                    updateBatch(index, "location", event.target.value)
                  }
                />
              </Col>
              <Col xs={24} md={3} style={{ minWidth: 0 }}>
                <Text strong>
                  <Space size={4}>
                    <CalendarOutlined />
                    Expiry
                  </Space>
                </Text>
                <DatePicker
                  style={{ width: "100%" }}
                  value={batch.expiry_date ? dayjs(batch.expiry_date) : null}
                  status={
                    getError(validationState, variantId, index, "expiry_date")
                      .status
                  }
                  onChange={(date) =>
                    updateBatch(
                      index,
                      "expiry_date",
                      date ? date.format("YYYY-MM-DD") : undefined,
                    )
                  }
                />
                {getError(validationState, variantId, index, "expiry_date")
                  .help && (
                  <Text type="danger">
                    {
                      getError(validationState, variantId, index, "expiry_date")
                        .help
                    }
                  </Text>
                )}
              </Col>

              <Col
                xs={24}
                md={2}
                style={{
                  display: "flex",
                  justifyContent: "center",
                  paddingLeft: 8,
                  paddingTop: 22,
                }}
              >
                <Space size={12} style={{ justifyContent: "center" }}>
                  <Button
                    danger
                    icon={<MinusCircleOutlined />}
                    onClick={() => removeBatch(index)}
                  />
                </Space>
              </Col>
            </Row>

            <div style={{ marginTop: 12 }}>
              <PaymentMethodSection
                payments={
                  batch.payments || [
                    {
                      payment_method: PaymentMethod.CASH,
                      amount: batchTotal,
                      reference: "",
                    },
                  ]
                }
                onChange={(payments) => updateBatchPayments(index, payments)}
                maxAmount={batchTotal}
                compact
                size="small"
                validationState={validationState}
                validationPrefix={`variant_${variantId}_batch_${index}`}
              />
            </div>
          </Card>
        );
      })}
    </Space>
  );
}
