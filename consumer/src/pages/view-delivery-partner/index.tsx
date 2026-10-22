import { ArrowLeftOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  Modal,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deliveryPartnersApi } from "../../api/delivery-partners-api";
import { CurrencyIcon, Money } from "../../components/Currency";
import PageTitle from "../../components/PageTitle";
import { useMessageStore } from "../../stores/messageStore";
import type {
  LedgerEntry,
  PartnerOrder,
  Settlement,
  SettlementDirection,
} from "../../types/delivery-partner.types";
import { getErrorMessage } from "../../utils/api-error";
import {
  balanceLabel,
  LEDGER_TYPE_LABELS,
} from "../../utils/delivery-partner.utils";
import { setPageTitle } from "../../utils/setPageTitle";
import AdjustmentModal from "./_AdjustmentModal";
import SettlementModal from "./_SettlementModal";

const { Text } = Typography;

const statusColors: Record<string, string> = {
  DELIVERED: "green",
  RETURNED: "magenta",
  CANCELLED: "red",
  OUT_FOR_DELIVERY: "geekblue",
};

const signed = (value: number) => (
  <Text type={value > 0 ? "success" : value < 0 ? "danger" : "secondary"}>
    {value > 0 ? "+" : value < 0 ? "−" : ""}
    <Money value={Math.abs(value)} />
  </Text>
);

const ViewDeliveryPartner = () => {
  const id = Number(useParams<{ id: string }>().id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { messageApi } = useMessageStore();
  const [tab, setTab] = useState("unsettled");
  const [selected, setSelected] = useState<PartnerOrder[]>([]);
  const [settling, setSettling] = useState<SettlementDirection | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [voiding, setVoiding] = useState<Settlement | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const summary = useQuery({
    queryKey: ["delivery-partner", id, "summary"],
    queryFn: () => deliveryPartnersApi.summary(id),
    enabled: Number.isInteger(id),
  });
  const unsettled = useQuery({
    queryKey: ["delivery-partner", id, "orders", "unsettled"],
    queryFn: () =>
      deliveryPartnersApi.orders(id, { settlement: "unsettled", limit: 1000 }),
    enabled: Number.isInteger(id),
  });
  const allOrders = useQuery({
    queryKey: ["delivery-partner", id, "orders", "all", ordersPage],
    queryFn: () =>
      deliveryPartnersApi.orders(id, {
        settlement: "all",
        page: ordersPage,
        limit: 20,
      }),
    enabled: tab === "orders",
  });
  const ledger = useQuery({
    queryKey: ["delivery-partner", id, "ledger", ledgerPage],
    queryFn: () =>
      deliveryPartnersApi.ledger(id, { page: ledgerPage, limit: 20 }),
    enabled: tab === "ledger",
  });
  const settlements = useQuery({
    queryKey: ["delivery-partner", id, "settlements"],
    queryFn: () => deliveryPartnersApi.settlements(id, { limit: 100 }),
    enabled: tab === "payouts",
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["delivery-partner", id] });
    queryClient.invalidateQueries({ queryKey: ["delivery-partners"] });
    queryClient.invalidateQueries({ queryKey: ["online-orders"] });
  };

  const voidMutation = useMutation({
    mutationFn: ({
      settlementId,
      reason,
    }: {
      settlementId: number;
      reason: string;
    }) => deliveryPartnersApi.voidSettlement(id, settlementId, reason),
    onSuccess: () => {
      messageApi?.success("Payout voided. Its orders are unsettled again.");
      setVoiding(null);
      setVoidReason("");
      refresh();
    },
    onError: (error) =>
      messageApi?.error(getErrorMessage(error, "Failed to void payout")),
  });

  if (summary.isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "100px 0" }}>
        <Spin size="large" />
      </div>
    );
  }
  if (summary.isError || !summary.data) {
    return (
      <Alert
        type="error"
        message={getErrorMessage(
          summary.error,
          "Failed to load delivery partner",
        )}
        action={
          <Button onClick={() => navigate("/delivery-partners")}>Back</Button>
        }
      />
    );
  }

  const { partner, balance, totals } = summary.data;
  const label = balanceLabel(balance);

  const orderColumns = (withSettlement: boolean) => [
    {
      title: "Order #",
      key: "sale_number",
      render: (_: unknown, o: PartnerOrder) => (
        <Link to={`/sales/view/${o.id}`}>{o.sale_number}</Link>
      ),
    },
    {
      title: "Date",
      dataIndex: "sale_date",
      key: "sale_date",
      render: (d: string) => dayjs(d).format("DD MMM YYYY"),
    },
    {
      title: "Customer",
      key: "customer",
      render: (_: unknown, o: PartnerOrder) => (
        <div>
          {o.customer_name || "—"}
          {o.customer_phone && (
            <div style={{ fontSize: 12, color: "#666" }}>
              {o.customer_phone}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "online_order_status",
      key: "status",
      render: (s: string | null) => (
        <Tag color={statusColors[s ?? ""] || "default"}>
          {(s ?? "PENDING").replace(/_/g, " ")}
        </Tag>
      ),
    },
    {
      title: "Collected",
      key: "cod_amount",
      // Only a delivered order has cash collected; a returned one costs its return charge
      render: (_: unknown, o: PartnerOrder) =>
        o.online_order_status === "DELIVERED" ? (
          <Money value={o.cod_amount} />
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "Charges",
      key: "charges",
      render: (_: unknown, o: PartnerOrder) =>
        o.online_order_status === "DELIVERED" ? (
          <Money value={o.delivery_charge + o.cod_fee} />
        ) : o.online_order_status === "RETURNED" ? (
          <Money value={o.delivery_charge} />
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "Net",
      dataIndex: "net",
      key: "net",
      render: (v: number) => signed(v),
    },
    ...(withSettlement
      ? [
          {
            title: "Payout",
            dataIndex: "partner_settlement_id",
            key: "settlement",
            render: (v: number | null) =>
              v ? <Tag color="green">#{v}</Tag> : <Tag>Unsettled</Tag>,
          },
        ]
      : []),
  ];

  const ledgerColumns = [
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      render: (d: string) => dayjs(d).format("DD MMM YYYY HH:mm"),
    },
    {
      title: "Entry",
      key: "type",
      render: (_: unknown, e: LedgerEntry) => (
        <div>
          {LEDGER_TYPE_LABELS[e.type] ?? e.type}
          <div style={{ fontSize: 12, color: "#666" }}>{e.note}</div>
        </div>
      ),
    },
    {
      title: "Order",
      key: "sale",
      render: (_: unknown, e: LedgerEntry) =>
        e.sale ? (
          <Link to={`/sales/view/${e.sale.id}`}>{e.sale.sale_number}</Link>
        ) : (
          "—"
        ),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      render: (v: number) => signed(v),
    },
    {
      title: "Balance",
      dataIndex: "balance_after",
      key: "balance_after",
      render: (v: number) => <Money value={v} />,
    },
  ];

  const settlementColumns = [
    {
      title: "#",
      dataIndex: "id",
      key: "id",
    },
    {
      title: "Date",
      dataIndex: "settlement_date",
      key: "settlement_date",
      render: (d: string) => dayjs(d).format("DD MMM YYYY"),
    },
    {
      title: "Type",
      dataIndex: "direction",
      key: "direction",
      render: (d: SettlementDirection) =>
        d === "RECEIVED" ? "Payout received" : "Paid to partner",
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      render: (v: number) => <Money value={v} />,
    },
    {
      title: "Method",
      key: "method",
      render: (_: unknown, s: Settlement) => (
        <div>
          {s.payment_method.replace(/_/g, " ")}
          {s.reference && (
            <div style={{ fontSize: 12, color: "#666" }}>Ref {s.reference}</div>
          )}
        </div>
      ),
    },
    { title: "Orders", dataIndex: "orders", key: "orders" },
    {
      title: "Status",
      key: "status",
      render: (_: unknown, s: Settlement) =>
        s.voided_at ? (
          <div>
            <Tag color="red">Voided</Tag>
            <div style={{ fontSize: 12, color: "#666" }}>{s.void_reason}</div>
          </div>
        ) : (
          <Button size="small" danger onClick={() => setVoiding(s)}>
            Void
          </Button>
        ),
    },
  ];

  const tabs = [
    {
      key: "unsettled",
      label: `Waiting for payout (${summary.data.unsettled.orders})`,
      children: (
        <>
          <Space wrap style={{ marginBottom: 12 }}>
            <Button
              type="primary"
              disabled={!selected.length}
              onClick={() => setSettling("RECEIVED")}
            >
              Record payout for {selected.length || "selected"} order(s)
            </Button>
            {selected.length > 0 && (
              <Text type="secondary">
                Selected net:{" "}
                <Money value={selected.reduce((s, o) => s + o.net, 0)} />
              </Text>
            )}
          </Space>
          <Table
            rowKey="id"
            size="small"
            scroll={{ x: true }}
            loading={unsettled.isLoading}
            dataSource={unsettled.data?.data ?? []}
            columns={orderColumns(false)}
            rowSelection={{
              selectedRowKeys: selected.map((o) => o.id),
              onChange: (_keys, rows) => setSelected(rows),
            }}
            pagination={{ pageSize: 50, hideOnSinglePage: true }}
            locale={{
              emptyText:
                "No delivered or returned orders are waiting for a payout",
            }}
          />
        </>
      ),
    },
    {
      key: "orders",
      label: "All orders",
      children: (
        <Table
          rowKey="id"
          size="small"
          scroll={{ x: true }}
          loading={allOrders.isLoading}
          dataSource={allOrders.data?.data ?? []}
          columns={orderColumns(true)}
          pagination={{
            current: ordersPage,
            pageSize: 20,
            total: allOrders.data?.meta.total ?? 0,
            onChange: setOrdersPage,
            showSizeChanger: false,
          }}
        />
      ),
    },
    {
      key: "ledger",
      label: "Ledger",
      children: (
        <Table
          rowKey="id"
          size="small"
          scroll={{ x: true }}
          loading={ledger.isLoading}
          dataSource={ledger.data?.data ?? []}
          columns={ledgerColumns}
          pagination={{
            current: ledgerPage,
            pageSize: 20,
            total: ledger.data?.meta.total ?? 0,
            onChange: setLedgerPage,
            showSizeChanger: false,
          }}
        />
      ),
    },
    {
      key: "payouts",
      label: "Payouts",
      children: (
        <Table
          rowKey="id"
          size="small"
          scroll={{ x: true }}
          loading={settlements.isLoading}
          dataSource={settlements.data?.data ?? []}
          columns={settlementColumns}
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
        />
      ),
    },
  ];

  return (
    <>
      {setPageTitle(`Delivery Partner - ${partner.name}`)}
      <PageTitle
        title={partner.name}
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Delivery Partners", href: "/delivery-partners" },
          { title: partner.name },
        ]}
        rightSection={
          <Space wrap>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/delivery-partners")}
            >
              Back
            </Button>
            <Button
              type="primary"
              onClick={() => {
                setSelected([]);
                setSettling("RECEIVED");
              }}
            >
              Record payout
            </Button>
            <Button onClick={() => setSettling("PAID")}>Pay partner</Button>
            <Button onClick={() => setAdjusting(true)}>Adjust balance</Button>
          </Space>
        }
      />
      {!partner.is_active && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="This partner is inactive and cannot be chosen for new orders."
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title={label.text}
              value={Math.abs(balance)}
              precision={2}
              prefix={<CurrencyIcon />}
              valueStyle={{
                color:
                  label.tone === "success"
                    ? "#389e0d"
                    : label.tone === "danger"
                      ? "#cf1322"
                      : undefined,
              }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="Waiting for payout"
              value={summary.data.unsettled.net}
              precision={2}
              prefix={<CurrencyIcon />}
              suffix={
                <span style={{ fontSize: 13, color: "#666" }}>
                  {summary.data.unsettled.orders} order(s)
                </span>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="Cash collected (all time)"
              value={totals.cod_collected}
              precision={2}
              prefix={<CurrencyIcon />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="Charges (delivery, COD, returns)"
              value={
                totals.delivery_charges +
                totals.cod_fees +
                totals.return_charges
              }
              precision={2}
              prefix={<CurrencyIcon />}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap size="large" style={{ fontSize: 13 }}>
          <span>
            Payouts received: <Money value={totals.payouts_received} />
          </span>
          <span>
            Paid to partner: <Money value={totals.payments_made} />
          </span>
          <span>Adjustments: {signed(totals.adjustments)}</span>
          {summary.data.last_settlement && (
            <span>
              Last payout:{" "}
              {dayjs(summary.data.last_settlement.settlement_date).format(
                "DD MMM YYYY",
              )}{" "}
              (<Money value={summary.data.last_settlement.amount} />)
            </span>
          )}
          {partner.phone && <span>Phone: {partner.phone}</span>}
        </Space>
      </Card>

      <Card>
        <Tabs activeKey={tab} onChange={setTab} items={tabs} />
      </Card>

      {settling && (
        <SettlementModal
          partnerId={id}
          partnerName={partner.name}
          direction={settling}
          orders={settling === "RECEIVED" ? selected : []}
          balance={balance}
          onClose={() => setSettling(null)}
          onDone={() => {
            setSettling(null);
            setSelected([]);
            refresh();
          }}
        />
      )}
      {adjusting && (
        <AdjustmentModal
          partnerId={id}
          onClose={() => setAdjusting(false)}
          onDone={() => {
            setAdjusting(false);
            refresh();
          }}
        />
      )}
      <Modal
        open={!!voiding}
        title={`Void payout #${voiding?.id}`}
        okText="Void payout"
        okButtonProps={{ danger: true, disabled: !voidReason.trim() }}
        confirmLoading={voidMutation.isPending}
        onCancel={() => {
          setVoiding(null);
          setVoidReason("");
        }}
        onOk={() =>
          voidMutation.mutate({
            settlementId: voiding!.id,
            reason: voidReason.trim(),
          })
        }
      >
        <p>
          The payout stays in the history as voided, its amount is added back to
          the balance, and its orders go back to waiting for payout.
        </p>
        <Input.TextArea
          rows={2}
          placeholder="Why is it voided? (required)"
          value={voidReason}
          maxLength={500}
          onChange={(e) => setVoidReason(e.target.value)}
        />
      </Modal>
    </>
  );
};

export default ViewDeliveryPartner;
