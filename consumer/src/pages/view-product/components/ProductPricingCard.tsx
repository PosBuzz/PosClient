import { DollarOutlined } from "@ant-design/icons";
import { FaArrowTrendUp } from "react-icons/fa6";
import { Card, Descriptions, Typography, Space, Tag, Tooltip } from "antd";
import { formatCurrency } from "../../../utils/formatters";

const { Text } = Typography;

interface ProductPricingCardProps {
  product: any;
}

const ProductPricingCard: React.FC<ProductPricingCardProps> = ({ product }) => {
  const mainVariant =
    product.variants?.find((v) => v.is_default) || product.variants?.[0];

  // Get price range for multi-variant products
  const getPriceRange = () => {
    if (!product.variants || product.variants.length <= 1) return null;

    const regularPrices = product.variants.map((v) =>
      parseFloat(v.regular_price)
    );

    return {
      regular: {
        min: Math.min(...regularPrices),
        max: Math.max(...regularPrices),
      },
    };
  };

  const priceRange = getPriceRange();

  return (
    <Card
      title="Pricing Information"
      style={{ marginTop: 16 }}
      extra={<DollarOutlined />}
    >
      {mainVariant ? (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Regular Price">
              {formatCurrency(parseFloat(mainVariant.regular_price))}
            </Descriptions.Item>
            {mainVariant.wholesale_price && (
              <Descriptions.Item label="Wholesale Price">
                {formatCurrency(parseFloat(mainVariant.wholesale_price))}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Tax Configuration">
              <Space direction="vertical" size="small">
                <Text>
                  {product.tax}% ({product.tax_method})
                </Text>
                <Text type="secondary" style={{ fontSize: "12px" }}>
                  Final price:{" "}
                  {formatCurrency(
                    product.tax_method === "inclusive"
                      ? parseFloat(mainVariant.regular_price)
                      : parseFloat(mainVariant.regular_price) *
                          (1 + product.tax / 100)
                  )}
                </Text>
              </Space>
            </Descriptions.Item>
            {mainVariant.warranty_period && (
              <Descriptions.Item label="Warranty">
                {mainVariant.warranty_period} months
              </Descriptions.Item>
            )}
            {mainVariant.alert_quantity > 0 && (
              <Descriptions.Item label="Alert Quantity">
                {mainVariant.alert_quantity} units
              </Descriptions.Item>
            )}
          </Descriptions>

          {/* Price range for multi-variant products */}
          {priceRange && (
            <>
              <Text strong style={{ fontSize: "14px" }}>
                Price Range Across Variants:
              </Text>
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="Regular Price Range">
                  {formatCurrency(priceRange.regular.min)} -{" "}
                  {formatCurrency(priceRange.regular.max)}
                </Descriptions.Item>
              </Descriptions>
            </>
          )}

          {/* Units information */}
          <Descriptions column={1} bordered size="small" title="Units">
            <Descriptions.Item label="Sale Unit">
              {mainVariant.sale_unit?.name || "N/A"}
              {mainVariant.sale_unit?.code && (
                <Text type="secondary"> ({mainVariant.sale_unit.code})</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Purchase Unit">
              {mainVariant.purchase_unit?.name || "N/A"}
              {mainVariant.purchase_unit?.code && (
                <Text type="secondary">
                  {" "}
                  ({mainVariant.purchase_unit.code})
                </Text>
              )}
            </Descriptions.Item>
          </Descriptions>
        </Space>
      ) : (
        <Text type="secondary">No pricing information available</Text>
      )}
    </Card>
  );
};

export default ProductPricingCard;
