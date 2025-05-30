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
  Divider,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Space,
  Typography
} from "antd";
import { useNavigate } from "react-router-dom";
import { CreateAdjustmentData, inventoryApi } from "../../api/inventory-api";
import CenterLoader from "../../components/CenterLoader";
import PageTitle from "../../components/PageTitle";
import useDarkMode from "../../hooks/useDarkMode";
import { useMessageStore } from "../../stores/messageStore";

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
    queryKey: ["products-for-inventory"],
    queryFn: () => inventoryApi.getProductsForInventory(),
  });

  const { data: variants = [], isLoading: variantsLoading } = useQuery({
    queryKey: ["product-variants", selectedProduct],
    queryFn: () => inventoryApi.getVariants(selectedProduct!),
    enabled: !!selectedProduct,
  });

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: () => inventoryApi.getBranches(),
  });

  const { data: batchesData, isLoading: batchesLoading } = useQuery({
    queryKey: ["batches", selectedVariant, selectedBranch],
    queryFn: () =>
      inventoryApi.getBatches({
        variant_id: selectedVariant!,
        branch_id: selectedBranch!,
        limit: 100,
      }),
    enabled: !!selectedVariant && !!selectedBranch,
  });

  // Get selected batch data
  const selectedBatch = batchesData?.data.find(
    (batch) => batch.id === selectedBatchId
  );

  // Create adjustment mutation
  const createMutation = useMutation({
    mutationFn: inventoryApi.createAdjustment,
    onSuccess: () => {
      messageApi?.success("Adjustment created successfully");
      queryClient.invalidateQueries({ queryKey: ["adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      navigate("/inventory/adjustments");
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to create adjustment"
      );
    },
  });

  const handleProductChange = (productId: number) => {
    form.setFieldsValue({
      variant_id: undefined,
      batch_id: undefined,
    });
  };

  const handleVariantChange = (variantId: number) => {
    form.setFieldsValue({
      batch_id: undefined,
    });
  };

  const handleBranchChange = (branchId: number) => {
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

    // Validate decrease against available stock
    if (values.adjustment_type === "decrease") {
      if (Math.abs(finalQuantityChange) > selectedBatch.quantity) {
        messageApi?.error(
          `Cannot decrease by ${Math.abs(finalQuantityChange)} units. Only ${
            selectedBatch.quantity
          } units available.`
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
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          adjustment_type: "increase",
          quantity_change: 1,
        }}
      >
        {/* Product Selection */}
        <Card title="Product Information" style={{ marginBottom: 24 }}>
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item
                name="product_id"
                label="Product"
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

            <Col span={8}>
              <Form.Item
                name="variant_id"
                label="Variant"
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

            <Col span={8}>
              <Form.Item
                name="branch_id"
                label="Location"
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
          </Row>

          {/* Batch Selection */}
          {canShowBatches && (
            <Row gutter={24}>
              <Col span={24}>
                <Form.Item
                  name="batch_id"
                  label="Batch"
                  rules={[{ required: true, message: "Please select a batch" }]}
                  extra="Select the specific batch to adjust"
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
                          <span style={{ color: "#666" }}>
                            {batch.quantity} units - $
                            {parseFloat(batch.cost_price).toFixed(2)}
                          </span>
                        </div>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          )}

          {/* Current Stock Info */}
          {selectedBatch && (
            <Card>
              <Row gutter={16}>
                <Col span={8}>
                  <Text strong>Current Stock: </Text>
                  <Text>{selectedBatch.quantity} units</Text>
                </Col>
                <Col span={8}>
                  <Text strong>Cost Price: </Text>
                  <Text>
                    ${parseFloat(selectedBatch.cost_price).toFixed(2)}
                  </Text>
                </Col>
                <Col span={8}>
                  <Text strong>Batch: </Text>
                  <Text code>{selectedBatch.batch_number}</Text>
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
                  branches.find((b) => b.id === selectedBranch)
                )}`}
                type="warning"
                showIcon
              />
            )}
        </Card>

        {/* Adjustment Details */}
        {selectedBatch && (
          <Card title="Adjustment Details" style={{ marginBottom: 24 }}>
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  name="adjustment_type"
                  label="Adjustment Type"
                  rules={[{ required: true }]}
                >
                  <Radio.Group size="large">
                    <Radio.Button value="increase" style={{ color: "#52c41a" }}>
                      <PlusOutlined /> Stock Increase
                    </Radio.Button>
                    <Radio.Button value="decrease" style={{ color: "#ff4d4f" }}>
                      <MinusOutlined /> Stock Decrease
                    </Radio.Button>
                  </Radio.Group>
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item
                  name="quantity_change"
                  label="Quantity"
                  rules={[
                    { required: true, message: "Please enter quantity" },
                    {
                      type: "number",
                      min: 1,
                      message: "Quantity must be greater than 0",
                    },
                    adjustmentType === "decrease" && selectedBatch
                      ? {
                          validator: (_, value) => {
                            if (value > selectedBatch.quantity) {
                              return Promise.reject(
                                new Error(
                                  `Cannot exceed available stock of ${selectedBatch.quantity} units`
                                )
                              );
                            }
                            return Promise.resolve();
                          },
                        }
                      : undefined,
                  ].filter(Boolean)}
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
                    addonAfter="units"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  name="reason"
                  label="Reason"
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

              <Col span={12}>
                <Form.Item name="notes" label="Additional Notes">
                  <TextArea
                    rows={3}
                    placeholder="Enter additional notes (optional)"
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Live Summary */}
            {canShowSummary && (
              <div style={{ marginTop: 16 }}>
                <Divider />
                <div
                  style={{
                    padding: 16,
                    borderRadius: 8,
                  }}
                >
                  <Text strong>Adjustment Summary:</Text>
                  <br />
                  <Text>
                    Current Stock:{" "}
                    <Text strong>{selectedBatch.quantity} units</Text>
                  </Text>
                  <br />
                  <Text>
                    Change:{" "}
                    <Text
                      strong
                      style={{
                        color:
                          adjustmentType === "increase" ? "#52c41a" : "#ff4d4f",
                      }}
                    >
                      {adjustmentType === "increase" ? "+" : "-"}
                      {quantityChange} units
                    </Text>
                  </Text>
                  <br />
                  <Text>
                    New Stock:{" "}
                    <Text
                      strong
                      style={{
                        color:
                          newStock < 0
                            ? "#ff4d4f"
                            : `${isDarkMode ? "#fff" : "#000"}`,
                      }}
                    >
                      {newStock} units
                    </Text>
                  </Text>
                  {newStock < 0 && (
                    <div style={{ marginTop: 8 }}>
                      <Alert
                        message="Warning: This will result in negative stock!"
                        type="error"
                        showIcon
                      />
                    </div>
                  )}
                </div>
              </div>
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
