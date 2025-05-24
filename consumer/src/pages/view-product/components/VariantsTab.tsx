import { AlertOutlined, BarcodeOutlined } from "@ant-design/icons";
import { Badge, Space, Table, Tag, Tooltip, Typography, Image } from "antd";
import { formatCurrency } from "../../../utils/formatters";

const { Text } = Typography;

interface VariantsTabProps {
  variants: any[];
}

const VariantsTab: React.FC<VariantsTabProps> = ({ variants }) => {
  const variantColumns = [
    {
      title: "Image",
      dataIndex: "image",
      key: "image",
      width: 80,
      render: (image) => (
        <Image
          src={image}
          alt="Variant"
          width={50}
          height={50}
          style={{ objectFit: "cover", borderRadius: "4px" }}
          fallback="https://placehold.co/50x50?text=No+Image"
        />
      ),
    },
    {
      title: "Variant Name",
      dataIndex: "name",
      key: "name",
      render: (name, record) => (
        <Space direction="vertical" size="small">
          <Space>
            {record.is_default && <Badge status="success" text="Default" />}
            <Text strong={record.is_default}>{name}</Text>
          </Space>
          {record.sku && (
            <Text type="secondary" style={{ fontSize: "12px" }}>
              SKU: {record.sku}
            </Text>
          )}
          {record.barcode && (
            <Text type="secondary" style={{ fontSize: "12px" }}>
              Barcode: {record.barcode}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "Pricing",
      key: "pricing",
      render: (_, record) => (
        <Space direction="vertical" size="small">
          <div>
            <Text strong>Regular: </Text>
            <Text>{formatCurrency(parseFloat(record.regular_price))}</Text>
          </div>
          <div>
            <Text type="secondary">Cost: </Text>
            <Text type="secondary">{formatCurrency(parseFloat(record.cost_price))}</Text>
          </div>
          {record.wholesale_price && (
            <div>
              <Text type="secondary">Wholesale: </Text>
              <Text type="secondary">{formatCurrency(parseFloat(record.wholesale_price))}</Text>
            </div>
          )}
        </Space>
      ),
    },
    {
      title: "Units",
      key: "units",
      render: (_, record) => (
        <Space direction="vertical" size="small">
          <div>
            <Text strong>Sale: </Text>
            <Text>{record.sale_unit?.name || "N/A"}</Text>
          </div>
          <div>
            <Text type="secondary">Purchase: </Text>
            <Text type="secondary">{record.purchase_unit?.name || "N/A"}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: "Stock",
      key: "stock",
      render: (_, record) => {
        const totalStock = record.inventory_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
        const isLowStock = record.alert_quantity && totalStock <= record.alert_quantity;

        return (
          <Space direction="vertical" size="small">
            <Space>
              <Text style={{ color: isLowStock ? "#ff4d4f" : totalStock > 0 ? "#52c41a" : "#8c8c8c" }}>
                {totalStock} units
              </Text>
              {isLowStock && (
                <Tooltip title="Low stock alert">
                  <AlertOutlined style={{ color: "#ff4d4f" }} />
                </Tooltip>
              )}
            </Space>
            {record.alert_quantity && (
              <Text type="secondary" style={{ fontSize: "12px" }}>
                Alert: {record.alert_quantity}
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: "Serials",
      key: "serials",
      render: (_, record) => {
        const availableSerials = record.serials?.filter((s) => s.status === "available").length || 0;
        const totalSerials = record.serials?.length || 0;

        if (totalSerials === 0) {
          return <Text type="secondary">No serials</Text>;
        }

        return (
          <Tooltip title={`${availableSerials} available out of ${totalSerials} total`}>
            <Badge count={totalSerials} showZero color={availableSerials > 0 ? "green" : "red"}>
              <BarcodeOutlined />
            </Badge>
          </Tooltip>
        );
      },
    },
    {
      title: "Details",
      key: "details",
      render: (_, record) => (
        <Space direction="vertical" size="small">
          {record.warranty_period && (
            <Tag color="blue">Warranty: {record.warranty_period}m</Tag>
          )}
          {record.VariantAttribute && record.VariantAttribute.length > 0 && (
            <Tag color="purple">Attributes: {record.VariantAttribute.length}</Tag>
          )}
        </Space>
      ),
    },
  ];

  if (variants.length === 0) {
    return <Text type="secondary">No variants available</Text>;
  }

  return (
    <Table
      dataSource={variants}
      columns={variantColumns}
      rowKey="id"
      pagination={false}
      size="small"
      scroll={{ x: 1000 }}
    />
  );
};

export default VariantsTab;