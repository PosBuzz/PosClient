import { BarcodeOutlined } from "@ant-design/icons";
import { Card, Descriptions, Divider, Space, Tag, Typography } from "antd";
import { formatDate } from "../../../utils/formatters";

const { Title } = Typography;

interface ProductBasicInfoProps {
  product: any;
}

const ProductBasicInfo: React.FC<ProductBasicInfoProps> = ({ product }) => {
  // Determine product status badges
  const getProductStatusBadges = () => {
    const badges: React.ReactNode[] = [];

    if (product.has_variants) {
      badges.push(
        <Tag color="purple" key="variants">
          Has Variants
        </Tag>
      );
    } else {
      badges.push(
        <Tag color="blue" key="simple">
          Simple Product
        </Tag>
      );
    }

    // Calculate total stock across all variants
    const totalStock =
      product.variants?.reduce((total, variant) => {
        return (
          total +
          (variant.inventory_items?.reduce((sum, item) => sum + item.quantity, 0) || 0)
        );
      }, 0) || 0;

    badges.push(
      <Tag color={totalStock > 0 ? "green" : "red"} key="stock">
        {totalStock > 0 ? `${totalStock} in stock` : "Out of stock"}
      </Tag>
    );

    // Calculate total serials
    const totalSerials = product.variants?.reduce((total, variant) => {
      return total + (variant.serials?.length || 0);
    }, 0) || 0;

    if (totalSerials > 0) {
      const availableSerials = product.variants?.reduce((total, variant) => {
        return total + (variant.serials?.filter(s => s.status === 'available').length || 0);
      }, 0) || 0;

      badges.push(
        <Tag color={availableSerials > 0 ? "cyan" : "orange"} key="serials">
          {availableSerials}/{totalSerials} serials available
        </Tag>
      );
    }

    return badges;
  };

  return (
    <Card>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <div>
          <Title level={3}>{product.name}</Title>
          <Space size="middle" wrap>{getProductStatusBadges()}</Space>
        </div>

        <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
          <Descriptions.Item label="Product Code">
            <Space>
              <BarcodeOutlined />
              {product.code || "N/A"}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Category">
            {product.category?.name || "N/A"}
          </Descriptions.Item>
          <Descriptions.Item label="Brand">
            {product.brand?.name || "N/A"}
          </Descriptions.Item>
          <Descriptions.Item label="Has Variants">
            {product.has_variants ? "Yes" : "No"}
          </Descriptions.Item>
          <Descriptions.Item label="Total Variants">
            {product.variants?.length || 0}
          </Descriptions.Item>
          <Descriptions.Item label="Tax Method">
            {product.tax_method || "N/A"}
          </Descriptions.Item>
          {product.daily_sale_objective && (
            <Descriptions.Item label="Daily Sale Objective">
              {product.daily_sale_objective}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Created">
            {formatDate(product.created_at)}
          </Descriptions.Item>
          <Descriptions.Item label="Last Updated">
            {formatDate(product.updated_at)}
          </Descriptions.Item>
        </Descriptions>

        {product.description && (
          <>
            <Divider orientation="left">Description</Divider>
            <div className="product-description" style={{ 
              padding: "12px", 
              background: "#fafafa", 
              borderRadius: "6px",
              lineHeight: "1.6"
            }}>
              {product.description}
            </div>
          </>
        )}
      </Space>
    </Card>
  );
};

export default ProductBasicInfo;