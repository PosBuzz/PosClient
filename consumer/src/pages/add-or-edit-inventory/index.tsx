import {
  CalendarOutlined,
  DollarOutlined,
  ReloadOutlined,
  SaveOutlined
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
  message,
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
  ProductVariant
} from "../../api/inventory-api";
import CenterLoader from "../../components/CenterLoader";
import PageTitle from "../../components/PageTitle";
import VendorSelector from "../../components/VendorSelector";

const { Title, Text } = Typography;
const { Option } = Select;

export default function AddEditInventory() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const queryClient = useQueryClient();

  const [form] = Form.useForm();
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    null
  );
  const [selectedProductId, setSelectedProductId] = useState<number | null>(
    null
  );

  // Watch form values for real-time summary updates
  const quantity = Form.useWatch("quantity", form) || 0;
  const costPrice = Form.useWatch("cost_price", form) || 0;

  // Queries
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["inventory-products"],
    queryFn: () => inventoryApi.getProductsForInventory(),
  });

  const { data: variants = [], isLoading: variantsLoading } = useQuery({
    queryKey: ["product-variants", selectedProductId],
    queryFn: () => inventoryApi.getVariants(selectedProductId!),
    enabled: !!selectedProductId,
  });

  // Load existing batch for edit
  const { data: existingBatch, isLoading: batchLoading } = useQuery({
    queryKey: ["batch", id],
    queryFn: () => inventoryApi.getBatch(parseInt(id!)),
    enabled: isEdit && !!id,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: inventoryApi.createBatch,
    onSuccess: () => {
      message.success("Inventory added successfully");
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      navigate("/inventory");
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || "Failed to add inventory");
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
      message.success("Inventory updated successfully");
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      navigate("/inventory");
    },
    onError: (error: any) => {
      message.error(
        error.response?.data?.message || "Failed to update inventory"
      );
    },
  });

  // Set form values when editing
  useEffect(() => {
    if (existingBatch) {
      form.setFieldsValue({
        product_id: existingBatch.variant.product.id,
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
    }
  }, [existingBatch, form]);

  const generateBatchNumber = () => {
    const now = new Date();
    const timestamp = now.getTime().toString().slice(-6);
    const prefix = selectedVariant?.name?.slice(0, 3).toUpperCase() || "INV";
    return `${prefix}${timestamp}`;
  };

  const handleProductSelect = (productId: number) => {
    setSelectedProductId(productId);
    setSelectedVariant(null);
    form.setFieldsValue({
      variant_id: undefined,
      cost_price: undefined,
      batch_number: undefined,
    });
  };

  const handleVariantSelect = (variantId: number) => {
    const variant = variants.find((v) => v.id === variantId);
    if (!variant) return;

    setSelectedVariant(variant);

    // Auto-generate batch number
    if (!isEdit) {
      const timestamp = Date.now().toString().slice(-6);
      const prefix = variant.name?.slice(0, 3).toUpperCase() || "INV";
      form.setFieldValue("batch_number", `${prefix}${timestamp}`);
    }
  };

  const handleSubmit = async (values: any) => {
    if (!selectedVariant) {
      message.error("Please select a product variant");
      return;
    }

    const batchData: CreateBatchData = {
      variant_id: selectedVariant.id,
      branch_id: null, // Always warehouse
      batch_number: values.batch_number,
      quantity: values.quantity,
      cost_price: values.cost_price.toString(),
      vendor_id: values.vendor_id,
      expiry_date: values.expiry_date
        ? values.expiry_date.format("YYYY-MM-DD")
        : undefined,
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
      {/* Header */}
      <PageTitle
        title={isEdit ? "Edit Inventory" : "Add New Inventory"}
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Inventory", href: "/inventory" },
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
          {/* Product Selection */}
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="product_id"
                label="Product"
                rules={[{ required: true, message: "Please select a product" }]}
              >
                <Select
                  placeholder="Select a product"
                  onSelect={handleProductSelect}
                  loading={productsLoading}
                  disabled={isEdit}
                  showSearch
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    (option?.children as string)
                      ?.toLowerCase()
                      .includes(input.toLowerCase())
                  }
                >
                  {products.map((product) => (
                    <Option key={product.id} value={product.id}>
                      {product.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="variant_id"
                label="Product Variant"
                rules={[
                  {
                    required: true,
                    message: "Please select a product variant",
                  },
                ]}
              >
                <Select
                  placeholder="Select a variant"
                  onSelect={handleVariantSelect}
                  loading={variantsLoading}
                  disabled={isEdit || !selectedProductId}
                  showSearch
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    (option?.children as string)
                      ?.toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  notFoundContent={
                    !selectedProductId ? (
                      "Please select a product first"
                    ) : variantsLoading ? (
                      <Spin size="small" />
                    ) : (
                      "No variants found"
                    )
                  }
                >
                  {variants.map((variant) => (
                    <Option key={variant.id} value={variant.id}>
                      {variant.name}
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
          )}

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="batch_number"
                label="Reference Number"
                rules={[
                  { required: true, message: "Please enter reference number" },
                ]}
                extra="Unique identifier for this stock entry"
              >
                <Input
                  placeholder="Enter reference number"
                  suffix={
                    <Button
                      type="link"
                      size="small"
                      icon={<ReloadOutlined />}
                      onClick={() =>
                        form.setFieldValue(
                          "batch_number",
                          generateBatchNumber()
                        )
                      }
                      title="Generate reference number"
                      disabled={!selectedVariant}
                    />
                  }
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="quantity"
                label="Quantity"
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
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="cost_price"
                label="Cost Price (per unit)"
                rules={[
                  { required: true, message: "Please enter cost price" },
                  {
                    type: "number",
                    min: 0,
                    message: "Cost price must be positive",
                  },
                ]}
                extra="What you paid for each unit"
              >
                <InputNumber
                  style={{ width: "100%" }}
                  placeholder="Enter cost price"
                  min={0}
                  precision={2}
                  prefix={<DollarOutlined />}
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="expiry_date"
                label="Expiry Date"
                extra="Leave empty if product doesn't expire"
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

          <Row gutter={24}>
            <Col span={24}>
              <Form.Item
                name="vendor_id"
                label="Supplier/Vendor"
                extra="Who did you purchase this from?"
              >
                <VendorSelector />
              </Form.Item>
            </Col>
          </Row>

          {/* Summary Section - Now updates in real-time */}
          {selectedVariant && (
            <Card size="small">
              <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
                Summary
              </Title>
              <Row gutter={16}>
                <Col span={8}>
                  <Text type="secondary">Product:</Text>
                  <br />
                  <Text strong>
                    {products.find((p) => p.id === selectedProductId)?.name} -{" "}
                    {selectedVariant.name}
                  </Text>
                </Col>
                <Col span={8}>
                  <Text type="secondary">Quantity Adding:</Text>
                  <br />
                  <Text strong>{quantity} units</Text>
                </Col>
                <Col span={8}>
                  <Text type="secondary">Total Cost:</Text>
                  <br />
                  <Text strong>${(costPrice * quantity).toFixed(2)}</Text>
                </Col>
              </Row>
            </Card>
          )}

          <Divider />

          {/* Action Buttons */}
          <div style={{ textAlign: "right" }}>
            <Space>
              <Button onClick={() => navigate("/inventory")}>Cancel</Button>
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
