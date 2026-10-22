import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  Popconfirm,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import { useState } from "react";
import { Link } from "react-router-dom";
import { deliveryPartnersApi } from "../../api/delivery-partners-api";
import { CurrencyIcon, Money } from "../../components/Currency";
import PageTitle from "../../components/PageTitle";
import { useMessageStore } from "../../stores/messageStore";
import type { DeliveryPartnerListItem } from "../../types/delivery-partner.types";
import { getErrorMessage } from "../../utils/api-error";
import { balanceLabel, partnersCsv } from "../../utils/delivery-partner.utils";
import { setPageTitle } from "../../utils/setPageTitle";
import PartnerDrawer from "./_PartnerDrawer";

const { Text } = Typography;
const title = "Delivery Partners";

export function BalanceCell({ value }: { value: number }) {
  const label = balanceLabel(value);
  return (
    <div>
      <Text type={label.tone} strong={label.tone !== "secondary"}>
        <Money value={Math.abs(value)} />
      </Text>
      <div style={{ fontSize: 12 }}>
        <Text type="secondary">{label.text}</Text>
      </div>
    </div>
  );
}

const DeliveryPartners = () => {
  const queryClient = useQueryClient();
  const { messageApi } = useMessageStore();
  const [editing, setEditing] = useState<DeliveryPartnerListItem | null>(null);
  const [open, setOpen] = useState(false);

  const {
    data = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["delivery-partners"],
    queryFn: deliveryPartnersApi.list,
  });

  const remove = useMutation({
    mutationFn: (id: number) => deliveryPartnersApi.remove(id),
    onSuccess: () => {
      messageApi?.success("Delivery partner deleted");
      queryClient.invalidateQueries({ queryKey: ["delivery-partners"] });
    },
    onError: (error) =>
      messageApi?.error(getErrorMessage(error, "Failed to delete partner")),
  });

  const owedToYou = data
    .filter((p) => p.balance > 0)
    .reduce((s, p) => s + p.balance, 0);
  const youOwe = data
    .filter((p) => p.balance < 0)
    .reduce((s, p) => s - p.balance, 0);
  const unsettled = data.reduce((s, p) => s + p.unsettled_orders, 0);

  const exportCsv = () => {
    const blob = new Blob([`\uFEFF${partnersCsv(data)}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `delivery-partners-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const columns = [
    {
      title: "Partner",
      key: "name",
      render: (_: unknown, p: DeliveryPartnerListItem) => (
        <div>
          <Link
            to={`/delivery-partners/view/${p.id}`}
            style={{ fontWeight: 500 }}
          >
            {p.name}
          </Link>{" "}
          {!p.is_active && <Tag>Inactive</Tag>}
          {(p.contact || p.phone) && (
            <div style={{ fontSize: 12, color: "#666" }}>
              {[p.contact, p.phone].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Balance",
      dataIndex: "balance",
      key: "balance",
      render: (value: number) => <BalanceCell value={value} />,
    },
    {
      title: "Waiting for payout",
      key: "unsettled",
      render: (_: unknown, p: DeliveryPartnerListItem) =>
        p.unsettled_orders ? (
          <div>
            <Money value={p.unsettled_net} />
            <div style={{ fontSize: 12, color: "#666" }}>
              {p.unsettled_orders} order(s)
            </div>
          </div>
        ) : (
          <Text type="secondary">None</Text>
        ),
    },
    {
      title: "Default charges",
      key: "defaults",
      render: (_: unknown, p: DeliveryPartnerListItem) => (
        <div style={{ fontSize: 12 }}>
          <div>
            Delivery <Money value={p.default_delivery_charge} />
          </div>
          <div>COD fee {p.default_cod_fee_percent}%</div>
        </div>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: unknown, p: DeliveryPartnerListItem) => (
        <Space size={0}>
          <Link to={`/delivery-partners/view/${p.id}`}>
            <Button type="link" icon={<EyeOutlined />} aria-label="View" />
          </Link>
          <Button
            type="link"
            icon={<EditOutlined />}
            aria-label="Edit"
            onClick={() => {
              setEditing(p);
              setOpen(true);
            }}
          />
          <Popconfirm
            title="Delete this partner?"
            description="Only a partner with no orders can be deleted. Deactivate it otherwise."
            onConfirm={() => remove.mutate(p.id)}
            okText="Delete"
            cancelText="Cancel"
          >
            <Button
              danger
              type="link"
              icon={<DeleteOutlined />}
              aria-label="Delete"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      {setPageTitle(title)}
      <PageTitle
        title={title}
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Online Orders", href: "/online-orders" },
          { title },
        ]}
        rightSection={
          <Space wrap>
            <Button
              icon={<DownloadOutlined />}
              onClick={exportCsv}
              disabled={!data.length}
            >
              Export CSV
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              Add Partner
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Partners owe you"
              value={owedToYou}
              precision={2}
              prefix={<CurrencyIcon />}
              valueStyle={{ color: "#389e0d" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="You owe partners"
              value={youOwe}
              precision={2}
              prefix={<CurrencyIcon />}
              valueStyle={{ color: youOwe ? "#cf1322" : undefined }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic title="Orders waiting for payout" value={unsettled} />
          </Card>
        </Col>
      </Row>

      {isError ? (
        <p>Failed to load delivery partners</p>
      ) : (
        <Card>
          <Table
            rowKey="id"
            scroll={{ x: true }}
            loading={isLoading}
            columns={columns}
            dataSource={data}
            pagination={{ pageSize: 20, hideOnSinglePage: true }}
          />
        </Card>
      )}

      {open && (
        <PartnerDrawer
          open={open}
          partner={editing}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default DeliveryPartners;
