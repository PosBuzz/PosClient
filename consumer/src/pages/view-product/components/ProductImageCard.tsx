import { PictureOutlined } from "@ant-design/icons";
import { Card, Image, Space, Typography } from "antd";

const { Text } = Typography;

interface ProductImageCardProps {
  product: any;
}

const ProductImageCard: React.FC<ProductImageCardProps> = ({ product }) => {
  const mainVariant = product.variants?.find((v) => v.is_default) || product.variants?.[0];

  return (
    <Card bodyStyle={{ padding: 0 }} className="product-image-card">
      {mainVariant?.image ? (
        <Image
          src={mainVariant.image}
          alt={product.name}
          style={{ width: "100%" }}
          fallback="https://placehold.co/600x400?text=No+Image"
        />
      ) : (
        <div
          style={{
            height: "300px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background: "#f5f5f5",
          }}
        >
          <Space direction="vertical" align="center">
            <PictureOutlined style={{ fontSize: "48px", color: "#d9d9d9" }} />
            <Text type="secondary">No Image Available</Text>
          </Space>
        </div>
      )}
    </Card>
  );
};

export default ProductImageCard;