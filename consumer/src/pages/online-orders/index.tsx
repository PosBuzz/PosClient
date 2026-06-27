import { useQuery } from "@tanstack/react-query";
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
} from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { salesApi } from "../../api/sales-api";
import { Money } from "../../components/Currency";
import PageTitle from "../../components/PageTitle";
import { useAuthStore } from "../../stores/authStore";
import { useMessageStore } from "../../stores/messageStore";
import { Sale } from "../../types/sale.types";
import { EyeOutlined, SyncOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { setPageTitle } from "../../utils/setPageTitle";

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
  const { user } = useAuthStore();
  const { messageApi } = useMessageStore();

  // Filter state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<number | undefined>();
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  
  // Status update modal state
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Sale | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [form] = Form.useForm();

  const userBranches = user?.branches || [];

  // Fetch online orders
  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: ["online-orders", page, limit, search, selectedBranch, selectedStatus, dateRange],
    queryFn: () => {
      const filters: any = { page, limit };
      if (search) filters.search = search;
      if (selectedBranch) filters.branch_id = selectedBranch;
      if (selectedStatus) filters.status = selectedStatus;
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
    form.setFieldsValue({ status: order.online_order_status });
    setStatusModalVisible(true);
  };

  const handleStatusSubmit = async () => {
    try {
      const values = await form.validateFields();
      setUpdatingStatus(true);
      
      await salesApi.updateOnlineOrderStatus(selectedOrder!.id!, values.status);
      
      messageApi?.success("Order status updated successfully");
      setStatusModalVisible(false);
      setSelectedOrder(null);
      form.resetFields();
      refetch();
    } catch (error: any) {
      messageApi?.error(error.message || "Failed to update order status");
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
          <Tag color={colors[status] || "default"}>
            {status.toUpperCase()}
          </Tag>
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
            Update Status
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
          {Object.entries(statsData.by_status || {}).map(([status, data]: [string, any]) => (
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
          ))}
        </Row>
      )}

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <Input
              placeholder="Search by order #, customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={6}>
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
          <Col span={6}>
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
          <Col span={6}>
            <RangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
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
        title={`Update Order Status - ${selectedOrder?.sale_number}`}
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
        </Form>
      </Modal>
    </div>
  );
};

export default OnlineOrders;
