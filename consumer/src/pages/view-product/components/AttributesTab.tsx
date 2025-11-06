import { Table, Typography } from "antd";

const { Text } = Typography;

interface AttributesTabProps {
  attributes: any[];
  product: any;
}

const AttributesTab: React.FC<AttributesTabProps> = ({ attributes, product }) => {
  const attributeColumns = [
    {
      title: "Attribute",
      dataIndex: "name",
      key: "name",
      render: (name) => <Text strong>{name}</Text>,
    },
    {
      title: "Value",
      dataIndex: "value",
      key: "value",
      render: (value) => <Text>{value}</Text>,
    },
    {
      title: "Variant",
      key: "variant",
      render: (_, record) => {
        const variant = product.variants?.find((v) =>
          v.VariantAttribute?.some((attr) => attr.id === record.id)
        );
        return variant ? (
          <Text>{variant.name}</Text>
        ) : (
          <Text type="secondary">Unknown</Text>
        );
      },
    },
  ];

  if (attributes.length === 0) {
    return <Text type="secondary">No attributes available</Text>;
  }

  return (
    <Table
      dataSource={attributes}
      columns={attributeColumns}
      rowKey="id"
      pagination={false}
      size="small"
      scroll={{ x: 400 }}
    />
  );
};

export default AttributesTab;