import { DollarOutlined } from "@ant-design/icons";
import { Card, Descriptions, Typography } from "antd";
import { formatCurrency } from "../../../utils/formatters";

const { Text } = Typography;

interface ProductPricingCardProps {
  product: any;
}

const ProductPricingCard: React.FC<ProductPricingCardProps> = ({ product }) => {
  const mainVariant = product.variants?.find((v) => v.is_default) || product.variants?.[0];

  return (
    <Card
      title="Pricing Information"
      style={{ marginTop: 16 }}
      extra={<DollarOutlined />}
    >
      {mainVariant ? (
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Cost Price">
            {formatCurrency(parseFloat(mainVariant.cost_price))}
          </Descriptions.Item>
          <Descriptions.Item label="Regular Price">
            {formatCurrency(parseFloat(mainVariant.regular_price))}
          </Descriptions.Item>
          {mainVariant.wholesale_price && (
            <Descriptions.Item label="Wholesale Price">
              {formatCurrency(parseFloat(mainVariant.wholesale_price))}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Tax">
            {product.tax}% ({product.tax_method})
          </Descriptions.Item>
          {mainVariant.warranty_period && (
            <Descriptions.Item label="Warranty">
              {mainVariant.warranty_period} months
            </Descriptions.Item>
          )}
          {mainVariant.alert_quantity && (
            <Descriptions.Item label="Alert Quantity">
              {mainVariant.alert_quantity} units
            </Descriptions.Item>
          )}
        </Descriptions>
      ) : (
        <Text type="secondary">No pricing information available</Text>
      )}
    </Card>
  );
};

export default ProductPricingCard;