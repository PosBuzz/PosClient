import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateSalesReports } from "../../utils/invalidate-sales-reports";
import {
  Table,
  Tag,
  Button,
  Space,
  Select,
  Input,
  DatePicker,
  Row,
  Col,
  Card,
  Statistic,
  Modal,
  Form,
  InputNumber,
  Alert,
  Typography,
} from "antd";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { deliveryPartnersApi } from "../../api/delivery-partners-api";
import { salesApi } from "../../api/sales-api";
import { Money } from "../../components/Currency";
import PageTitle from "../../components/PageTitle";
import { useAuthStore } from "../../stores/authStore";
import { useMessageStore } from "../../stores/messageStore";
import { Sale } from "../../types/sale.types";
import { EyeOutlined, SyncOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { setPageTitle } from "../../utils/setPageTitle";
import { getErrorMessage } from "../../utils/api-error";
import {
  codFee,
  deliveredNet,
  owedByCustomer,
} from "../../utils/delivery-partner.utils";

const { Option } = Select;
const { RangePicker } = DatePicker;

// Status color mapping
const statusColors: Record<string, string> = {
  PENDING: "orange",
  CONFIRMED: "blue",
  PROCESSING: "cyan",
  READY: "purple",
  OUT_FOR_DELIVERY: "geekblue",
  DELIVERED: "green",
  CANCELLED: "red",
  RETURNED: "magenta",
};

// Status display names
const statusNames: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  READY: "Ready",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
};

const OnlineOrders = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: partners = [] } = useQuery({
    queryKey: ["delivery-partners"],
    queryFn: deliveryPartnersApi.list,
  });
  const [printingOrderId, setPrintingOrderId] = useState<number | null>(null);
  const printDeliverySlip = async (order: Sale) => {
    setPrintingOrderId(order.id!);
    try {
      const blob = await salesApi.generateReceipt(
        order.id!,
        "online_delivery_slip",
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `online-delivery-slip-${order.sale_number}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      messageApi?.error(
        getErrorMessage(error, "Failed to generate online delivery slip"),
      );
    } finally {
      setPrintingOrderId(null);
    }
  };
  const { user } = useAuthStore();
  const { messageApi } = useMessageStore();

  // Filter state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<number | undefined>();
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>();
  const [selectedPartner, setSelectedPartner] = useState<number | undefined>();
  const [settlementFilter, setSettlementFilter] = useState<
    "settled" | "unsettled" | undefined
  >();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(
    null,
  );

  // Status update modal state
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Sale | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [form] = Form.useForm();

  const userBranches = user?.branches || [];

  // Fetch online orders
  const {
    data: ordersData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [
      "online-orders",
      page,
      limit,
      search,
      selectedBranch,
      selectedStatus,
      selectedPartner,
      settlementFilter,
      dateRange,
    ],
    queryFn: () => {
      const filters: any = { page, limit };
      if (search) filters.search = search;
      if (selectedBranch) filters.branch_id = selectedBranch;
      if (selectedStatus) filters.status = selectedStatus;
      if (selectedPartner) filters.delivery_partner_id = selectedPartner;
      if (settlementFilter) filters.settlement = settlementFilter;
      if (dateRange) {
        filters.date_from = dateRange[0].format("YYYY-MM-DD");
        filters.date_to = dateRange[1].format("YYYY-MM-DD");
      }
      return salesApi.getOnlineOrders(filters);
    },
  });

  // Fetch online order stats
  const { data: statsData } = useQuery({
    queryKey: ["online-order-stats", selectedBranch],
    queryFn: () => salesApi.getOnlineOrderStats(selectedBranch),
  });

  const handleStatusUpdate = (order: Sale) => {
    setSelectedOrder(order);
    form.setFieldsValue({
      status: order.online_order_status || "PENDING",
      delivery_partner_id: order.delivery_partner_id ?? undefined,
      cod_amount: Number(order.cod_amount ?? 0),
      delivery_charge: Number(order.delivery_charge ?? 0),
      cod_fee: Number(order.cod_fee ?? 0),
    });
    setStatusModalVisible(true);
  };

  // Choosing a partner fills in what it collects and charges; each stays editable
  const handlePartnerChange = (partnerId?: number) => {
    const partner = partners.find((p) => p.id === partnerId);
    if (!partner || !selectedOrder) return;
    const cod = owedByCustomer(selectedOrder);
    form.setFieldsValue({
      cod_amount: cod,
      delivery_charge: partner.default_delivery_charge,
      cod_fee: codFee(cod, partner.default_cod_fee_percent),
    });
  };

  const handleStatusSubmit = async () => {
    try {
      const values = await form.validateFields();
      setUpdatingStatus(true);

      const partnerId = values.delivery_partner_id ?? null;
      await salesApi.updateOnlineOrderStatus(selectedOrder!.id!, {
        status: values.status,
        // Only send the partner when it changed, so an old free-text name survives a status edit
        ...(partnerId !== (selectedOrder!.delivery_partner_id ?? null)
          ? { delivery_partner_id: partnerId }
          : {}),
        ...(partnerId
          ? {
              cod_amount: values.cod_amount ?? 0,
              delivery_charge: values.delivery_charge ?? 0,
              cod_fee: values.cod_fee ?? 0,
            }
          : {}),
      });
      queryClient.invalidateQueries({ queryKey: ["delivery-partners"] });
      queryClient.invalidateQueries({ queryKey: ["delivery-partner"] });
      queryClient.invalidateQueries({ queryKey: ["online-order-stats"] });
      invalidateSalesReports(queryClient);

      messageApi?.success("Order updated successfully");
      setStatusModalVisible(false);
      setSelectedOrder(null);
      form.resetFields();
      refetch();
    } catch (error: any) {
      messageApi?.error(
        getErrorMessage(error, "Failed to update order status"),
      );
    } finally {
      setUpdatingStatus(false);
    }
  };

  const columns = [
    {
      title: "Order #",
      dataIndex: "sale_number",
      key: "sale_number",
      width: 150,
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: "Date",
      dataIndex: "sale_date",
      key: "sale_date",
      width: 150,
      render: (date: string) => dayjs(date).format("MMM DD, YYYY HH:mm"),
    },
    {
      title: "Customer",
      key: "customer",
      width: 200,
      render: (record: Sale) => (
        <div>
          {record.customer_name && <div>{record.customer_name}</div>}
          {record.customer_phone && (
            <div style={{ fontSize: 12, color: "#666" }}>
              {record.customer_phone}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Branch",
      dataIndex: ["branch", "name"],
      key: "branch",
      width: 150,
    },
    {
      title: "Status",
      dataIndex: "online_order_status",
      key: "status",
      width: 150,
      render: (status: string) => (
        <Tag color={statusColors[status] || "default"}>
          {statusNames[status] || status}
        </Tag>
      ),
    },
    {
      title: "Delivery Partner",
      key: "delivery_partner",
      render: (record: Sale) =>
        record.delivery_partner_id ? (
          <div>
            <Link to={`/delivery-partners/view/${record.delivery_partner_id}`}>
              {record.delivery_partner}
            </Link>
            {record.partner_settlement_id ? (
              <div>
                <Tag color="green" style={{ marginTop: 4 }}>
                  Settled #{record.partner_settlement_id}
                </Tag>
              </div>
            ) : null}
          </div>
        ) : (
          record.delivery_partner || "—"
        ),
    },
    {
      title: "Total",
      dataIndex: "total_amount",
      key: "total_amount",
      width: 120,
      render: (amount: number) => <Money value={amount} />,
    },
    {
      title: "Payment",
      dataIndex: "payment_status",
      key: "payment_status",
      width: 100,
      render: (status: string) => {
        const colors: Record<string, string> = {
          paid: "green",
          partial: "orange",
          due: "red",
        };
        return (
          <Tag color={colors[status] || "default"}>{status.toUpperCase()}</Tag>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 150,
      render: (record: Sale) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/sales/view/${record.id}`)}
            size="small"
          >
            View
          </Button>
          <Button
            type="link"
            icon={<SyncOutlined />}
            onClick={() => handleStatusUpdate(record)}
            size="small"
          >
            Edit Order
          </Button>
          <Button
            type="link"
            size="small"
            loading={printingOrderId === record.id}
            onClick={() => printDeliverySlip(record)}
          >
            Online Delivery Slip
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {setPageTitle("Online Orders")}
      <PageTitle
        title="Online Orders"
        breadcrumbs={[
          { title: "Home", href: "/" },
          { title: "Sales", href: "/sales" },
          { title: "Online Orders" },
        ]}
      />

      {/* Statistics Cards */}
      {statsData && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Today's Orders"
                value={statsData.today?.count || 0}
                suffix={`(BDT ${(statsData.today?.total || 0).toFixed(2)})`}
              />
            </Card>
          </Col>
          {Object.entries(statsData.by_status || {}).map(
            ([status, data]: [string, any]) => (
              <Col span={4} key={status}>
                <Card>
                  <Statistic
                    title={statusNames[status.toUpperCase()] || status}
                    value={data.count || 0}
                    valueStyle={{ color: statusColors[status.toUpperCase()] }}
                    suffix={`(BDT ${(data.total || 0).toFixed(2)})`}
                  />
                </Card>
              </Col>
            ),
          )}
        </Row>
      )}

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={8}>
            <Input
              placeholder="Search by order #, customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Select
              placeholder="Select Branch"
              value={selectedBranch}
              onChange={setSelectedBranch}
              allowClear
              style={{ width: "100%" }}
            >
              {userBranches.map((branch) => (
                <Option key={branch.id} value={branch.id}>
                  {branch.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Select
              placeholder="Select Status"
              value={selectedStatus}
              onChange={setSelectedStatus}
              allowClear
              style={{ width: "100%" }}
            >
              {Object.entries(statusNames).map(([key, value]) => (
                <Option key={key} value={key}>
                  {value}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Select
              placeholder="Delivery partner"
              value={selectedPartner}
              onChange={(value) => {
                setSelectedPartner(value);
                setPage(1);
              }}
              allowClear
              style={{ width: "100%" }}
              options={partners.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Select
              placeholder="Partner payout"
              value={settlementFilter}
              onChange={(value) => {
                setSettlementFilter(value);
                setPage(1);
              }}
              allowClear
              style={{ width: "100%" }}
              options={[
                { value: "unsettled", label: "Waiting for payout" },
                { value: "settled", label: "Settled with partner" },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <RangePicker
              value={dateRange}
              onChange={(dates) =>
                setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)
              }
              style={{ width: "100%" }}
            />
          </Col>
        </Row>
      </Card>

      {/* Orders Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={ordersData?.data || []}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: page,
            pageSize: limit,
            total: ordersData?.meta?.total || 0,
            onChange: (page, pageSize) => {
              setPage(page);
              setLimit(pageSize);
            },
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} orders`,
          }}
        />
      </Card>

      {/* Status Update Modal */}
      <Modal
        title={`Edit Online Order - ${selectedOrder?.sale_number}`}
        open={statusModalVisible}
        onOk={handleStatusSubmit}
        onCancel={() => {
          setStatusModalVisible(false);
          setSelectedOrder(null);
          form.resetFields();
        }}
        confirmLoading={updatingStatus}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="New Status"
            name="status"
            rules={[{ required: true, message: "Please select a status" }]}
          >
            <Select placeholder="Select new status">
              {Object.entries(statusNames).map(([key, value]) => (
                <Option key={key} value={key}>
                  <Tag color={statusColors[key]}>{value}</Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>
          {selectedOrder?.partner_settlement_id ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={`Settled with the partner in payout #${selectedOrder.partner_settlement_id}. Void that payout on the partner's page to change the partner or amounts.`}
            />
          ) : null}
          {selectedOrder?.delivery_partner &&
          !selectedOrder.delivery_partner_id ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message={`Recorded as "${selectedOrder.delivery_partner}", which is not in your partner list. Choose a partner to track what is owed.`}
            />
          ) : null}
          <Form.Item label="Delivery Partner" name="delivery_partner_id">
            <Select
              placeholder="No partner"
              allowClear
              disabled={!!selectedOrder?.partner_settlement_id}
              onChange={handlePartnerChange}
              notFoundContent={
                <Link to="/delivery-partners">Add delivery partners first</Link>
              }
              options={partners
                .filter(
                  (p) =>
                    p.is_active || p.id === selectedOrder?.delivery_partner_id,
                )
                .map((p) => ({
                  value: p.id,
                  label: p.is_active ? p.name : `${p.name} (inactive)`,
                }))}
            />
          </Form.Item>
          <Form.Item
            noStyle
            dependencies={[
              "delivery_partner_id",
              "status",
              "cod_amount",
              "delivery_charge",
              "cod_fee",
            ]}
          >
            {({ getFieldValue }) => {
              if (!getFieldValue("delivery_partner_id")) return null;
              const locked = !!selectedOrder?.partner_settlement_id;
              const owed = owedByCustomer(selectedOrder || {});
              const status = getFieldValue("status");
              return (
                <>
                  <Row gutter={12}>
                    <Col
                      xs={24}
                      sm={8}
                      style={
                        status === "RETURNED" ? { display: "none" } : undefined
                      }
                    >
                      <Form.Item
                        label="Cash to collect"
                        name="cod_amount"
                        tooltip="What the partner collects from the customer. 0 for a prepaid order."
                        rules={[
                          {
                            validator: (_rule, value) =>
                              Number(value || 0) <= owed + 0.001
                                ? Promise.resolve()
                                : Promise.reject(
                                    new Error(
                                      `The customer owes ${owed.toFixed(2)}`,
                                    ),
                                  ),
                          },
                        ]}
                      >
                        <InputNumber
                          min={0}
                          precision={2}
                          style={{ width: "100%" }}
                          disabled={locked}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={12} sm={8}>
                      <Form.Item
                        label={
                          status === "RETURNED"
                            ? "Return charge"
                            : "Delivery charge"
                        }
                        name="delivery_charge"
                      >
                        <InputNumber
                          min={0}
                          precision={2}
                          style={{ width: "100%" }}
                          disabled={locked}
                        />
                      </Form.Item>
                    </Col>
                    <Col
                      xs={12}
                      sm={8}
                      style={
                        status === "RETURNED" ? { display: "none" } : undefined
                      }
                    >
                      <Form.Item label="COD fee" name="cod_fee">
                        <InputNumber
                          min={0}
                          precision={2}
                          style={{ width: "100%" }}
                          disabled={locked}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Typography.Text type="secondary">
                    {status === "DELIVERED" ? (
                      <>
                        Once delivered, the partner owes you{" "}
                        <Money
                          value={deliveredNet({
                            cod_amount: getFieldValue("cod_amount"),
                            delivery_charge: getFieldValue("delivery_charge"),
                            cod_fee: getFieldValue("cod_fee"),
                          })}
                        />{" "}
                        for this order, and the customer&apos;s due is marked
                        paid.
                      </>
                    ) : status === "RETURNED" ? (
                      <>A returned order costs you the return charge only.</>
                    ) : (
                      <>
                        Nothing is owed until the order is delivered or
                        returned.
                      </>
                    )}
                  </Typography.Text>
                </>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OnlineOrders;
