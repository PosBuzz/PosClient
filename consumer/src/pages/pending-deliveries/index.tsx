import {
  CheckCircleOutlined,
  EyeOutlined,
  PrinterOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { salesApi } from "../../api/sales-api";
import { Money } from "../../components/Currency";
import PageTitle from "../../components/PageTitle";
import { queryKeys } from "../../constants/queryKeys";
import { useMessageStore } from "../../stores/messageStore";
import { Sale } from "../../types/sale.types";
import { setPageTitle } from "../../utils/setPageTitle";

export default function PendingDeliveries() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { messageApi } = useMessageStore();
  const [status, setStatus] = useState<string>("PENDING");
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["pending-deliveries", status, search],
    queryFn: () =>
      salesApi.getPendingDeliveries({ status, search, limit: 100 }),
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["pending-deliveries"] });
    queryClient.invalidateQueries({ queryKey: [queryKeys.batches] });
    queryClient.invalidateQueries({ queryKey: [queryKeys.inventorySummary] });
    queryClient.invalidateQueries({ queryKey: [queryKeys.productsForSale] });
  };
  const complete = useMutation({
    mutationFn: salesApi.completePendingDelivery,
    onSuccess: () => {
      refresh();
      messageApi?.success("Delivery completed and inventory updated");
    },
    onError: () => messageApi?.error("Could not complete delivery"),
  });
  const cancel = useMutation({
    mutationFn: salesApi.cancelPendingDelivery,
    onSuccess: () => {
      refresh();
      messageApi?.success("Delivery cancelled and reservation released");
    },
  });
  const printChalan = async (sale: Sale) => {
    const blob = await salesApi.generateReceipt(sale.id!, "chalan");
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <>
      {setPageTitle("Pending Deliveries")}
      <PageTitle
        title="Pending Deliveries"
        breadcrumbs={[
          { title: "Home", href: "/" },
          { title: "Sales", href: "/sales" },
          { title: "Pending Deliveries" },
        ]}
      />
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input.Search
            placeholder="Sale number or customer"
            allowClear
            onSearch={setSearch}
            style={{ width: 280 }}
          />
          <Select
            value={status}
            onChange={setStatus}
            style={{ width: 180 }}
            options={[
              { label: "Pending", value: "PENDING" },
              { label: "Delivered", value: "DELIVERED" },
              { label: "Cancelled", value: "CANCELLED" },
            ]}
          />
        </Space>
      </Card>
      <Card>
        <Table
          loading={isLoading}
          dataSource={data?.data || []}
          rowKey="id"
          scroll={{ x: 1000 }}
          columns={[
            {
              title: "Sale",
              dataIndex: "sale_number",
              render: (value: string) => (
                <Typography.Text strong>{value}</Typography.Text>
              ),
            },
            {
              title: "Created",
              dataIndex: "sale_date",
              render: (value: string) =>
                dayjs(value).format("DD MMM YYYY, hh:mm A"),
            },
            {
              title: "Customer",
              render: (_: unknown, record: Sale) =>
                record.customer_name || record.customer?.name || "Walk-in",
            },
            {
              title: "Items",
              render: (_: unknown, record: Sale) =>
                record.items.reduce((sum, item) => sum + item.quantity, 0),
            },
            {
              title: "Total",
              dataIndex: "total_amount",
              render: (value: number) => <Money value={value} />,
            },
            {
              title: "Payment",
              dataIndex: "payment_status",
              render: (value: string) => (
                <Tag
                  color={
                    value === "paid"
                      ? "green"
                      : value === "partial"
                        ? "orange"
                        : "red"
                  }
                >
                  {value.toUpperCase()}
                </Tag>
              ),
            },
            {
              title: "Delivery",
              dataIndex: "delivery_status",
              render: (value: string) => (
                <Tag
                  color={
                    value === "DELIVERED"
                      ? "green"
                      : value === "CANCELLED"
                        ? "red"
                        : "orange"
                  }
                >
                  {value}
                </Tag>
              ),
            },
            {
              title: "Actions",
              fixed: "right" as const,
              width: 300,
              render: (_: unknown, record: Sale) => (
                <Space>
                  <Button
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => navigate(`/sales/view/${record.id}`)}
                  >
                    View
                  </Button>
                  <Button
                    size="small"
                    icon={<PrinterOutlined />}
                    onClick={() => printChalan(record)}
                  >
                    Chalan
                  </Button>
                  {record.delivery_status === "PENDING" && (
                    <>
                      <Popconfirm
                        title="Mark this order delivered and deduct its reserved inventory?"
                        onConfirm={() => complete.mutate(record.id!)}
                      >
                        <Button
                          size="small"
                          type="primary"
                          icon={<CheckCircleOutlined />}
                        >
                          Delivered
                        </Button>
                      </Popconfirm>
                      <Popconfirm
                        title="Cancel delivery and release reserved inventory?"
                        onConfirm={() => cancel.mutate(record.id!)}
                      >
                        <Button size="small" danger icon={<StopOutlined />}>
                          Cancel
                        </Button>
                      </Popconfirm>
                    </>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
