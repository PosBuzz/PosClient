import {
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  Input,
  message,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Tooltip,
  Popconfirm,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import debounce from "lodash/debounce";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { inventoryApi, InventoryTransfer } from "../../api/inventory-api";
import CenterLoader from "../../components/CenterLoader";
import PageTitle from "../../components/PageTitle";
import { useModalStore } from "../../stores/modalStore";
import { useMessageStore } from "../../stores/messageStore";

const { Text } = Typography;
const { Option } = Select;

export default function InventoryTransfersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { modal } = useModalStore();
  const { messageApi } = useMessageStore();

  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [branchFilter, setBranchFilter] = useState<number | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Debounce search
  const debouncedSearch = useCallback(
    debounce((nextValue: string) => setDebouncedSearchText(nextValue), 500),
    []
  );

  useEffect(() => {
    debouncedSearch(searchText);
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchText, debouncedSearch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchText, statusFilter, branchFilter]);

  // Queries
  const { data: transfersData, isLoading: transfersLoading } = useQuery({
    queryKey: [
      "transfers",
      currentPage,
      pageSize,
      debouncedSearchText,
      statusFilter,
      branchFilter,
    ],
    queryFn: () =>
      inventoryApi.getTransfers({
        page: currentPage,
        limit: pageSize,
        status: statusFilter,
        branch_id: branchFilter,
      }),
  });

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: () => inventoryApi.getBranches(),
  });

  // Mutations
  const completeMutation = useMutation({
    mutationFn: inventoryApi.completeTransfer,
    onSuccess: () => {
      messageApi?.success("Transfer completed successfully");
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to complete transfer"
      );
    },
  });

  const cancelMutation = useMutation({
    mutationFn: inventoryApi.cancelTransfer,
    onSuccess: () => {
      messageApi?.success("Transfer cancelled successfully");
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to cancel transfer"
      );
    },
  });

  const handleView = (transfer: InventoryTransfer) => {
    modal?.info({
      title: "Transfer Details",
      width: 800,
      content: (
        <div style={{ marginTop: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Text strong>Transfer ID:</Text>
              <br />
              <Text>{transfer.id}</Text>
            </Col>
            <Col span={12}>
              <Text strong>Status:</Text>
              <br />
              <Tag color={getStatusColor(transfer.status)}>
                {transfer.status.toUpperCase()}
              </Tag>
            </Col>
            <Col span={12}>
              <Text strong>From:</Text>
              <br />
              <Text>{transfer.source_branch?.name || "Warehouse"}</Text>
            </Col>
            <Col span={12}>
              <Text strong>To:</Text>
              <br />
              <Text>{transfer.destination_branch?.name || "Warehouse"}</Text>
            </Col>
            <Col span={12}>
              <Text strong>Created By:</Text>
              <br />
              <Text>{transfer.created_by_user.name}</Text>
            </Col>
            <Col span={12}>
              <Text strong>Created Date:</Text>
              <br />
              <Text>
                {dayjs(transfer.created_at).format("MMM DD, YYYY HH:mm")}
              </Text>
            </Col>
            {transfer.completed_date && (
              <Col span={24}>
                <Text strong>Completed Date:</Text>
                <br />
                <Text>
                  {dayjs(transfer.completed_date).format("MMM DD, YYYY HH:mm")}
                </Text>
              </Col>
            )}
            {transfer.notes && (
              <Col span={24}>
                <Text strong>Notes:</Text>
                <br />
                <Text>{transfer.notes}</Text>
              </Col>
            )}
          </Row>

          <div style={{ marginTop: 24 }}>
            <Text strong>Items:</Text>
            <Table
              dataSource={transfer.items}
              rowKey="id"
              pagination={false}
              size="small"
              style={{ marginTop: 8 }}
              columns={[
                {
                  title: "Product",
                  render: (_, item) => (
                    <div>
                      <div>{item.batch.variant.product.name}</div>
                      <Text type="secondary" style={{ fontSize: "12px" }}>
                        {item.batch.variant.name} - {item.batch.batch_number}
                      </Text>
                    </div>
                  ),
                },
                {
                  title: "Quantity",
                  dataIndex: "quantity",
                  align: "right",
                  render: (qty) => `${qty} units`,
                },
                {
                  title: "Cost Price",
                  render: (_, item) =>
                    `$${parseFloat(item.batch.cost_price).toFixed(2)}`,
                  align: "right",
                },
                {
                  title: "Total Value",
                  render: (_, item) =>
                    `$${(
                      parseFloat(item.batch.cost_price) * item.quantity
                    ).toFixed(2)}`,
                  align: "right",
                },
              ]}
            />
          </div>
        </div>
      ),
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "orange";
      case "completed":
        return "green";
      case "cancelled":
        return "red";
      default:
        return "default";
    }
  };

  const columns: ColumnsType<InventoryTransfer> = [
    {
      title: "Transfer ID",
      dataIndex: "id",
      key: "id",
      render: (id) => <Text code>#{id}</Text>,
    },
    {
      title: "From → To",
      key: "route",
      render: (_, record) => (
        <div>
          <div>
            <strong>{record.source_branch?.name || "Warehouse"}</strong>
          </div>
          <div style={{ fontSize: "12px", color: "#666" }}>
            ↓ to {record.destination_branch?.name || "Warehouse"}
          </div>
        </div>
      ),
    },
    {
      title: "Items",
      key: "items",
      align: "center",
      render: (_, record) => (
        <div>
          <div>
            <strong>{record.items.length}</strong>
          </div>
          <div style={{ fontSize: "12px", color: "#666" }}>items</div>
        </div>
      ),
    },
    {
      title: "Total Units",
      key: "total_units",
      align: "center",
      render: (_, record) => (
        <Text strong>
          {record.items.reduce((sum, item) => sum + item.quantity, 0)} units
        </Text>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => (
        <Tag color={getStatusColor(status)}>{status.toUpperCase()}</Tag>
      ),
    },
    {
      title: "Created By",
      key: "created_by",
      render: (_, record) => record.created_by_user.name,
    },
    {
      title: "Created Date",
      dataIndex: "created_at",
      key: "created_at",
      render: (date) => dayjs(date).format("MMM DD, YYYY"),
    },
    {
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            />
          </Tooltip>

          {record.status === "pending" && (
            <>
              <Popconfirm
                title="Complete Transfer"
                description="Are you sure you want to complete this transfer? This will move the inventory."
                onConfirm={() => completeMutation.mutate(record.id)}
                okText="Yes, Complete"
                cancelText="Cancel"
              >
                <Tooltip title="Complete Transfer">
                  <Button
                    type="primary"
                    size="small"
                    icon={<CheckOutlined />}
                    loading={
                      completeMutation.isPending &&
                      completeMutation.variables === record.id
                    }
                  />
                </Tooltip>
              </Popconfirm>

              <Popconfirm
                title="Cancel Transfer"
                description="Are you sure you want to cancel this transfer?"
                onConfirm={() => cancelMutation.mutate(record.id)}
                okText="Yes, Cancel"
                cancelText="No"
                okType="danger"
              >
                <Tooltip title="Cancel Transfer">
                  <Button
                    danger
                    size="small"
                    icon={<CloseOutlined />}
                    loading={
                      cancelMutation.isPending &&
                      cancelMutation.variables === record.id
                    }
                  />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  if (branchesLoading && currentPage === 1) {
    return <CenterLoader />;
  }

  return (
    <>
      <PageTitle
        title="Inventory Transfers"
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Inventory", href: "/inventory" },
          { title: "Transfers" },
        ]}
        rightSection={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/inventory/transfers/add")}
          >
            Create Transfer
          </Button>
        }
      />

      {/* Filters */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Search transfers..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="All Statuses"
              style={{ width: "100%" }}
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
            >
              <Option value="pending">Pending</Option>
              <Option value="completed">Completed</Option>
              <Option value="cancelled">Cancelled</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="All Branches"
              style={{ width: "100%" }}
              value={branchFilter}
              onChange={setBranchFilter}
              allowClear
              loading={branchesLoading}
            >
              {branches.map((branch) => (
                <Option key={branch.id} value={branch.id}>
                  {branch.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setSearchText("");
                setDebouncedSearchText("");
                setStatusFilter(undefined);
                setBranchFilter(undefined);
                setCurrentPage(1);
              }}
              style={{ width: "100%" }}
            >
              Reset
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={transfersData?.data || []}
          rowKey="id"
          loading={transfersLoading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: transfersData?.meta.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} transfers`,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size || 10);
            },
          }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </>
  );
}
