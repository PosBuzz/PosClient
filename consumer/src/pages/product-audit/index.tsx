import {
  DownloadOutlined,
  ReloadOutlined,
  SearchOutlined,
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

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtNum = (n: number | string | null | undefined, dec = 2) => {
  if (n == null) return "0";
  return Number(n).toLocaleString("en-US", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
};

const fmtDate = (d: string | null | undefined) =>
  d ? dayjs(d).format("DD MMM YYYY") : "—";

const fmtDateTime = (d: string | null | undefined) =>
  d ? dayjs(d).format("DD MMM YYYY HH:mm") : "—";

// ── Product & Variant selectors ───────────────────────────────────────────────

interface SelectorProps {
  selectedVariantId: number | undefined;
  onVariantSelect: (variantId: number) => void;
}

const ProductVariantSelector: React.FC<SelectorProps> = ({
  selectedVariantId,
  onVariantSelect,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<
    number | undefined
  >();
  const [productSearch, setProductSearch] = useState("");

  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: [queryKeys.products, "audit-search", productSearch],
    queryFn: () =>
      productApi.getProducts({ search: productSearch || undefined, limit: 60 }),
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
              {p.name} {p.code ? `(${p.code})` : ""}
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
              {v.name} {v.sku ? `— ${v.sku}` : ""}
            </Option>
          ))}
        </Select>
      </Col>
    </Row>
  );
};

// ── Summary card row (Updated for branch breakdown) ────────────────────────────

const SummaryCards = ({ data }: { data: any }) => {
  const s = data.summary;
  const branches = s.by_branch || [];

  return (
    <>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Est. Opening Stock" value={s.opening_stock} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Current Stock"
              value={s.current_stock}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Net Change"
              value={s.net_change}
              prefix={s.net_change > 0 ? "+" : ""}
              valueStyle={{
                color: s.net_change >= 0 ? "#3f8600" : "#cf1322",
              }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Total Movements" value={s.total_events} />
          </Card>
        </Col>
      </Row>

      {/* Branch Breakdown Table (Only show if more than 1 branch is involved) */}
      {branches.length > 1 && (
        <Card
          size="small"
          title="Branch Breakdown"
          style={{ marginBottom: 16 }}
        >
          <Table
            dataSource={branches}
            rowKey="branch_id"
            pagination={false}
            size="small"
            scroll={{ x: 500 }}
          >
            <Table.Column
              title="Branch"
              dataIndex="branch_name"
              key="branch_name"
            />
            <Table.Column
              title="Opening"
              dataIndex="opening_stock"
              key="opening_stock"
              align="right"
            />
            <Table.Column
              title="Current"
              dataIndex="current_stock"
              key="current_stock"
              align="right"
              render={(val) => (
                <Text strong style={{ color: "#1890ff" }}>
                  {val}
                </Text>
              )}
            />
            <Table.Column
              title="Net Change"
              dataIndex="net_change"
              key="net_change"
              align="right"
              render={(val) => (
                <Text style={{ color: val >= 0 ? "#3f8600" : "#cf1322" }}>
                  {val > 0 ? "+" : ""}
                  {val}
                </Text>
              )}
            />
            <Table.Column
              title="Events"
              dataIndex="total_events"
              key="total_events"
              align="right"
            />
          </Table>
        </Card>
      )}
    </>
  );
};
// ── Section: Product Info (Fixed attributes relation name) ────────────────────

const ProductInfoTab = ({ data }: { data: any }) => {
  const v = data.meta.variant;
  return (
    <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
      <Descriptions.Item label="Product">{v.product.name}</Descriptions.Item>
      <Descriptions.Item label="Product Code">
        {v.product.code ?? "—"}
      </Descriptions.Item>
      <Descriptions.Item label="Variant">{v.name}</Descriptions.Item>
      <Descriptions.Item label="SKU">{v.sku ?? "—"}</Descriptions.Item>
      <Descriptions.Item label="Barcode">{v.barcode ?? "—"}</Descriptions.Item>
      <Descriptions.Item label="Category">
        {v.product.category?.name ?? "—"}
      </Descriptions.Item>
      <Descriptions.Item label="Brand">
        {v.product.brand?.name ?? "—"}
      </Descriptions.Item>
      <Descriptions.Item label="Sale Unit">
        {v.sale_unit?.name ?? "—"}
      </Descriptions.Item>
      <Descriptions.Item label="Regular Price">
        {fmtNum(v.regular_price)}
      </Descriptions.Item>
      <Descriptions.Item label="Wholesale Price">
        {v.wholesale_price ? fmtNum(v.wholesale_price) : "—"}
      </Descriptions.Item>
      {/* Using VariantAttribute instead of attributes to match Prisma relation */}
      {v.VariantAttribute?.length > 0 && (
        <Descriptions.Item label="Attributes" span={2}>
          <Space size={[0, 8]} wrap>
            {v.VariantAttribute.map((a: any) => (
              <Tag key={a.id}>
                {a.name}: {a.value}
              </Tag>
            ))}
          </Space>
        </Descriptions.Item>
      )}
    </Descriptions>
  );
};

// ── Section: Batch Timeline (New Unified View) ───────────────────────────────

const BATCH_EVENT_LABELS: Record<string, { color: string; text: string }> = {
  PURCHASE_IN: { color: "green", text: "Purchase In" },
  SALE_OUT: { color: "red", text: "Sale Out" },
  RETURN_IN: { color: "cyan", text: "Return Restock" },
  TRANSFER_OUT: { color: "orange", text: "Transfer Out" },
  TRANSFER_IN: { color: "blue", text: "Transfer In" },
  ADJUSTMENT: { color: "purple", text: "Manual Adjust" },
  EXCHANGE_OUT: { color: "magenta", text: "Exchange Out" },
};

const BatchTimelineTab = ({ data }: { data: any }) => {
  const batches: any[] = data.batches;

  if (batches.length === 0) {
    return (
      <Empty description="No batches or movements found in this period." />
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      {batches.map((batchGroup) => {
        const batch = batchGroup.batchInfo;
        const events = batchGroup.events;

        const eventColumns: ColumnsType<any> = [
          {
            title: "Date/Time",
            key: "date",
            width: 150,
            render: (_, r) => fmtDateTime(r.created_at),
          },
          {
            title: "Event",
            key: "event",
            width: 130,
            render: (_, r) => {
              const config = BATCH_EVENT_LABELS[r.event_type] || {
                color: "default",
                text: r.event_type,
              };
              return <Tag color={config.color}>{config.text}</Tag>;
            },
          },
          {
            title: "Qty Change",
            key: "delta",
            width: 100,
            align: "right",
            render: (_, r) => (
              <Text
                strong
                style={{ color: r.quantity_delta > 0 ? "#3f8600" : "#cf1322" }}
              >
                {r.quantity_delta > 0 ? "+" : ""}
                {r.quantity_delta}
              </Text>
            ),
          },
          {
            title: "Stock After",
            key: "after",
            width: 100,
            align: "right",
            render: (_, r) => <Text strong>{r.quantity_after}</Text>,
          },
          {
            title: "Details / Reference",
            key: "notes",
            render: (_, r) => (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {r.notes || "—"}
              </Text>
            ),
          },
          {
            title: "User",
            key: "user",
            width: 120,
            render: (_, r) => r.created_by?.name || "System",
          },
        ];

        return (
          <Card
            key={batch.id}
            size="small"
            title={
              <Space>
                <span style={{ fontWeight: 600 }}>{batch.batch_number}</span>
                <Tag>{batch.branch?.name || "Unknown Branch"}</Tag>
                {batch.vendor?.name && (
                  <Tag color="volcano">{batch.vendor.name}</Tag>
                )}
              </Space>
            }
            extra={
              <Space size="large">
                <Text type="secondary">
                  Period Start: <Text strong>{batchGroup.periodStartQty}</Text>
                </Text>
                <Text>
                  Current:{" "}
                  <Text strong style={{ color: "#1890ff" }}>
                    {batch.quantity}
                  </Text>
                </Text>
              </Space>
            }
          >
            {events.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No movements in this period"
              />
            ) : (
              <Table
                dataSource={events}
                columns={eventColumns}
                rowKey="id"
                size="small"
                pagination={false}
                scroll={{ x: 800 }}
              />
            )}
          </Card>
        );
      })}
    </Space>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const ProductAuditPage: React.FC = () => {
  const [selectedVariantId, setSelectedVariantId] = useState<
    number | undefined
  >();
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
          key: "timeline",
          label: `Batch Timeline (${auditData.batches.length} Batches)`,
          children: <BatchTimelineTab data={auditData} />,
        },
      ]
    : [];

  return (
    <div>
      {setPageTitle("Product Audit")}
      <PageTitle
        title="Product Audit"
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Product Audit" },
        ]}
      />

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
            <label
              style={{ display: "block", marginBottom: 4, fontWeight: 500 }}
            >
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
            <label
              style={{ display: "block", marginBottom: 4, fontWeight: 500 }}
            >
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
            </Row>
          </Card>

          {/* Summary stats matching new backend response */}
          <SummaryCards data={auditData} />

          {/* Simplified Tabs */}
          <Card>
            <Tabs items={tabItems} defaultActiveKey="timeline" size="small" />
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
