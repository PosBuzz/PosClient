import { TagOutlined } from "@ant-design/icons";
import { Card, Space, Tag, Typography } from "antd";

const { Text } = Typography;

interface ProductTagsCardProps {
  product: any;
}

const ProductTagsCard: React.FC<ProductTagsCardProps> = ({ product }) => {
  return (
    <Card title="Tags" style={{ marginTop: 16 }} extra={<TagOutlined />}>
      {product.tags && product.tags.length > 0 ? (
        <Space wrap>
          {product.tags.map((tagRelation) => (
            <Tag key={tagRelation.tag.id} color="blue">
              {tagRelation.tag.name}
            </Tag>
          ))}
        </Space>
      ) : (
        <Text type="secondary">No tags assigned</Text>
      )}
    </Card>
  );
};

export default ProductTagsCard;