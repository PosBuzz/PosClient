import { Money, takaPrefix } from "../../components/Currency";
import {
  CalendarOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Spin,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CreateBatchData,
  inventoryApi,
  ProductVariant,
} from "../../api/inventory-api";
import CenterLoader from "../../components/CenterLoader";
import PageTitle from "../../components/PageTitle";
import PaymentMethodSection from "../../components/PaymentMethodSection";
import VendorSelector from "../../components/VendorSelector";
import { useMessageStore } from "../../stores/messageStore";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { setPageTitle } from "../../utils/setPageTitle";
import { PurchasePayment } from "../../types/purchase-payment.types";
import { PaymentMethod } from "../../types/sale.types";
import { PAYMENT_METHODS_REQUIRING_PROVIDER } from "../../utils/payment-provider.utils";

const { Title, Text } = Typography;
const { Option } = Select;

export default function AddEditInventory() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const queryClient = useQueryClient();
  const { messageApi } = useMessageStore();

  const [form] = Form.useForm();
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    null,
  );
  const [selectedProductId, setSelectedProductId] = useState<number | null>(
    null,
  );
  const [batchPayments, setBatchPayments] = useState<PurchasePayment[]>([
    { payment_method: PaymentMethod.CASH, amount: 0, reference: "" },
  ]);

  // Watch form values for real-time summary updates
  const quantity = Form.useWatch("quantity", form) || 0;
  const costPrice = Form.useWatch("cost_price", form) || 0;

  // Queries
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: [queryKeys.productsForInventory],
    queryFn: () => inventoryApi.getProductsForInventory(),
    staleTime: queryStaleTimeMap[queryKeys.productsForInventory],
  });

  const { data: variants = [], isLoading: variantsLoading } = useQuery({
    queryKey: [queryKeys.productVariants, selectedProductId],
    queryFn: () => inventoryApi.getVariants(selectedProductId!),
    enabled: !!selectedProductId,
    staleTime: queryStaleTimeMap[queryKeys.productVariants],
  });

  const { data: branches = [] } = useQuery({
    queryKey: [queryKeys.branches],
    queryFn: () => inventoryApi.getBranches(),
    staleTime: queryStaleTimeMap[queryKeys.branches],
  });

  // Load existing batch for edit
  const { data: existingBatch, isLoading: batchLoading } = useQuery({
    queryKey: [queryKeys.batch, id],
    queryFn: () => inventoryApi.getBatch(parseInt(id!)),
    enabled: isEdit && !!id,
    staleTime: queryStaleTimeMap[queryKeys.batch],
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: inventoryApi.createBatch,
    onSuccess: () => {
      messageApi?.success("Inventory added successfully");
      queryClient.invalidateQueries({ queryKey: [queryKeys.batches] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.inventorySummary] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.product] });
      navigate("/inventory/batches");
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to add inventory",
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Partial<CreateBatchData>;
    }) => inventoryApi.updateBatch(id, data),
    onSuccess: () => {
      messageApi?.success("Inventory updated successfully");

      queryClient.invalidateQueries({ queryKey: [queryKeys.batches] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.batch, id] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.inventorySummary] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.expiringBatches] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.product] });
      navigate("/inventory/batches");
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to update inventory",
      );
    },
  });

  // Set form values when editing
  useEffect(() => {
    if (existingBatch) {
      form.setFieldsValue({
        product_id: existingBatch.variant.product.id,
        branch_id: existingBatch.branch.id,
        variant_id: existingBatch.variant.id,
        batch_number: existingBatch.batch_number,
        quantity: existingBatch.quantity,
        cost_price: parseFloat(existingBatch.cost_price),
        vendor_id: existingBatch.vendor_id,
        expiry_date: existingBatch.expiry_date
          ? dayjs(existingBatch.expiry_date)
          : null,
      });

      // Set selected product and variant for display
      setSelectedProductId(existingBatch.variant.product.id);
      setSelectedVariant({
        id: existingBatch.variant.id,
        name: existingBatch.variant.name,
      });

      // Populate payments from existing batch
      if (existingBatch.purchasePayments && existingBatch.purchasePayments.length > 0) {
        setBatchPayments(
          existingBatch.purchasePayments.map((p: any) => ({
            payment_method: p.payment_method as PaymentMethod,
            payment_type: p.payment_type as any,
            amount: Number(p.amount),
            reference: p.reference || "",
          })),
        );
      } else {
        // Default to full payment
        const totalCost = Number(existingBatch.cost_price) * existingBatch.quantity;
        setBatchPayments([
          { payment_method: PaymentMethod.CASH, amount: totalCost, reference: "" },
        ]);
      }
    }
  }, [existingBatch, form]);

  const generateBatchNumber = () => {
    const now = new Date();
    const timestamp = now.getTime().toString().slice(-6);
    return `${timestamp}`;
  };

  const handleProductSelect = (productId: number) => {
    setSelectedProductId(productId);
    setSelectedVariant(null);
    // Explicitly set the form field value to ensure it's captured
    form.setFieldsValue({
      product_id: productId,
      variant_id: undefined,
      cost_price: undefined,
      batch_number: undefined,
    });
  };

  const handleVariantSelect = (variantId: number) => {
    const variant = variants.find((v) => v.id === variantId);
    if (!variant) return;

    setSelectedVariant(variant);
    // Explicitly set the form field value to ensure it's captured
    form.setFieldsValue({
      variant_id: variantId,
    });

    // Auto-generate batch number
    if (!isEdit) {
      const timestamp = Date.now().toString().slice(-6);
      form.setFieldValue("batch_number", `${timestamp}`);
    }
  };

  const handleSubmit = async (values: any) => {
    if (!selectedVariant) {
      messageApi?.error("Please select a product variant");
      return;
    }

    // Validate payment providers
    for (const payment of batchPayments) {
      if (
        PAYMENT_METHODS_REQUIRING_PROVIDER.includes(payment.payment_method) &&
        !payment.payment_type
      ) {
        messageApi?.error(
          `${payment.payment_method} payment must have a provider selected`,
        );
        return;
      }
    }

    const batchData: CreateBatchData = {
      variant_id: selectedVariant.id,
      branch_id: values.branch_id,
      batch_number: values.batch_number,
      quantity: values.quantity,
      cost_price: values.cost_price.toString(),
      vendor_id: values.vendor_id,
      expiry_date: values.expiry_date
        ? values.expiry_date.format("YYYY-MM-DD")
        : null,
      payments: batchPayments.filter((p) => p.amount > 0),
    };

    if (isEdit && id) {
      updateMutation.mutate({ id: parseInt(id), data: batchData });
    } else {
      createMutation.mutate(batchData);
    }
  };

  if (batchLoading) {
    return <CenterLoader />;
  }

  const submitLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      {setPageTitle("Inventory Batch Form")}
      {/* Header */}
      <PageTitle
        title={isEdit ? "Edit Inventory" : "Add New Inventory"}
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Inventory", href: "/inventory/batches" },
          { title: isEdit ? "Edit Inventory" : "Add New Inventory" },
        ]}
      />

      <Card title="Inventory Details">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark={false}
        >
          {" "}
          {/* Product Selection - Single Row */}
          <Row gutter={[12, 6]}>
            <Col xs={24} sm={8}>
              <Form.Item
                name="product_id"
                label="Product"
                style={{ marginBottom: 8 }}
                rules={[{ required: true, message: "Please select a product" }]}
              >
                <Select
                  placeholder="Select a product"
                  onChange={handleProductSelect} // Changed from onSelect to onChange
                  loading={productsLoading}
                  disabled={isEdit}
                  showSearch
                  optionFilterProp="label"
                  filterOption={(input, option) =>
                    (option?.label as string)
                      ?.toLowerCase()
                      ?.includes(input.toLowerCase())
                  }
                >
                  {products.map((product) => (
                    <Option
                      key={product.id}
                      value={product.id}
                      label={product.name}
                    >
                      {product.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={8}>
              <Form.Item
                name="variant_id"
                label="Variant"
                style={{ marginBottom: 8 }}
                rules={[
                  {
                    required: true,
                    message: "Please select a product variant",
                  },
                ]}
              >
                <Select
                  placeholder="Select a variant"
                  onChange={handleVariantSelect} // Changed from onSelect to onChange
                  loading={variantsLoading}
                  disabled={isEdit || !selectedProductId}
                  showSearch
                  optionFilterProp="label"
                  filterOption={(input, option) =>
                    (option?.label as string)
                      ?.toLowerCase()
                      ?.includes(input.toLowerCase())
                  }
                  notFoundContent={
                    !selectedProductId ? (
                      "Please select a product first"
                    ) : variantsLoading ? (
                      <Spin />
                    ) : (
                      "No variants found"
                    )
                  }
                >
                  {variants.map((variant) => (
                    <Option
                      key={variant.id}
                      value={variant.id}
                      label={variant.name}
                    >
                      {variant.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={8}>
              <Form.Item
                name="branch_id"
                label="Branch"
                style={{ marginBottom: 8 }}
                rules={[{ required: true, message: "Please select branch" }]}
              >
                <Select placeholder="Select branch">
                  {branches.map((branch) => (
                    <Option key={branch.id} value={branch.id}>
                      {branch.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          {/* Selected Variant Info */}
          {selectedVariant && (
            <Alert
              message={
                <div>
                  <Text strong>Selected: </Text>
                  {
                    products.find((p) => p.id === selectedProductId)?.name
                  } - {selectedVariant.name}
                </div>
              }
              type="info"
              style={{ marginBottom: 24 }}
              showIcon
            />
          )}{" "}
          {/* Single Row for Batch No, Cost, Quantity, Expiry */}
          <Row gutter={[12, 6]}>
            <Col xs={24} sm={6}>
              <Form.Item
                name="batch_number"
                label="Batch No #"
                style={{ marginBottom: 8 }}
                rules={[
                  { required: true, message: "Please enter batch number" },
                ]}
                extra="Unique identifier for this stock entry"
              >
                <Input
                  placeholder="Enter batch number"
                  disabled={isEdit}
                  className="py-0!"
                  suffix={
                    <Button
                      type="link"
                      icon={<ReloadOutlined />}
                      onClick={() =>
                        form.setFieldValue(
                          "batch_number",
                          generateBatchNumber(),
                        )
                      }
                      title="Generate batch number"
                      disabled={!selectedVariant || isEdit}
                    />
                  }
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={6}>
              <Form.Item
                name="cost_price"
                label="Cost Price"
                style={{ marginBottom: 8 }}
                rules={[
                  { required: true, message: "Please enter cost price" },
                  {
                    type: "number",
                    min: 0,
                    message: "Cost price must be positive",
                  },
                ]}
                extra="Cost per unit"
              >
                <InputNumber
                  style={{ width: "100%" }}
                  placeholder="Enter cost price"
                  min={0}
                  precision={2}
                  prefix={takaPrefix}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={6}>
              <Form.Item
                name="quantity"
                label="Quantity"
                style={{ marginBottom: 8 }}
                rules={[
                  { required: true, message: "Please enter quantity" },
                  {
                    type: "number",
                    min: 1,
                    message: "Quantity must be at least 1",
                  },
                ]}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  placeholder="Enter quantity to add"
                  min={1}
                  precision={0}
                  addonAfter="units"
                  disabled={isEdit}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={6}>
              <Form.Item
                name="expiry_date"
                label="Expiry Date"
                style={{ marginBottom: 8 }}
                extra="Leave empty if doesn't expire"
              >
                <DatePicker
                  style={{ width: "100%" }}
                  placeholder="Select expiry date"
                  format="YYYY-MM-DD"
                  disabledDate={(current) =>
                    current && current < dayjs().startOf("day")
                  }
                  suffixIcon={<CalendarOutlined />}
                />
              </Form.Item>
            </Col>
          </Row>
          {/* Vendor Row */}
          <Row gutter={[12, 6]}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="vendor_id"
                label="Supplier/Vendor"
                style={{ marginBottom: 8 }}
                extra="Who did you purchase this from?"
              >
                <VendorSelector />
              </Form.Item>
            </Col>
          </Row>
          {/* Payment Section */}
          {selectedVariant && (
            <Card
              title="Payment"
              size="small"
              style={{ marginTop: 16, marginBottom: 16 }}
            >
              <PaymentMethodSection
                payments={batchPayments}
                onChange={setBatchPayments}
                maxAmount={costPrice * quantity}
              />
            </Card>
          )}
          {/* Summary Section - Now updates in real-time */}
          {selectedVariant && (
            <Card>
              <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
                Summary
              </Title>
              <Row gutter={16}>
                <Col span={6}>
                  <Text type="secondary">Product:</Text>
                  <br />
                  <Text strong>
                    {products.find((p) => p.id === selectedProductId)?.name} -{" "}
                    {selectedVariant.name}
                  </Text>
                </Col>
                <Col span={6}>
                  <Text type="secondary">Quantity Adding:</Text>
                  <br />
                  <Text strong>{quantity} units</Text>
                </Col>
                <Col span={6}>
                  <Text type="secondary">Total Cost:</Text>
                  <br />
                  <Text strong>
                    <Money value={costPrice * quantity} />
                  </Text>
                </Col>
                <Col span={6}>
                  <Text type="secondary">Payment Status:</Text>
                  <br />
                  <Text
                    strong
                    style={{
                      color:
                        batchPayments.reduce(
                          (s, p) => s + (Number(p.amount) || 0),
                          0,
                        ) >= costPrice * quantity
                          ? "#52c41a"
                          : "#ff4d4f",
                    }}
                  >
                    {batchPayments.reduce(
                      (s, p) => s + (Number(p.amount) || 0),
                      0,
                    ) >= costPrice * quantity
                      ? "Paid"
                      : batchPayments.reduce(
                            (s, p) => s + (Number(p.amount) || 0),
                            0,
                          ) > 0
                        ? "Partial"
                        : "Due"}
                  </Text>
                </Col>
              </Row>
            </Card>
          )}
          <Divider />
          {/* Action Buttons */}
          <div style={{ textAlign: "right" }}>
            <Space>
              <Button onClick={() => navigate("/inventory/batches")}>
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitLoading}
                icon={<SaveOutlined />}
              >
                {isEdit ? "Update Inventory" : "Add to Inventory"}
              </Button>
            </Space>
          </div>
        </Form>
      </Card>
    </>
  );
}
