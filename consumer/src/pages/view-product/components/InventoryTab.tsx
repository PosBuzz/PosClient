import { ShopOutlined, CalendarOutlined, AlertOutlined } from "@ant-design/icons";
import { Table, Tag, Typography, Space, Progress, Tooltip } from "antd";
import { formatDate } from "../../../utils/formatters";

const { Text } = Typography;

interface InventoryTabProps {
  product: any;
}

const InventoryTab: React.FC<InventoryTabProps> = ({ product }) => {
  // Flatten all inventory items from all variants
  const allInventoryItems = product.variants?.flatMap((variant) =>
    variant.inventory_items?.map((item) => ({
      ...item,
      variant_name: variant.name,
      variant_id: variant.id,
      alert_quantity: variant.alert_quantity,
    })) || []
  ) || [];

  const inventoryColumns = [
    {
      title: "Variant",
      key: "variant",
      render: (_, record) => (
        <Text strong>{record.variant_name}</Text>
      ),
    },
    {
      title: "Branch",
      key: "branch",
      render: (_, record) => (
        <Space>
          <ShopOutlined />
          <Text>{record.branch?.name || "Main Branch"}</Text>
          {record.branch?.is_main && <Tag color="green" size="small">Main</Tag>}
        </Space>
      ),
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      render: (quantity, record) => {
        const isLowStock = record.alert_quantity && quantity <= record.alert_quantity;
        return (
          <Space>
            <Text style={{ color: isLowStock ? "#ff4d4f" : quantity > 0 ? "#52c41a" : "#8c8c8c" }}>
              {quantity} units
            </Text>
            {isLowStock && (
              <Tooltip title="Low stock alert">
                <AlertOutlined style={{ color: "#ff4d4f" }} />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: "Stock Level",
      key: "stock_level",
      render: (_, record) => {
        if (!record.alert_quantity) return <Text type="secondary">No alert set</Text>;
        
        const percentage = Math.min((record.quantity / (record.alert_quantity * 2)) * 100, 100);
        const status = percentage <= 50 ? 'exception' : percentage <= 75 ? 'active' : 'success';
        
        return (
          <Tooltip title={`Alert threshold: ${record.alert_quantity} units`}>
            <Progress 
              percent={percentage} 
              size="small" 
              status={status}
              showInfo={false}
              style={{ width: 80 }}
            />
          </Tooltip>
        );
      },
    },
    {
      title: "Batch Number",
      dataIndex: "batch_number",
      key: "batch_number",
      render: (batchNumber) => (
        batchNumber ? <Text code>{batchNumber}</Text> : <Text type="secondary">-</Text>
      ),
    },
    {
      title: "Expiry Date",
      dataIndex: "expiry_date",
      key: "expiry_date",
      render: (expiryDate) => {
        if (!expiryDate) return <Text type="secondary">No expiry</Text>;
        
        const expiry = new Date(expiryDate);
        const now = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(now.getDate() + 30);
        
        const isExpired = expiry <= now;
        const isExpiringSoon = expiry <= thirtyDaysFromNow && expiry > now;
        
        return (
          <Space>
            <Text 
              type={isExpired ? "danger" : isExpiringSoon ? "warning" : undefined}
            >
              {formatDate(expiryDate)}
            </Text>
            {isExpired && <Tag color="red">Expired</Tag>}
            {isExpiringSoon && <Tag color="orange">Expiring Soon</Tag>}
          </Space>
        );
      },
    },
    {
      title: "Vendor",
      key: "vendor",
      render: (_, record) => {
        if (!record.vendor) return <Text type="secondary">No vendor</Text>;
        
        return (
          <Tooltip title={`Contact: ${record.vendor.contact || 'N/A'}, Phone: ${record.vendor.phone || 'N/A'}`}>
            <Text>{record.vendor.name}</Text>
          </Tooltip>
        );
      },
    },
    {
      title: "Added Date",
      dataIndex: "created_at",
      key: "created_at",
      render: (date) => (
        <Space>
          <CalendarOutlined />
          <Text style={{ fontSize: "12px" }}>{formatDate(date)}</Text>
        </Space>
      ),
    },
  ];

  if (allInventoryItems.length === 0) {
    return <Text type="secondary">No inventory records available</Text>;
  }

  // Calculate summary statistics
  const totalStock = allInventoryItems.reduce((sum, item) => sum + item.quantity, 0);
  const lowStockItems = allInventoryItems.filter(item => 
    item.alert_quantity && item.quantity <= item.alert_quantity
  ).length;
  const expiringItems = allInventoryItems.filter(item => {
    if (!item.expiry_date) return false;
    const expiryDate = new Date(item.expiry_date);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expiryDate <= thirtyDaysFromNow;
  }).length;
  const branches = [...new Set(allInventoryItems.map(item => item.branch?.name || 'Main'))].length;

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      {/* Summary Cards */}
      <Space wrap>
        <Tag color="blue" style={{ padding: "4px 8px" }}>
          Total Stock: {totalStock} units
        </Tag>
        <Tag color="green" style={{ padding: "4px 8px" }}>
          Branches: {branches}
        </Tag>
        {lowStockItems > 0 && (
          <Tag color="red" style={{ padding: "4px 8px" }}>
            Low Stock: {lowStockItems} items
          </Tag>
        )}
        {expiringItems > 0 && (
          <Tag color="orange" style={{ padding: "4px 8px" }}>
            Expiring: {expiringItems} items
          </Tag>
        )}
      </Space>

      {/* Inventory Table */}
      <Table
        dataSource={allInventoryItems}
        columns={inventoryColumns}
        rowKey={(record) => `${record.variant_id}-${record.branch?.id || 'main'}-${record.batch_number || 'no-batch'}`}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        size="small"
        scroll={{ x: 1000 }}
      />
    </Space>
  );
};

export default InventoryTab;