import {
  AuditOutlined,
  DownloadOutlined,
  ReloadOutlined,
  SearchOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Empty,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useState } from "react";
import { inventoryApi } from "../../api/inventory-api";
import { productApi } from "../../api/product-api";
import { productAuditApi } from "../../api/product-audit-api";
import { salesApi } from "../../api/sales-api";
import CenterLoader from "../../components/CenterLoader";
import PageTitle from "../../components/PageTitle";
import { queryKeys } from "../../constants/queryKeys";
import { setPageTitle } from "../../utils/setPageTitle";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

// ── helpers ──────────────────────────────────────────────────────────────────
const fmtNum = (n: number | string | null | undefined, dec = 2) => {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
};

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  return dayjs(d).format("DD MMM YYYY");
};

const fmtDateTime = (d: string | null | undefined) => {
  if (!d) return "—";
  return dayjs(d).format("DD MMM YYYY HH:mm");
};

const ExpiryTag = ({ date }: { date: string | null | undefined }) => {
  if (!date) return <Text type="secondary">No Expiry</Text>;
  const days = dayjs(date).diff(dayjs(), "day");
  if (days < 0) return <Tag color="red">Expired ({fmtDate(date)})</Tag>;
  if (days <= 30) return <Tag color="orange">{fmtDate(date)} ({days}d left)</Tag>;
  return <Tag color="green">{fmtDate(date)}</Tag>;
};

// ── Product & Variant selectors ───────────────────────────────────────────────

interface SelectorProps {
  selectedVariantId: number | undefined;
  onVariantSelect: (variantId: number) => void;
}

const ProductVariantSelector: React.FC<SelectorProps> = ({
  selectedVariantId,
  onVariantSelect,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<number | undefined>();
  const [productSearch, setProductSearch] = useState("");

  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: [queryKeys.products, "audit-search", productSearch],
    queryFn: () => productApi.getProducts({ search: productSearch || undefined, limit: 60 }),
    staleTime: 60_000,
  });

  const { data: variantsData, isLoading: loadingVariants } = useQuery({
    queryKey: ["audit-variants", selectedProductId],
    queryFn: () => inventoryApi.getVariants(selectedProductId!),
    enabled: !!selectedProductId,
    staleTime: 60_000,
  });

  const products = productsData?.data ?? [];
  const variants: any[] = variantsData ?? [];

  return (
    <Row gutter={12}>
      <Col xs={24} sm={12}>
        <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
          Product
        </label>
        <Select
          showSearch
          filterOption={false}
          onSearch={setProductSearch}
          style={{ width: "100%" }}
          placeholder="Search and select product…"
          loading={loadingProducts}
          onChange={(val) => {
            setSelectedProductId(val);
            onVariantSelect(undefined as any);
          }}
          value={selectedProductId}
        >
          {products.map((p: any) => (
            <Option key={p.id} value={p.id}>
              {p.name}
              {p.code ? ` (${p.code})` : ""}
            </Option>
          ))}
        </Select>
      </Col>
      <Col xs={24} sm={12}>
        <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
          Variant
        </label>
        <Select
          style={{ width: "100%" }}
          placeholder="Select variant…"
          loading={loadingVariants}
          disabled={!selectedProductId}
          onChange={onVariantSelect}
          value={selectedVariantId}
        >
          {variants.map((v: any) => (
            <Option key={v.id} value={v.id}>
              {v.name}
              {v.sku ? ` — ${v.sku}` : ""}
            </Option>
          ))}
        </Select>
      </Col>
    </Row>
  );
};

// ── Summary card row ──────────────────────────────────────────────────────────

const SummaryCards = ({ data }: { data: any }) => {
  const ss = data.sales_summary;
  const ps = data.purchases_summary;
  const rs = data.returns_summary;
  const stock = data.stock_snapshot;

  return (
    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
      <Col xs={12} sm={6}>
        <Card size="small">
          <Statistic title="Current Stock" value={stock.total_current_stock} suffix="units" />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small">
          <Statistic title="Active Batches" value={stock.total_active_batches} />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small">
          <Statistic
            title="Expiring ≤ 30 Days"
            value={stock.batches_expiring_within_30_days}
            valueStyle={stock.batches_expiring_within_30_days > 0 ? { color: "#d46b08" } : undefined}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small">
          <Statistic
            title="Units Sold (Period)"
            value={ss.total_units_sold}
            suffix="units"
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small">
          <Statistic
            title="Net Revenue"
            value={fmtNum(ss.total_revenue)}
            prefix=""
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small">
          <Statistic
            title="Total Discount Given"
            value={fmtNum(ss.total_discount)}
            valueStyle={ss.total_discount > 0 ? { color: "#cf1322" } : undefined}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small">
          <Statistic title="Purchased (Period)" value={ps.total_units_purchased} suffix="units" />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small">
          <Statistic title="Units Returned" value={rs.total_units_returned} suffix="units" />
        </Card>
      </Col>
    </Row>
  );
};

// ── Section: Product Info ─────────────────────────────────────────────────────

const ProductInfoTab = ({ data }: { data: any }) => {
  const v = data.meta.variant;
  return (
    <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
      <Descriptions.Item label="Product">{v.product.name}</Descriptions.Item>
      <Descriptions.Item label="Product Code">{v.product.code ?? "—"}</Descriptions.Item>
      <Descriptions.Item label="Variant">{v.name}</Descriptions.Item>
      <Descriptions.Item label="SKU">{v.sku ?? "—"}</Descriptions.Item>
      <Descriptions.Item label="Barcode">{v.barcode ?? "—"}</Descriptions.Item>
      <Descriptions.Item label="Category">{v.product.category?.name ?? "—"}</Descriptions.Item>
      <Descriptions.Item label="Brand">{v.product.brand?.name ?? "—"}</Descriptions.Item>
      <Descriptions.Item label="Sale Unit">{v.sale_unit?.name ?? "—"}</Descriptions.Item>
      <Descriptions.Item label="Regular Price">{fmtNum(v.regular_price)}</Descriptions.Item>
      <Descriptions.Item label="Wholesale Price">
        {v.wholesale_price ? fmtNum(v.wholesale_price) : "—"}
      </Descriptions.Item>
      <Descriptions.Item label="Tax">
        {v.product.tax}% ({v.product.tax_method})
      </Descriptions.Item>
      <Descriptions.Item label="Low Stock Alert">
        {v.alert_quantity ?? "—"}
      </Descriptions.Item>
      {v.attributes?.length > 0 && (
        <Descriptions.Item label="Attributes" span={2}>
          {v.attributes.map((a: any) => (
            <Tag key={a.id}>{a.name}: {a.value}</Tag>
          ))}
        </Descriptions.Item>
      )}
    </Descriptions>
  );
};

// ── Section: Stock Snapshot ───────────────────────────────────────────────────

const StockSnapshotTab = ({ data }: { data: any }) => {
  const batches: any[] = data.stock_snapshot.batches;
  const columns: ColumnsType<any> = [
    { title: "Batch No.", dataIndex: "batch_number", key: "batch_number", width: 120 },
    { title: "Branch", dataIndex: ["branch", "name"], key: "branch", width: 120 },
    {
      title: "Vendor",
      key: "vendor",
      width: 120,
      render: (_, r) => r.vendor?.name ?? "—",
    },
    { title: "Qty", dataIndex: "quantity", key: "quantity", align: "right", width: 70 },
    {
      title: "Cost Price",
      dataIndex: "cost_price",
      key: "cost_price",
      align: "right",
      width: 100,
      render: (v) => fmtNum(v),
    },
    {
      title: "Stock Value",
      key: "stock_value",
      align: "right",
      width: 110,
      render: (_, r) => fmtNum(Number(r.cost_price) * r.quantity),
    },
    {
      title: "Expiry",
      key: "expiry",
      width: 150,
      render: (_, r) => <ExpiryTag date={r.expiry_date} />,
    },
    {
      title: "Received On",
      key: "received",
      width: 120,
      render: (_, r) => fmtDate(r.created_at),
    },
  ];
  return (
    <Table
      dataSource={batches}
      columns={columns}
      rowKey="id"
      size="small"
      pagination={false}
      scroll={{ x: 900 }}
    />
  );
};

// ── Section: Purchases ────────────────────────────────────────────────────────

const PurchasesTab = ({ data }: { data: any }) => {
  const ps = data.purchases_summary;
  const purchases: any[] = data.purchases;

  const columns: ColumnsType<any> = [
    {
      title: "Date",
      key: "date",
      width: 110,
      render: (_, r) => fmtDate(r.date),
    },
    { title: "Batch No.", dataIndex: "batch_number", key: "batch_number", width: 120 },
    { title: "Vendor", key: "vendor", width: 130, render: (_, r) => r.vendor?.name ?? "—" },
    { title: "Branch", key: "branch", width: 110, render: (_, r) => r.branch?.name ?? "—" },
    { title: "Qty Rcvd", dataIndex: "original_quantity", key: "original_quantity", align: "right", width: 80 },
    { title: "Remaining", dataIndex: "remaining_quantity", key: "remaining_quantity", align: "right", width: 85 },
    {
      title: "Unit Cost",
      dataIndex: "cost_price",
      key: "cost_price",
      align: "right",
      width: 100,
      render: (v) => fmtNum(v),
    },
    {
      title: "Total Cost",
      dataIndex: "total_cost",
      key: "total_cost",
      align: "right",
      width: 110,
      render: (v) => fmtNum(v),
    },
    {
      title: "Expiry",
      key: "expiry",
      width: 130,
      render: (_, r) => <ExpiryTag date={r.expiry_date} />,
    },
  ];

  return (
    <>
      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col>
          <Card size="small">
            <Statistic title="Batches Received" value={ps.total_batches} />
          </Card>
        </Col>
        <Col>
          <Card size="small">
            <Statistic title="Total Units" value={ps.total_units_purchased} />
          </Card>
        </Col>
        <Col>
          <Card size="small">
            <Statistic title="Total Cost" value={fmtNum(ps.total_cost)} />
          </Card>
        </Col>
      </Row>
      <Table
        dataSource={purchases}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ x: 800 }}
        locale={{ emptyText: "No purchases in the selected period" }}
      />
    </>
  );
};

// ── Section: Adjustments ─────────────────────────────────────────────────────

const AdjustmentsTab = ({ data }: { data: any }) => {
  const as_ = data.adjustments_summary;
  const adjustments: any[] = data.adjustments;

  const columns: ColumnsType<any> = [
    { title: "Date", key: "date", width: 110, render: (_, r) => fmtDateTime(r.date) },
    {
      title: "Type",
      key: "type",
      width: 90,
      render: (_, r) =>
        r.type === "addition" ? (
          <Tag color="green">Addition</Tag>
        ) : (
          <Tag color="red">Reduction</Tag>
        ),
    },
    {
      title: "Qty Change",
      key: "qty_change",
      align: "right",
      width: 100,
      render: (_, r) => (
        <Text type={r.quantity_change > 0 ? "success" : "danger"}>
          {r.quantity_change > 0 ? "+" : ""}
          {r.quantity_change}
        </Text>
      ),
    },
    { title: "Batch", key: "batch", width: 110, render: (_, r) => r.batch?.batch_number ?? "—" },
    { title: "Branch", key: "branch", width: 110, render: (_, r) => r.branch?.name ?? "—" },
    { title: "Reason", dataIndex: "reason", key: "reason", width: 150 },
    { title: "Notes", dataIndex: "notes", key: "notes", width: 150, render: (v) => v ?? "—" },
    {
      title: "Done By",
      key: "done_by",
      width: 120,
      render: (_, r) => r.created_by?.name ?? "—",
    },
  ];

  return (
    <>
      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col>
          <Card size="small">
            <Statistic title="Total Additions" value={as_.total_additions} valueStyle={{ color: "#389e0d" }} />
          </Card>
        </Col>
        <Col>
          <Card size="small">
            <Statistic title="Total Reductions" value={as_.total_reductions} valueStyle={{ color: "#cf1322" }} />
          </Card>
        </Col>
        <Col>
          <Card size="small">
            <Statistic
              title="Net Change"
              value={as_.total_additions - as_.total_reductions}
              valueStyle={{ color: as_.total_additions - as_.total_reductions >= 0 ? "#389e0d" : "#cf1322" }}
            />
          </Card>
        </Col>
      </Row>
      <Table
        dataSource={adjustments}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 20 }}
        scroll={{ x: 900 }}
        locale={{ emptyText: "No adjustments in the selected period" }}
      />
    </>
  );
};

// ── Section: Transfers ────────────────────────────────────────────────────────

const TransfersTab = ({ data }: { data: any }) => {
  const transfers: any[] = data.transfers;

  const columns: ColumnsType<any> = [
    {
      title: "Initiated",
      key: "initiated",
      width: 110,
      render: (_, r) => fmtDate(r.initiated_at),
    },
    {
      title: "Completed",
      key: "completed",
      width: 110,
      render: (_, r) => fmtDate(r.completed_at),
    },
    {
      title: "Status",
      key: "status",
      width: 90,
      render: (_, r) => {
        const s = String(r.status).toLowerCase();
        const color = s === "completed" ? "green" : s === "cancelled" ? "red" : "orange";
        return <Tag color={color}>{String(r.status).toUpperCase()}</Tag>;
      },
    },
    {
      title: "From Branch",
      key: "from",
      width: 120,
      render: (_, r) => r.source_branch?.name ?? "—",
    },
    {
      title: "To Branch",
      key: "to",
      width: 120,
      render: (_, r) => r.destination_branch?.name ?? "—",
    },
    {
      title: "Units",
      key: "units",
      align: "right",
      width: 70,
      render: (_, r) => r.total_quantity,
    },
    {
      title: "Batches",
      key: "batches",
      width: 150,
      render: (_, r) =>
        r.items.map((i: any) => (
          <Tag key={i.batch_number} style={{ marginBottom: 2 }}>
            {i.batch_number} ({i.quantity})
          </Tag>
        )),
    },
    {
      title: "Initiated By",
      key: "by",
      width: 110,
      render: (_, r) => r.created_by?.name ?? "—",
    },
    { title: "Notes", dataIndex: "notes", key: "notes", width: 120, render: (v) => v ?? "—" },
  ];

  return (
    <Table
      dataSource={transfers}
      columns={columns}
      rowKey="id"
      size="small"
      pagination={{ pageSize: 20 }}
      scroll={{ x: 1000 }}
      locale={{ emptyText: "No transfers in the selected period" }}
    />
  );
};

// ── Section: Sales ────────────────────────────────────────────────────────────

const SalesTab = ({ data }: { data: any }) => {
  const ss = data.sales_summary;
  const sales: any[] = data.sales;

  const columns: ColumnsType<any> = [
    { title: "Date", key: "date", width: 100, render: (_, r) => fmtDate(r.date) },
    { title: "Sale No.", dataIndex: "sale_number", key: "sale_number", width: 120 },
    {
      title: "Price Type",
      key: "price_type",
      width: 90,
      render: (_, r) => (
        <Tag color={r.price_type === "wholesale" ? "purple" : "blue"}>
          {r.price_type === "wholesale" ? "Wholesale" : "Regular"}
        </Tag>
      ),
    },
    { title: "Qty", dataIndex: "quantity", key: "quantity", align: "right", width: 60 },
    {
      title: "Unit Price",
      key: "unit_price",
      align: "right",
      width: 90,
      render: (_, r) => fmtNum(r.unit_price),
    },
    {
      title: "Sold Price",
      key: "sold_price",
      align: "right",
      width: 90,
      render: (_, r) => fmtNum(r.sold_unit_price ?? r.unit_price),
    },
    {
      title: "Sp. Discount",
      key: "sp_disc",
      align: "right",
      width: 90,
      render: (_, r) => r.special_discount > 0 ? <Text type="danger">{fmtNum(r.special_discount)}</Text> : "—",
    },
    {
      title: "Cart Discount",
      key: "cart_disc",
      align: "right",
      width: 90,
      render: (_, r) => r.average_discount > 0 ? <Text type="danger">{fmtNum(r.average_discount)}</Text> : "—",
    },
    {
      title: "Promo Discount",
      key: "promo_disc",
      align: "right",
      width: 100,
      render: (_, r) =>
        r.promotion_discount > 0 ? (
          <Space>
            <Text type="danger">{fmtNum(r.promotion_discount)}</Text>
            {r.promotion && <Tag color="purple" style={{ fontSize: 10 }}>{r.promotion.name}</Tag>}
          </Space>
        ) : "—",
    },
    {
      title: "Line Total",
      key: "line_total",
      align: "right",
      width: 100,
      render: (_, r) => <Text strong>{fmtNum(r.line_total)}</Text>,
    },
    { title: "Branch", key: "branch", width: 100, render: (_, r) => r.branch?.name ?? "—" },
    {
      title: "Cashier",
      key: "cashier",
      width: 110,
      render: (_, r) => r.cashier?.name ?? "—",
    },
    {
      title: "Customer",
      key: "customer",
      width: 120,
      render: (_, r) => r.customer?.name ?? r.customer?.phone ?? "Walk-in",
    },
  ];

  return (
    <>
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {[
          { title: "Units Sold", value: ss.total_units_sold },
          { title: "Net Revenue", value: fmtNum(ss.total_revenue) },
          { title: "Gross Revenue", value: fmtNum(ss.gross_revenue) },
          { title: "Total Discount", value: fmtNum(ss.total_discount), color: "#cf1322" },
          { title: "Promo Discount", value: fmtNum(ss.total_promotion_discount), color: "#cf1322" },
          { title: "Regular Sales", value: ss.regular_price_sales_count },
          { title: "Wholesale Sales", value: ss.wholesale_price_sales_count },
        ].map((s) => (
          <Col key={s.title}>
            <Card size="small">
              <Statistic
                title={s.title}
                value={s.value}
                valueStyle={s.color ? { color: s.color } : undefined}
              />
            </Card>
          </Col>
        ))}
      </Row>
      <Table
        dataSource={sales}
        columns={columns}
        rowKey="sale_id"
        size="small"
        pagination={{ pageSize: 20 }}
        scroll={{ x: 1200 }}
        locale={{ emptyText: "No sales in the selected period" }}
      />
    </>
  );
};

// ── Section: Returns ──────────────────────────────────────────────────────────

const ReturnsTab = ({ data }: { data: any }) => {
  const rs = data.returns_summary;
  const returns: any[] = data.returns;

  const columns: ColumnsType<any> = [
    { title: "Date", key: "date", width: 110, render: (_, r) => fmtDate(r.date) },
    { title: "Return No.", key: "return_no", width: 130, render: (_, r) => r.return_number },
    {
      title: "Batch",
      key: "batch",
      width: 120,
      render: (_, r) => r.batch?.batch_number ?? "—",
    },
    { title: "Branch", key: "branch", width: 110, render: (_, r) => r.branch?.name ?? "—" },
    {
      title: "Qty Returned",
      key: "qty",
      align: "right",
      width: 100,
      render: (_, r) => r.quantity,
    },
    {
      title: "Processed By",
      key: "by",
      width: 120,
      render: (_, r) => r.processed_by?.name ?? "—",
    },
  ];

  return (
    <>
      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col>
          <Card size="small">
            <Statistic title="Units Returned" value={rs.total_units_returned} />
          </Card>
        </Col>
        <Col>
          <Card size="small">
            <Statistic title="Return Transactions" value={rs.total_return_transactions} />
          </Card>
        </Col>
      </Row>
      <Table
        dataSource={returns}
        columns={columns}
        rowKey="return_id"
        size="small"
        pagination={{ pageSize: 20 }}
        scroll={{ x: 700 }}
        locale={{ emptyText: "No returns in the selected period" }}
      />
    </>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const ProductAuditPage: React.FC = () => {
  setPageTitle("Product Audit");

  const [selectedVariantId, setSelectedVariantId] = useState<number | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, "day"),
    dayjs(),
  ]);
  const [branchId, setBranchId] = useState<number | undefined>();
  const [queryEnabled, setQueryEnabled] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const { data: branchOptions } = useQuery<{ id: number; name: string }[]>({
    queryKey: [queryKeys.branchOptions],
    queryFn: () => salesApi.getBranchOptions(),
    staleTime: 5 * 60_000,
  });

  const queryParams = {
    variant_id: selectedVariantId!,
    start_date: dateRange[0].format("YYYY-MM-DD"),
    end_date: dateRange[1].format("YYYY-MM-DD"),
    branch_id: branchId,
  };

  const {
    data: auditData,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["product-audit", queryParams],
    queryFn: () => productAuditApi.getAuditData(queryParams),
    enabled: queryEnabled && !!selectedVariantId,
    staleTime: 0,
  });

  const handleSearch = () => {
    if (!selectedVariantId) return;
    setQueryEnabled(true);
    refetch();
  };

  const handleDownloadPdf = async () => {
    if (!selectedVariantId) return;
    setDownloading(true);
    try {
      await productAuditApi.downloadAuditPdf(queryParams);
    } finally {
      setDownloading(false);
    }
  };

  const tabItems = auditData
    ? [
        {
          key: "info",
          label: "Product Info",
          children: <ProductInfoTab data={auditData} />,
        },
        {
          key: "stock",
          label: "Stock Snapshot",
          children: <StockSnapshotTab data={auditData} />,
        },
        {
          key: "purchases",
          label: `Purchases (${auditData.purchases_summary.total_batches})`,
          children: <PurchasesTab data={auditData} />,
        },
        {
          key: "adjustments",
          label: `Adjustments (${auditData.adjustments.length})`,
          children: <AdjustmentsTab data={auditData} />,
        },
        {
          key: "transfers",
          label: `Transfers (${auditData.transfers.length})`,
          children: <TransfersTab data={auditData} />,
        },
        {
          key: "sales",
          label: `Sales (${auditData.sales_summary.total_units_sold} units)`,
          children: <SalesTab data={auditData} />,
        },
        {
          key: "returns",
          label: `Returns (${auditData.returns_summary.total_units_returned} units)`,
          children: <ReturnsTab data={auditData} />,
        },
      ]
    : [];

  return (
    <div>
      <PageTitle title="Product Audit" icon={<AuditOutlined />} />

      {/* Filter Card */}
      <Card style={{ marginBottom: 16 }}>
        <Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
          Select Product Variant & Period
        </Title>

        <Row gutter={[16, 16]} align="bottom">
          <Col xs={24} md={12}>
            <ProductVariantSelector
              selectedVariantId={selectedVariantId}
              onVariantSelect={setSelectedVariantId}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
              Date Range
            </label>
            <RangePicker
              style={{ width: "100%" }}
              value={dateRange}
              onChange={(vals) => {
                if (vals && vals[0] && vals[1]) {
                  setDateRange([vals[0], vals[1]]);
                }
              }}
              format="DD MMM YYYY"
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
              Branch (optional)
            </label>
            <Select
              style={{ width: "100%" }}
              placeholder="All Branches"
              allowClear
              onChange={setBranchId}
              value={branchId}
            >
              {(branchOptions ?? []).map((b: any) => (
                <Option key={b.id} value={b.id}>
                  {b.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={24} md={2}>
            <Space>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleSearch}
                loading={isFetching}
                disabled={!selectedVariantId}
              >
                Run Audit
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {isError && (
        <Alert
          type="error"
          message="Failed to load audit data"
          description={String((error as any)?.message ?? "An error occurred")}
          style={{ marginBottom: 16 }}
        />
      )}

      {isFetching && <CenterLoader />}

      {auditData && !isFetching && (
        <>
          {/* Header row with download */}
          <Card
            size="small"
            style={{ marginBottom: 12 }}
            extra={
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => refetch()}
                  loading={isFetching}
                >
                  Refresh
                </Button>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleDownloadPdf}
                  loading={downloading}
                >
                  Download PDF
                </Button>
              </Space>
            }
          >
            <Row gutter={[16, 4]}>
              <Col>
                <Text>
                  <strong>Product:</strong>{" "}
                  {auditData.meta.variant.product.name} —{" "}
                  {auditData.meta.variant.name}
                </Text>
              </Col>
              <Col>
                <Text>
                  <strong>Period:</strong>{" "}
                  {fmtDate(auditData.meta.period.start_date)} to{" "}
                  {fmtDate(auditData.meta.period.end_date)}
                </Text>
              </Col>
              <Col>
                <Text>
                  <strong>Generated:</strong>{" "}
                  {fmtDateTime(auditData.meta.generated_at)}
                </Text>
              </Col>
            </Row>
          </Card>

          {/* Expiry warning */}
          {auditData.stock_snapshot.batches_expiring_within_30_days > 0 && (
            <Alert
              type="warning"
              icon={<WarningOutlined />}
              showIcon
              message={`${auditData.stock_snapshot.batches_expiring_within_30_days} batch(es) expiring within 30 days`}
              style={{ marginBottom: 12 }}
            />
          )}

          {/* Summary stats */}
          <SummaryCards data={auditData} />

          {/* Detailed Tabs */}
          <Card>
            <Tabs items={tabItems} defaultActiveKey="info" size="small" />
          </Card>
        </>
      )}

      {!auditData && !isFetching && !isError && (
        <Empty
          description="Select a product variant and date range, then click Run Audit"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    </div>
  );
};

export default ProductAuditPage;
