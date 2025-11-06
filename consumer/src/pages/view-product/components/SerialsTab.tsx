import { Table, Tag, Typography } from "antd";
import { formatDate } from "../../../utils/formatters";

const { Text } = Typography;

interface SerialsTabProps {
  serials: any[];
  product: any;
}

const SerialsTab: React.FC<SerialsTabProps> = ({ serials, product }) => {
  const serialColumns = [
    {
      title: "Serial Number",
      dataIndex: "serial_number",
      key: "serial_number",
      render: (serial) => (
        <Text code style={{ fontSize: "12px", fontWeight: "bold" }}>
          {serial}
        </Text>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => {
        const colors = {
          available: "green",
          sold: "blue",
          defective: "red",
          returned: "orange",
        };
        return <Tag color={colors[status] || "default"}>{status?.toUpperCase()}</Tag>;
      },
    },
    {
      title: "Variant",
      key: "variant",
      render: (_, record) => {
        const variant = product.variants?.find((v) =>
          v.serials?.some((s) => s.id === record.id)
        );
        return variant ? (
          <Text>{variant.name}</Text>
        ) : (
          <Text type="secondary">Unknown</Text>
        );
      },
    },
    {
      title: "Notes",
      dataIndex: "notes",
      key: "notes",
      render: (notes) => notes || <Text type="secondary">-</Text>,
    },
    {
      title: "Added Date",
      dataIndex: "created_at",
      key: "created_at",
      render: (date) => (date ? formatDate(date) : <Text type="secondary">-</Text>),
    },
    {
      title: "Last Updated",
      dataIndex: "updated_at",
      key: "updated_at",
      render: (date) => (date ? formatDate(date) : <Text type="secondary">-</Text>),
    },
  ];

  if (serials.length === 0) {
    return <Text type="secondary">No serial numbers available</Text>;
  }

  return (
    <Table
      dataSource={serials}
      columns={serialColumns}
      rowKey="id"
      pagination={{ pageSize: 10, showSizeChanger: true }}
      size="small"
      scroll={{ x: 600 }}
    />
  );
};

export default SerialsTab;