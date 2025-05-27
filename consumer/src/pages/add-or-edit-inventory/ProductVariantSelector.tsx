import React, { useState, useEffect } from "react";
import {
  Select,
  Card,
  Row,
  Col,
  Typography,
  Tag,
  Alert,
  Spin,
  Empty,
  Space,
  Badge,
} from "antd";
import {
  ShopOutlined,
  BarcodeOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import {
  inventoryApi,
  ProductForInventory,
  ProductVariant,
} from "../../api/inventory-api";

const { Option } = Select;
const { Title, Text } = Typography;

interface ProductVariantSelectorProps {
  value?: {
    productId?: number;
    variantId?: number;
  };
  onChange?: (value: {
    productId: number;
    variantId: number;
    variant: ProductVariant;
  }) => void;
  disabled?: boolean;
}

export default function ProductVariantSelector({
  value,
  onChange,
  disabled,
}: ProductVariantSelectorProps) {
  const [products, setProducts] = useState<ProductForInventory[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedProduct, setSelectedProduct] =
    useState<ProductForInventory | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    null
  );
  const [productsLoading, setProductsLoading] = useState(false);
  const [variantsLoading, setVariantsLoading] = useState(false);

  // Load products when search changes
  const handleProductSearch = async (searchValue: string) => {
    if (!searchValue || searchValue.length < 2) {
      setProducts([]);
      return;
    }

    setProductsLoading(true);
    try {
      const response = await inventoryApi.getProductsForInventory({
        search: searchValue,
        limit: 20,
      });
      setProducts(response.data);
    } catch (error) {
      console.error("Failed to load products:", error);
    } finally {
      setProductsLoading(false);
    }
  };

  // Load variants when product is selected
  const loadVariants = async (productId: number) => {
    setVariantsLoading(true);
    try {
      const variants = await inventoryApi.getProductVariants(productId);
      setVariants(variants);
    } catch (error) {
      console.error("Failed to load variants:", error);
    } finally {
      setVariantsLoading(false);
    }
  };

  // Handle product selection
  const handleProductSelect = async (productId: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    setSelectedProduct(product);
    setSelectedVariant(null);
    setVariants([]);

    await loadVariants(productId);
  };

  // Handle variant selection
  const handleVariantSelect = (variantId: number) => {
    const variant = variants.find((v) => v.id === variantId);
    if (!variant || !selectedProduct) return;

    setSelectedVariant(variant);
    onChange?.({
      productId: selectedProduct.id,
      variantId: variant.id,
      variant: variant,
    });
  };

  // Initialize with value if provided
  useEffect(() => {
    if (value?.productId && value?.variantId) {
      // Load the specific product and variant
      // This would require additional API calls or different approach
    }
  }, [value]);

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="large">
      {/* Product Selection */}
      <Card size="small">
        <Title level={5}>1. Select Product</Title>
        <Select
          showSearch
          placeholder="Search and select a product..."
          style={{ width: "100%" }}
          onSelect={handleProductSelect}
          loading={productsLoading}
          disabled={disabled}
          value={selectedProduct?.id}
          optionFilterProp="children"
          filterOption={false}
          notFoundContent={
            productsLoading ? (
              <Spin size="small" />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )
          }
        >
          {products.map((product) => (
            <Option key={product.id} value={product.id}>
              {product.name}
            </Option>
          ))}
        </Select>
      </Card>

      {/* Variant Selection */}
      {selectedProduct && (
        <Card size="small">
          <Title level={5}>2. Choose Variant</Title>

          {/* Product Info */}
          <Alert
            message={`Selected Product: ${selectedProduct.name}`}
            description={`Code: ${selectedProduct.code} | Total Stock: ${selectedProduct.total_stock}`}
            type="info"
            style={{ marginBottom: 16 }}
            showIcon
          />

          {variantsLoading ? (
            <div style={{ textAlign: "center", padding: 20 }}>
              <Spin size="large" />
            </div>
          ) : variants.length === 0 ? (
            <Empty description="No variants found for this product" />
          ) : (
            <Row gutter={[16, 16]}>
              {variants.map((variant) => (
                <Col xs={24} sm={12} lg={8} key={variant.id}>
                  <Card
                    size="small"
                    hoverable
                    style={{
                      border:
                        selectedVariant?.id === variant.id
                          ? "2px solid #1890ff"
                          : "1px solid #d9d9d9",
                      cursor: "pointer",
                    }}
                    onClick={() => handleVariantSelect(variant.id)}
                  >
                    <Space
                      direction="vertical"
                      style={{ width: "100%" }}
                      size="small"
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Text strong>{variant.name}</Text>
                        {variant.is_default && <Tag color="gold">Default</Tag>}
                      </div>

                      {variant.sku && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <BarcodeOutlined style={{ color: "#666" }} />
                          <Text type="secondary" style={{ fontSize: "12px" }}>
                            SKU: {variant.sku}
                          </Text>
                        </div>
                      )}

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <DollarOutlined style={{ color: "#666" }} />
                        <Text style={{ fontSize: "12px" }}>
                          Cost: ${variant.cost_price} | Sale: $
                          {variant.regular_price}
                        </Text>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <ShopOutlined style={{ color: "#666" }} />
                          <Text style={{ fontSize: "12px" }}>
                            Stock: {variant.total_stock}
                          </Text>
                        </div>
                        {variant.is_low_stock && (
                          <Badge status="warning" text="Low Stock" />
                        )}
                      </div>

                      <div style={{ fontSize: "11px", color: "#999" }}>
                        Sale Unit: {variant.sale_unit.name} | Purchase Unit:{" "}
                        {variant.purchase_unit.name}
                      </div>

                      {variant.VariantAttribute &&
                        variant.VariantAttribute.length > 0 && (
                          <div>
                            {variant.VariantAttribute.map((attr) => (
                              <Tag key={attr.id} size="small">
                                {attr.name}: {attr.value}
                              </Tag>
                            ))}
                          </div>
                        )}
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Card>
      )}
    </Space>
  );
}
