import { AlertOutlined, BarcodeOutlined, CalendarOutlined, ShopOutlined } from "@ant-design/icons";
import { Badge, Space, Table, Tag, Tooltip, Typography, Image, Collapse } from "antd";
import { formatCurrency, formatDate } from "../../../utils/formatters";

const { Text } = Typography;
const { Panel } = Collapse;

interface VariantsTabProps {
  variants: any[];
}

const VariantsTab: React.FC<VariantsTabProps> = ({ variants }) => {
  const variantColumns = [    {
      title: "Image",
      dataIndex: "image",
      key: "image",
      width: 80,
      render: (image: string) => (
        <Image
          src={image || "https://placehold.co/50x50?text=No+Image"}
          alt="Variant"
          width={50}
          height={50}
          style={{ objectFit: "cover", borderRadius: "4px" }}
          fallback="https://placehold.co/50x50?text=No+Image"
        />
      ),
    },
    {
      title: "Variant Details",
      key: "details",
      render: (_, record) => (
        <Space direction="vertical" size="small">
          <Space>
            {record.is_default && <Badge status="success" text="Default" />}
            <Text strong={record.is_default}>{record.name}</Text>
          </Space>
          {record.sku && (
            <Text type="secondary" style={{ fontSize: "12px" }}>
              SKU: <Text code>{record.sku}</Text>
            </Text>
          )}
          {record.barcode && (
            <Text type="secondary" style={{ fontSize: "12px" }}>
              Barcode: <Text code>{record.barcode}</Text>
            </Text>
          )}
          {record.warranty_period && (
            <Tag color="blue" style={{ fontSize: "11px" }}>
              Warranty: {record.warranty_period} months
            </Tag>
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
          {record.wholesale_price && (
            <div>
              <Text type="secondary">Wholesale: </Text>
              <Text type="secondary">{formatCurrency(parseFloat(record.wholesale_price))}</Text>
            </div>
          )}
          {record.price_history && record.price_history.length > 0 && (
            <Tooltip title="Price updated recently">
              <Tag color="green" style={{ fontSize: "10px" }}>
                <CalendarOutlined /> Updated
              </Tag>
            </Tooltip>
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
      title: "Stock & Inventory",
      key: "stock",
      render: (_, record) => {
        const totalStock = record.inventory_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
        const isLowStock = record.alert_quantity && totalStock <= record.alert_quantity;
        const stockByBranch = record.inventory_items?.reduce((acc, item) => {
          const branchName = item.branch?.name || 'Main';
          acc[branchName] = (acc[branchName] || 0) + item.quantity;
          return acc;
        }, {}) || {};

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
            )}            {Object.keys(stockByBranch).length > 1 && (
              <Tooltip 
                title={
                  <div>
                    {Object.entries(stockByBranch).map(([branch, qty]) => (
                      <div key={branch}>{branch}: {qty as number} units</div>
                    ))}
                  </div>
                }
              >
                <Tag icon={<ShopOutlined />} style={{ fontSize: "10px" }}>
                  {Object.keys(stockByBranch).length} branches
                </Tag>
              </Tooltip>
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
        const soldSerials = record.serials?.filter((s) => s.status === "sold").length || 0;
        const defectiveSerials = record.serials?.filter((s) => s.status === "defective").length || 0;
        const returnedSerials = record.serials?.filter((s) => s.status === "returned").length || 0;
        const totalSerials = record.serials?.length || 0;

        if (totalSerials === 0) {
          return <Text type="secondary">No serials</Text>;
        }

        return (
          <Space direction="vertical" size="small">
            <Tooltip 
              title={
                <div>
                  <div>Available: {availableSerials}</div>
                  <div>Sold: {soldSerials}</div>
                  {defectiveSerials > 0 && <div>Defective: {defectiveSerials}</div>}
                  {returnedSerials > 0 && <div>Returned: {returnedSerials}</div>}
                </div>
              }
            >
              <Badge count={totalSerials} showZero color={availableSerials > 0 ? "green" : "red"}>
                <BarcodeOutlined />
              </Badge>
            </Tooltip>
            <Text style={{ fontSize: "10px" }} type="secondary">
              {availableSerials}/{totalSerials} available
            </Text>
          </Space>
        );
      },
    },
    {
      title: "Attributes",
      key: "attributes",
      render: (_, record) => {
        if (!record.VariantAttribute || record.VariantAttribute.length === 0) {
          return <Text type="secondary">No attributes</Text>;
        }

        return (
          <Tooltip 
            title={
              <div>
                {record.VariantAttribute.map((attr, index) => (
                  <div key={index}>{attr.name}: {attr.value}</div>
                ))}
              </div>
            }
          >
            <Tag color="purple">
              {record.VariantAttribute.length} attribute{record.VariantAttribute.length > 1 ? 's' : ''}
            </Tag>
          </Tooltip>
        );
      },
    },
  ];
  // Expandable row render function
  const expandedRowRender = (record: any) => {
    const stockByBranch = record.inventory_items?.reduce((acc: Record<string, number>, item: any) => {
      const branchName = item.branch?.name || 'Main';
      acc[branchName] = (acc[branchName] || 0) + item.quantity;
      return acc;
    }, {}) || {};

    const expiringItems = record.inventory_items?.filter((item: any) => {
      if (!item.expiry_date) return false;
      const expiryDate = new Date(item.expiry_date);
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      return expiryDate <= thirtyDaysFromNow;
    }) || [];

    return (
      <Collapse size="small" ghost>
        {Object.keys(stockByBranch).length > 0 && (
          <Panel header={`Stock by Branch (${Object.keys(stockByBranch).length})`} key="stock">            <Space wrap>
              {Object.entries(stockByBranch).map(([branch, qty]) => (
                <Tag key={branch} icon={<ShopOutlined />}>
                  {branch}: {qty as number} units
                </Tag>
              ))}
            </Space>
          </Panel>
        )}

        {record.VariantAttribute && record.VariantAttribute.length > 0 && (
          <Panel header={`Attributes (${record.VariantAttribute.length})`} key="attributes">
            <Space wrap>
              {record.VariantAttribute.map((attr, index) => (
                <Tag key={index} color="blue">
                  {attr.name}: {attr.value}
                </Tag>
              ))}
            </Space>
          </Panel>
        )}

        {record.price_history && record.price_history.length > 0 && (
          <Panel header="Recent Price Changes" key="pricing">
            <Space direction="vertical" size="small">
              {record.price_history.slice(0, 3).map((priceRecord, index) => (
                <div key={index}>
                  <Text style={{ fontSize: "12px" }}>
                    <CalendarOutlined /> {formatDate(priceRecord.effective_date)} - 
                    Regular: {formatCurrency(parseFloat(priceRecord.regular_price))}, 
                  </Text>
                </div>
              ))}
            </Space>
          </Panel>
        )}

        {expiringItems.length > 0 && (
          <Panel header={`Expiring Stock (${expiringItems.length})`} key="expiring">
            <Space direction="vertical" size="small">
              {expiringItems.map((item, index) => (
                <Tag key={index} color="orange">
                  {item.branch?.name || 'Main'}: {item.quantity} units - 
                  Expires: {formatDate(item.expiry_date)}
                  {item.batch_number && ` (Batch: ${item.batch_number})`}
                </Tag>
              ))}
            </Space>
          </Panel>
        )}
      </Collapse>
    );
  };

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
      scroll={{ x: 1200 }}
      expandable={{
        expandedRowRender,
        rowExpandable: (record) => 
          (record.inventory_items && record.inventory_items.length > 0) ||
          (record.VariantAttribute && record.VariantAttribute.length > 0) ||
          (record.price_history && record.price_history.length > 0),
      }}
    />
  );
};

export default VariantsTab;