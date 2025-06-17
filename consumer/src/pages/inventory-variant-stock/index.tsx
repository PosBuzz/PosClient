import {
  ArrowLeftOutlined,
  CalendarOutlined,
  DollarOutlined,
  ShopOutlined,
  WarningOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  Descriptions,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { inventoryApi, InventoryBatch } from "../../api/inventory-api";
import CenterLoader from "../../components/CenterLoader";
import PageTitle from "../../components/PageTitle";
import { queryKeys } from "../../constants/queryKeys";
import useDarkMode from "../../hooks/useDarkMode";
import { setPageTitle } from "../../utils/setPageTitle";

const { Text } = Typography;
const { Option } = Select;

interface VariantStockData {
  variant: {
    id: number;
    name: string;
    sku?: string;
    alert_quantity?: number;
    product: {
      id: number;
      name: string;
    };
  };
  total_stock: number;
  is_low_stock: boolean;
  stock_by_branch: Record<string, number>;
  batches: (InventoryBatch & {
    branch: {
      id: number;
      name: string;
      is_main: boolean;
    };
    vendor?: {
      id: number;
      name: string;
    };
  })[];
}

export default function VariantStockPage() {
  const navigate = useNavigate();
  const { id: variantId } = useParams<{ id: string }>();
  const [selectedBranch, setSelectedBranch] = useState<number | undefined>();
  const isDarkMode = useDarkMode();

  // Queries
  const { data: variantStock, isLoading: stockLoading } = useQuery({
    queryKey: [queryKeys.variantStock, variantId, selectedBranch],
    queryFn: () =>
      inventoryApi.getVariantStock(parseInt(variantId!), {
        branch_id: selectedBranch,
      }),
    enabled: !!variantId,
    staleTime: 3600 * 1000,
  });

  const { data: branches = [] } = useQuery({
    queryKey: [queryKeys.branches],
    queryFn: () => inventoryApi.getBranches(),
    staleTime: 3600 * 1000,
  });

  if (stockLoading) {
    return <CenterLoader />;
  }

  if (!variantStock) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Text type="secondary">Variant stock data not found</Text>
      </div>
    );
  }

  const stockData: VariantStockData = variantStock;

  // Process branch data from stock_by_branch and batches
  const branchesData = Object.entries(stockData.stock_by_branch).map(
    ([branchName, stock]) => {
      const branchBatches = stockData.batches.filter(
        (batch) => batch.branch.name === branchName
      );
      const branchValue = branchBatches.reduce(
        (sum, batch) => sum + parseFloat(batch.cost_price) * batch.quantity,
        0
      );

      return {
        name: branchName,
        stock,
        value: branchValue,
        batches: branchBatches,
      };
    }
  );

  // Calculate total value from batches
  const totalValue = stockData.batches.reduce(
    (sum, batch) => sum + parseFloat(batch.cost_price) * batch.quantity,
    0
  );

  const getExpiryStatus = (expiryDate: string) => {
    if (!expiryDate) return null;
    const now = dayjs();
    const expiry = dayjs(expiryDate);
    const daysUntilExpiry = expiry.diff(now, "days");

    if (daysUntilExpiry < 0) {
      return { color: "red", text: "Expired" };
    } else if (daysUntilExpiry <= 7) {
      return { color: "red", text: `${daysUntilExpiry}d left` };
    } else if (daysUntilExpiry <= 30) {
      return { color: "orange", text: `${daysUntilExpiry}d left` };
    }
    return null;
  };

  const getStockHealthColor = () => {
    if (stockData.is_low_stock) return "#ff4d4f";
    if (stockData.total_stock > 0) return "#52c41a";
    return isDarkMode ? "#595959" : "#8c8c8c";
  };

  const getStockHealthPercent = () => {
    if (!stockData.variant.alert_quantity) return 100;
    return Number(
      Math.min(
        (stockData.total_stock / stockData.variant.alert_quantity) * 100,
        100
      ).toPrecision(4)
    );
  };

  // Filter batches based on selected branch
  const displayBatches = selectedBranch
    ? stockData.batches.filter((batch) => batch.branch.id === selectedBranch)
    : stockData.batches;

  const batchColumns: ColumnsType<VariantStockData["batches"][0]> = [
    {
      title: "Batch Reference",
      dataIndex: "batch_number",
      key: "batch_number",
      render: (text) => <Text code>{text}</Text>,
    },
    {
      title: "Branch",
      key: "branch",
      render: (_, record) => (
        <Space>
          <ShopOutlined />
          <Tag
            color={
              record.branch.name.toLowerCase() === "warehouse"
                ? "default"
                : "blue"
            }
          >
            {record.branch.name}
          </Tag>
        </Space>
      ),
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      align: "right",
      render: (quantity) => <Text strong>{quantity} units</Text>,
    },
    {
      title: "Cost Price",
      dataIndex: "cost_price",
      key: "cost_price",
      align: "right",
      render: (price) => (
        <Space>
          <DollarOutlined />
          <Text>${parseFloat(price).toFixed(2)}</Text>
        </Space>
      ),
    },
    {
      title: "Total Value",
      key: "total_value",
      align: "right",
      render: (_, record) => (
        <Text strong>
          ${(parseFloat(record.cost_price) * record.quantity).toFixed(2)}
        </Text>
      ),
    },
    {
      title: "Vendor",
      key: "vendor",
      render: (_, record) => record.vendor?.name || "-",
    },
    {
      title: "Expiry Date",
      dataIndex: "expiry_date",
      key: "expiry_date",
      render: (date) => {
        if (!date) return <Text type="secondary">No expiry</Text>;

        const status = getExpiryStatus(date);
        return (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <CalendarOutlined />
              <Text>{dayjs(date).format("MMM DD, YYYY")}</Text>
            </div>
            {status && (
              <Tag
                color={status.color}
                style={{ marginTop: 4 }}
                icon={status.color === "red" ? <WarningOutlined /> : undefined}
              >
                {status.text}
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created_at",
      render: (date) => dayjs(date).format("MMM DD, YYYY"),
    },
  ];

  const getCardStyle = () => ({
    backgroundColor: isDarkMode ? "#1f1f1f" : "#ffffff",
    borderColor: isDarkMode ? "#303030" : "#d9d9d9",
  });

  const getOutOfStockStyle = () => ({
    opacity: 0.6,
    backgroundColor: isDarkMode ? "#262626" : "#f5f5f5",
  });

  return (
    <>
      {setPageTitle("Variant Stock Details")}
      <PageTitle
        title={`${stockData.variant.product.name} - ${stockData.variant.name}`}
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Inventory", href: "/inventory" },
          { title: "Stock by Variant", href: "/inventory/stock-by-variant" },
          { title: "Variant Stock" },
        ]}
        rightSection={
          <Space>
            <Button
              type="default"
              icon={<HistoryOutlined />}
              onClick={() =>
                navigate(`/inventory/movement-history/${variantId}`)
              }
            >
              Movement History
            </Button>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/inventory/stock-by-variant")}
            >
              Back to Stock by Variant
            </Button>
          </Space>
        }
      />

      {/* Variant Information */}
      <Card
        title="Variant Information"
        style={{ marginBottom: 24, ...getCardStyle() }}
      >
        <Descriptions column={2} bordered>
          <Descriptions.Item label="Product">
            {stockData.variant.product.name}
          </Descriptions.Item>
          <Descriptions.Item label="Variant">
            {stockData.variant.name}
          </Descriptions.Item>
          {stockData.variant.sku && (
            <Descriptions.Item label="SKU">
              <Text code>{stockData.variant.sku}</Text>
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Alert Threshold">
            {stockData.variant.alert_quantity ? (
              `${stockData.variant.alert_quantity} units`
            ) : (
              <Text type="secondary">Not set</Text>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Stock Summary */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card style={getCardStyle()}>
            <Statistic
              title="Total Stock"
              value={stockData.total_stock}
              suffix="units"
              valueStyle={{ color: getStockHealthColor() }}
              prefix={stockData.is_low_stock ? <WarningOutlined /> : undefined}
            />
            {!stockData.variant.alert_quantity || (
              <Progress
                percent={getStockHealthPercent()}
                strokeColor={getStockHealthColor()}
                size="small"
                style={{ marginTop: 8 }}
              />
            )}
          </Card>
        </Col>
        <Col span={6}>
          <Card style={getCardStyle()}>
            <Statistic
              title="Total Value"
              value={totalValue}
              prefix="$"
              precision={2}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={getCardStyle()}>
            <Statistic
              title="Branches"
              value={branchesData.filter((b) => b.stock > 0).length}
              suffix={`/ ${branchesData.length}`}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={getCardStyle()}>
            <Statistic
              title="Status"
              value={
                stockData.is_low_stock
                  ? "Low Stock"
                  : stockData.total_stock > 0
                  ? "In Stock"
                  : "Out of Stock"
              }
              valueStyle={{
                color: stockData.is_low_stock
                  ? "#ff4d4f"
                  : stockData.total_stock > 0
                  ? "#52c41a"
                  : getStockHealthColor(),
                fontSize: "16px",
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* Branch Summary */}
      <Card
        title="Stock by Branch"
        style={{ marginBottom: 24, ...getCardStyle() }}
      >
        <Row gutter={16}>
          {branchesData.map((branch, index) => (
            <Col
              key={`${branch.name}-${index}`}
              span={6}
              style={{ marginBottom: 16 }}
            >
              <Card
                size="small"
                style={
                  branch.stock === 0 ? getOutOfStockStyle() : getCardStyle()
                }
              >
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      marginBottom: 8,
                    }}
                  >
                    <ShopOutlined />
                    <Text strong>{branch.name}</Text>
                  </div>
                  <div
                    style={{
                      fontSize: "20px",
                      fontWeight: "bold",
                      color:
                        branch.stock > 0 ? "#52c41a" : getStockHealthColor(),
                    }}
                  >
                    {branch.stock} units
                  </div>
                  <Text type="secondary" style={{ fontSize: "12px" }}>
                    Value: ${branch.value.toFixed(2)}
                  </Text>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Filters for batches */}
      <Card
        title="Inventory Batches"
        style={{ marginBottom: 24, ...getCardStyle() }}
      >
        <Row style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Select
              placeholder="All Branches"
              style={{ width: "100%" }}
              value={selectedBranch}
              onChange={setSelectedBranch}
              allowClear
            >
              {branches.map((branch) => (
                <Option key={branch.id} value={branch.id}>
                  {branch.name}
                </Option>
              ))}
            </Select>
          </Col>
        </Row>

        <Table
          columns={batchColumns}
          dataSource={displayBatches}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} batches`,
          }}
          scroll={{ x: 1000 }}
          summary={() => (
            <Table.Summary>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={2}>
                  <Text strong>Total</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2}>
                  <Text strong>
                    {displayBatches.reduce(
                      (sum, batch) => sum + batch.quantity,
                      0
                    )}{" "}
                    units
                  </Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3}></Table.Summary.Cell>
                <Table.Summary.Cell index={4}>
                  <Text strong>
                    $
                    {displayBatches
                      .reduce(
                        (sum, batch) =>
                          sum + parseFloat(batch.cost_price) * batch.quantity,
                        0
                      )
                      .toFixed(2)}
                  </Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} colSpan={3}></Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>
    </>
  );
}
