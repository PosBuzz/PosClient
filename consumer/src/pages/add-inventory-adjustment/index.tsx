import { Money } from "../../components/Currency";
import {
  ArrowLeftOutlined,
  MinusOutlined,
  PlusOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Space,
  Typography,
} from "antd";
import { useNavigate } from "react-router-dom";
import { CreateAdjustmentData, inventoryApi } from "../../api/inventory-api";
import CenterLoader from "../../components/CenterLoader";
import PageTitle from "../../components/PageTitle";
import useDarkMode from "../../hooks/useDarkMode";
import { useMessageStore } from "../../stores/messageStore";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { setPageTitle } from "../../utils/setPageTitle";

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const ADJUSTMENT_REASONS = [
  "Stock Count Correction",
  "Damaged Goods",
  "Expired Items",
  "Lost/Stolen",
  "Supplier Return",
  "Quality Control",
  "System Error Correction",
  "Other",
];

export default function AddInventoryAdjustment() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const { messageApi } = useMessageStore();

  const isDarkMode = useDarkMode();

  // Watch form values instead of using state
  const selectedProduct = Form.useWatch("product_id", form);
  const selectedVariant = Form.useWatch("variant_id", form);
  const selectedBranch = Form.useWatch("branch_id", form);
  const selectedBatchId = Form.useWatch("batch_id", form);
  const quantityChange = Form.useWatch("quantity_change", form);
  const adjustmentType = Form.useWatch("adjustment_type", form) || "increase";

  // Queries
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: [queryKeys.productsForInventory],
    queryFn: () => inventoryApi.getProductsForInventory(),
    staleTime: queryStaleTimeMap[queryKeys.productsForInventory],
  });

  const { data: variants = [], isLoading: variantsLoading } = useQuery({
    queryKey: [queryKeys.productVariants, selectedProduct],
    queryFn: () => inventoryApi.getVariants(selectedProduct!),
    enabled: !!selectedProduct,
    staleTime: queryStaleTimeMap[queryKeys.productVariants],
  });

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: [queryKeys.branches],
    queryFn: () => inventoryApi.getBranches(),
    staleTime: queryStaleTimeMap[queryKeys.branches],
  });

  const { data: batchesData, isLoading: batchesLoading } = useQuery({
    queryKey: [queryKeys.batches, selectedVariant, selectedBranch],
    queryFn: () =>
      inventoryApi.getBatches({
        variant_id: selectedVariant!,
        branch_id: selectedBranch!,
        limit: 100,
      }),
    enabled: !!selectedVariant && !!selectedBranch,
    staleTime: queryStaleTimeMap[queryKeys.batches],
  });

  // Get selected batch data
  const selectedBatch = batchesData?.data.find(
    (batch) => batch.id === selectedBatchId,
  );

  // Create adjustment mutation
  const createMutation = useMutation({
    mutationFn: inventoryApi.createAdjustment,
    onSuccess: () => {
      messageApi?.success("Adjustment created successfully");
      queryClient.invalidateQueries({ queryKey: [queryKeys.adjustments] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.batches] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.product] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.inventorySummary] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.lowStockItems] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.variantStock] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.stockByVariant] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.productsForSale] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.expiringBatches] });
      navigate("/inventory/adjustments");
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to create adjustment",
      );
    },
  });

  const handleProductChange = () => {
    form.setFieldsValue({
      variant_id: undefined,
      batch_id: undefined,
    });
  };

  const handleVariantChange = () => {
    form.setFieldsValue({
      batch_id: undefined,
    });
  };

  const handleBranchChange = () => {
    form.setFieldsValue({
      batch_id: undefined,
    });
  };

  // Helper function to identify warehouse
  const isWarehouse = (branch: any) => {
    return branch.is_warehouse || branch.name === "Warehouse";
  };

  // Helper function to get branch display name
  const getBranchDisplayName = (branch: any) => {
    if (isWarehouse(branch)) {
      return "Warehouse";
    }
    return branch.name;
  };

  // Calculate new stock quantity
  const calculateNewStock = () => {
    if (!selectedBatch || !quantityChange) return null;

    const change =
      adjustmentType === "increase" ? quantityChange : -quantityChange;
    return selectedBatch.quantity + change;
  };

  const newStock = calculateNewStock();

  const handleSubmit = async (values: any) => {
    if (!selectedBatch) {
      messageApi?.error("Please select a batch");
      return;
    }

    // Calculate final quantity change based on type
    const finalQuantityChange =
      values.adjustment_type === "increase"
        ? Math.abs(values.quantity_change)
        : -Math.abs(values.quantity_change);

    // Validate removal against available inventory
    if (values.adjustment_type === "decrease") {
      if (Math.abs(finalQuantityChange) > selectedBatch.quantity) {
        messageApi?.error(
          `Cannot remove ${Math.abs(finalQuantityChange)} units. Only ${
            selectedBatch.quantity
          } units available.`,
        );
        return;
      }
    }

    const adjustmentData: CreateAdjustmentData = {
      variant_id: selectedVariant,
      branch_id: selectedBranch,
      batch_id: selectedBatch.id,
      quantity_change: finalQuantityChange,
      reason: values.reason,
      notes: values.notes,
    };

    createMutation.mutate(adjustmentData);
  };

  if (productsLoading || branchesLoading) {
    return <CenterLoader />;
  }

  const canShowBatches = selectedVariant && selectedBranch;
  const canShowSummary = selectedBatch && quantityChange > 0;

  return (
    <>
      {setPageTitle("Inventory Adjustment Form")}
      <PageTitle
        title="Create Inventory Adjustment"
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Inventory", href: "/inventory" },
          { title: "Adjustments", href: "/inventory/adjustments" },
          { title: "Create Adjustment" },
        ]}
        rightSection={
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/inventory/adjustments")}
          >
            Back to Adjustments
          </Button>
        }
      />{" "}
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          adjustment_type: "increase",
          quantity_change: 1,
        }}
      >
        {/* Compact Product Selection */}
        <Card
          title="Product Information"
          style={{ marginBottom: 16 }}
          bodyStyle={{ padding: 12 }}
        >
          <Row gutter={[12, 6]}>
            <Col xs={24} sm={8}>
              <Form.Item
                name="product_id"
                label="Product"
                style={{ marginBottom: 8 }}
                rules={[{ required: true, message: "Please select a product" }]}
              >
                <Select
                  placeholder="Select product"
                  onChange={handleProductChange}
                  showSearch
                  optionFilterProp="children"
                  loading={productsLoading}
                >
                  {products.map((product) => (
                    <Option key={product.id} value={product.id}>
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
                rules={[{ required: true, message: "Please select a variant" }]}
              >
                <Select
                  placeholder="Select variant"
                  onChange={handleVariantChange}
                  disabled={!selectedProduct}
                  loading={variantsLoading}
                >
                  {variants.map((variant) => (
                    <Option key={variant.id} value={variant.id}>
                      {variant.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={8}>
              <Form.Item
                name="branch_id"
                label="Location"
                style={{ marginBottom: 8 }}
                rules={[
                  { required: true, message: "Please select a location" },
                ]}
              >
                <Select
                  placeholder="Select location"
                  onChange={handleBranchChange}
                  disabled={!selectedVariant}
                >
                  {branches.map((branch) => (
                    <Option key={branch.id} value={branch.id}>
                      {getBranchDisplayName(branch)}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>{" "}
          {/* Compact Batch Selection */}
          {canShowBatches && (
            <Form.Item
              name="batch_id"
              label="Batch"
              style={{ marginBottom: 8 }}
              rules={[{ required: true, message: "Please select a batch" }]}
            >
              <Select
                placeholder="Select batch"
                loading={batchesLoading}
                disabled={!canShowBatches}
              >
                {batchesData?.data.map((batch) => (
                  <Option key={batch.id} value={batch.id}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{batch.batch_number}</span>
                      <span style={{ color: "#666", fontSize: 11 }}>
                        {batch.quantity} units -{" "}
                        <Money value={batch.cost_price} />
                      </span>
                    </div>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}
          {/* Compact Current Stock Info */}
          {selectedBatch && (
            <Card style={{ marginBottom: 8 }} bodyStyle={{ padding: 8 }}>
              <Row gutter={8}>
                <Col xs={8} sm={8}>
                  <Text strong style={{ fontSize: 11 }}>
                    Stock:{" "}
                  </Text>
                  <Text style={{ fontSize: 11 }}>
                    {selectedBatch.quantity} units
                  </Text>
                </Col>
                <Col xs={8} sm={8}>
                  <Text strong style={{ fontSize: 11 }}>
                    Cost:{" "}
                  </Text>
                  <Text style={{ fontSize: 11 }}>
                    <Money value={selectedBatch.cost_price} />
                  </Text>
                </Col>
                <Col xs={8} sm={8}>
                  <Text strong style={{ fontSize: 11 }}>
                    Batch:{" "}
                  </Text>
                  <Text code style={{ fontSize: 10 }}>
                    {selectedBatch.batch_number}
                  </Text>
                </Col>
              </Row>
            </Card>
          )}
          {/* Warning if no batches available */}
          {canShowBatches &&
            batchesData?.data.length === 0 &&
            !batchesLoading && (
              <Alert
                message="No batches available"
                description={`No inventory batches found for this variant in ${getBranchDisplayName(
                  branches.find((b) => b.id === selectedBranch),
                )}`}
                type="warning"
                showIcon
              />
            )}
        </Card>{" "}
        {/* Compact Adjustment Details */}
        {selectedBatch && (
          <Card
            title="Adjustment Details"
            style={{ marginBottom: 16 }}
            bodyStyle={{ padding: 12 }}
          >
            <Row gutter={[12, 6]}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="adjustment_type"
                  label="Inventory Action"
                  style={{ marginBottom: 8 }}
                  rules={[{ required: true }]}
                >
                  <Radio.Group>
                    <Radio.Button
                      value="increase"
                      style={{ color: "#52c41a", fontSize: 11 }}
                    >
                      <PlusOutlined /> Add to Inventory
                    </Radio.Button>
                    <Radio.Button
                      value="decrease"
                      style={{ color: "#ff4d4f", fontSize: 11 }}
                    >
                      <MinusOutlined /> Remove from Inventory
                    </Radio.Button>
                  </Radio.Group>
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="quantity_change"
                  label="Quantity"
                  style={{ marginBottom: 8 }}
                  rules={[
                    { required: true, message: "Please enter quantity" },
                    {
                      type: "number",
                      min: 1,
                      message: "Quantity must be greater than 0",
                    },
                    ...(adjustmentType === "decrease" && selectedBatch
                      ? [
                          {
                            validator: (_, value) => {
                              if (value > selectedBatch.quantity) {
                                return Promise.reject(
                                  new Error(
                                    `Cannot remove more than the available ${selectedBatch.quantity} units`,
                                  ),
                                );
                              }
                              return Promise.resolve();
                            },
                          },
                        ]
                      : []),
                  ]}
                >
                  <InputNumber
                    placeholder="Enter quantity"
                    style={{ width: "100%" }}
                    min={1}
                    max={
                      adjustmentType === "decrease"
                        ? selectedBatch?.quantity
                        : undefined
                    }
                    addonAfter="u"
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Compact Reason & Notes Row */}
            <Row gutter={[12, 6]}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="reason"
                  label="Reason"
                  style={{ marginBottom: 8 }}
                  rules={[
                    { required: true, message: "Please select a reason" },
                  ]}
                >
                  <Select placeholder="Select reason for adjustment">
                    {ADJUSTMENT_REASONS.map((reason) => (
                      <Option key={reason} value={reason}>
                        {reason}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="notes"
                  label="Notes"
                  style={{ marginBottom: 8 }}
                >
                  <TextArea
                    rows={2}
                    placeholder="Additional notes (optional)"
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Compact Live Summary */}
            {canShowSummary && (
              <Card style={{ marginTop: 8 }} bodyStyle={{ padding: 8 }}>
                <Text strong style={{ fontSize: 11 }}>
                  Inventory Summary:
                </Text>
                <Row gutter={8} style={{ marginTop: 4 }}>
                  <Col xs={8} sm={8}>
                    <Text style={{ fontSize: 11 }}>
                      Current: <Text strong>{selectedBatch.quantity}u</Text>
                    </Text>
                  </Col>
                  <Col xs={8} sm={8}>
                    <Text style={{ fontSize: 11 }}>
                      {adjustmentType === "increase" ? "Adding" : "Removing"}:{" "}
                      <Text
                        strong
                        style={{
                          color:
                            adjustmentType === "increase"
                              ? "#52c41a"
                              : "#ff4d4f",
                        }}
                      >
                        {adjustmentType === "increase" ? "+" : "-"}
                        {quantityChange}u
                      </Text>
                    </Text>
                  </Col>
                  <Col xs={8} sm={8}>
                    <Text style={{ fontSize: 11 }}>
                      New:{" "}
                      <Text
                        strong
                        style={{
                          color:
                            newStock < 0
                              ? "#ff4d4f"
                              : `${isDarkMode ? "#fff" : "#000"}`,
                        }}
                      >
                        {newStock}u
                      </Text>
                    </Text>
                  </Col>
                </Row>
                {newStock < 0 && (
                  <Alert
                    message="Warning: This will result in negative stock!"
                    type="error"
                    showIcon
                    style={{ marginTop: 8 }}
                  />
                )}
              </Card>
            )}
          </Card>
        )}
        {/* Submit */}
        <div className={"text-right"}>
          <Space>
            <Button onClick={() => navigate("/inventory/adjustments")}>
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createMutation.isPending}
              icon={<SaveOutlined />}
              disabled={!selectedBatch}
            >
              Create Adjustment
            </Button>
          </Space>
        </div>
      </Form>
    </>
  );
}
