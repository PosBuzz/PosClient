import {
  GiftOutlined,
  HistoryOutlined,
  MinusOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import InputNumber from "../../components/NumberInput";
import type { TablePaginationConfig } from "antd";
import React, { useEffect, useState } from "react";
import { rewardsApi } from "../../api/rewards.api";
import PageTitle from "../../components/PageTitle";
import { useMessageStore } from "../../stores/messageStore";
import {
  AdjustPointsDto,
  CustomerRewardsPoints,
  RedeemPointsDto,
  RewardsFilters,
  RewardsPointTransaction,
  RewardsTransactionType,
} from "../../types/rewards.types";
import { setPageTitle } from "../../utils/setPageTitle";
import { getErrorMessage } from "../../utils/api-error";

const { Text } = Typography;
const { Search } = Input;

const CustomerRewardsPage: React.FC = () => {
  const title = "Customer Rewards";
  const { messageApi } = useMessageStore();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerRewardsPoints[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [filters, setFilters] = useState<RewardsFilters>({});

  // Modal states
  const [redeemModalVisible, setRedeemModalVisible] = useState(false);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [transactionHistoryVisible, setTransactionHistoryVisible] =
    useState(false);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerRewardsPoints | null>(null);
  const [processing, setProcessing] = useState(false);
  const [transactions, setTransactions] = useState<RewardsPointTransaction[]>(
    [],
  );
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [transactionPagination, setTransactionPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  const [redeemForm] = Form.useForm();
  const [adjustForm] = Form.useForm();

  const loadCustomers = async (
    newFilters?: RewardsFilters,
    page?: number,
    pageSize?: number,
  ) => {
    setLoading(true);
    try {
      const requestedPage = page || pagination.current;
      const requestedLimit = pageSize || pagination.pageSize;
      const searchFilters = {
        ...filters,
        ...newFilters,
        page: requestedPage,
        limit: requestedLimit,
      };

      const response = await rewardsApi.getCustomersWithPoints(searchFilters);

      setCustomers(response.data);
      setPagination({
        current: response.meta?.page ?? requestedPage,
        pageSize: response.meta?.limit ?? requestedLimit,
        total: response.meta?.total ?? 0,
      });
    } catch (error) {
      messageApi?.error(
        getErrorMessage(error, "Failed to load customer rewards data"),
      );
      console.error("Error loading customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    const newFilters = { ...filters, search: value || undefined };
    setFilters(newFilters);
    loadCustomers(newFilters, 1);
  };

  const handleTableChange = (newPagination: TablePaginationConfig) => {
    const nextPageSize = newPagination.pageSize ?? pagination.pageSize;
    // Reset to the first page when the page size changes, otherwise the
    // requested page may no longer exist.
    const nextPage =
      nextPageSize !== pagination.pageSize ? 1 : (newPagination.current ?? 1);
    loadCustomers(filters, nextPage, nextPageSize);
  };

  const handleRedeem = async (values: RedeemPointsDto) => {
    if (!selectedCustomer) return;

    setProcessing(true);
    try {
      await rewardsApi.redeemPoints(selectedCustomer.customer_id, values);
      messageApi?.success("Points redeemed successfully");
      setRedeemModalVisible(false);
      redeemForm.resetFields();
      loadCustomers();
    } catch (error: any) {
      messageApi?.error(getErrorMessage(error, "Failed to redeem points"));
    } finally {
      setProcessing(false);
    }
  };

  const handleAdjust = async (values: AdjustPointsDto) => {
    if (!selectedCustomer) return;

    setProcessing(true);
    try {
      await rewardsApi.adjustPoints(selectedCustomer.customer_id, values);
      messageApi?.success("Points adjusted successfully");
      setAdjustModalVisible(false);
      adjustForm.resetFields();
      loadCustomers();
    } catch (error: any) {
      messageApi?.error(getErrorMessage(error, "Failed to adjust points"));
    } finally {
      setProcessing(false);
    }
  };

  const openRedeemModal = (customer: CustomerRewardsPoints) => {
    setSelectedCustomer(customer);
    setRedeemModalVisible(true);
  };

  const openAdjustModal = (customer: CustomerRewardsPoints) => {
    setSelectedCustomer(customer);
    setAdjustModalVisible(true);
  };

  const openTransactionHistory = async (customer: CustomerRewardsPoints) => {
    setSelectedCustomer(customer);
    setTransactionHistoryVisible(true);
    await loadTransactions(
      customer.customer_id,
      1,
      transactionPagination.pageSize,
    );
  };

  const loadTransactions = async (
    customerId: number,
    page = transactionPagination.current,
    pageSize = transactionPagination.pageSize,
  ) => {
    setTransactionLoading(true);
    try {
      const response = await rewardsApi.getCustomerTransactions(customerId, {
        page,
        limit: pageSize,
      });
      setTransactions(response.data);
      setTransactionPagination({
        current: response.meta?.page ?? page,
        pageSize: response.meta?.limit ?? pageSize,
        total: response.meta?.total ?? 0,
      });
    } catch (error) {
      messageApi?.error(
        getErrorMessage(error, "Failed to load transaction history"),
      );
      console.error("Error loading transactions:", error);
    } finally {
      setTransactionLoading(false);
    }
  };

  const handleTransactionTableChange = (
    newPagination: TablePaginationConfig,
  ) => {
    if (!selectedCustomer) return;
    const nextPageSize =
      newPagination.pageSize ?? transactionPagination.pageSize;
    const nextPage =
      nextPageSize !== transactionPagination.pageSize
        ? 1
        : (newPagination.current ?? 1);
    loadTransactions(selectedCustomer.customer_id, nextPage, nextPageSize);
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const columns = [
    {
      title: "Customer",
      key: "customer",
      render: (record: CustomerRewardsPoints) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.customer.name}</div>
          {record.customer.phone && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.customer.phone}
            </Text>
          )}
          {record.customer.email && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.customer.email}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Current Points",
      dataIndex: "total_points",
      key: "total_points",
      render: (points: number) => (
        <Tag color={points > 0 ? "green" : "default"} style={{ fontSize: 14 }}>
          <GiftOutlined /> {points.toLocaleString()}
        </Tag>
      ),
    },
    {
      title: "Lifetime Earned",
      dataIndex: "lifetime_earned",
      key: "lifetime_earned",
      render: (points: number) => (
        <Text type="success">{points.toLocaleString()}</Text>
      ),
    },
    {
      title: "Lifetime Redeemed",
      dataIndex: "lifetime_redeemed",
      key: "lifetime_redeemed",
      render: (points: number) => (
        <Text type="warning">{points.toLocaleString()}</Text>
      ),
    },
    {
      title: "Last Activity",
      key: "last_activity",
      render: (record: CustomerRewardsPoints) => {
        const lastEarned = record.last_earned_at
          ? new Date(record.last_earned_at)
          : null;
        const lastRedeemed = record.last_redeemed_at
          ? new Date(record.last_redeemed_at)
          : null;

        let lastActivity: Date | null = null;
        let activityType = "";

        if (lastEarned && lastRedeemed) {
          if (lastEarned > lastRedeemed) {
            lastActivity = lastEarned;
            activityType = "Earned";
          } else {
            lastActivity = lastRedeemed;
            activityType = "Redeemed";
          }
        } else if (lastEarned) {
          lastActivity = lastEarned;
          activityType = "Earned";
        } else if (lastRedeemed) {
          lastActivity = lastRedeemed;
          activityType = "Redeemed";
        }

        return lastActivity ? (
          <div>
            <div style={{ fontSize: 12 }}>{activityType}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {lastActivity.toLocaleDateString()}
            </Text>
          </div>
        ) : (
          <Text type="secondary">No activity</Text>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      render: (record: CustomerRewardsPoints) => (
        <Space>
          <Tooltip title="Redeem Points">
            <Button
              type="primary"
              size="small"
              icon={<MinusOutlined />}
              onClick={() => openRedeemModal(record)}
              disabled={record.total_points === 0}
            />
          </Tooltip>
          <Tooltip title="Adjust Points">
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() => openAdjustModal(record)}
            />
          </Tooltip>
          <Tooltip title="Transaction History">
            <Button
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => openTransactionHistory(record)}
            />
          </Tooltip>
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
          {
            title: "Dashboard",
            href: "/",
          },
          {
            title: title,
          },
        ]}
      />

      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card>
            <div style={{ marginBottom: 16 }}>
              <Search
                placeholder="Search customers by name, phone, or email"
                allowClear
                onSearch={handleSearch}
                style={{ width: 400 }}
              />
            </div>

            <Table
              columns={columns}
              dataSource={customers}
              rowKey="id"
              loading={loading}
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} customers`,
              }}
              onChange={handleTableChange}
            />
          </Card>
        </Col>
      </Row>

      {/* Redeem Points Modal */}
      <Modal
        title={`Redeem Points - ${selectedCustomer?.customer.name}`}
        open={redeemModalVisible}
        onCancel={() => {
          setRedeemModalVisible(false);
          redeemForm.resetFields();
        }}
        footer={null}
      >
        {selectedCustomer && (
          <>
            <div
              style={{
                marginBottom: 16,
                padding: 12,
                // backgroundColor: "#f5f5f5",
                borderRadius: 6,
              }}
            >
              <Text>Available Points: </Text>
              <Tag color="green" style={{ fontSize: 14 }}>
                <GiftOutlined />{" "}
                {selectedCustomer.total_points.toLocaleString()}
              </Tag>
            </div>

            <Form form={redeemForm} layout="vertical" onFinish={handleRedeem}>
              <Form.Item
                name="points"
                label="Points to Redeem"
                rules={[
                  {
                    required: true,
                    message: "Please enter points to redeem",
                  },
                  {
                    type: "number",
                    min: 1,
                    max: selectedCustomer.total_points,
                    message: `Must be between 1 and ${selectedCustomer.total_points}`,
                  },
                ]}
              >
                <InputNumber
                  min={1}
                  max={selectedCustomer.total_points}
                  style={{ width: "100%" }}
                  placeholder="Enter points to redeem"
                />
              </Form.Item>

              <Form.Item name="reference" label="Reference (Optional)">
                <Input placeholder="e.g., Receipt number, transaction ID" />
              </Form.Item>

              <Form.Item name="notes" label="Notes (Optional)">
                <Input.TextArea placeholder="Additional notes" rows={3} />
              </Form.Item>

              <Form.Item>
                <Space style={{ width: "100%", justifyContent: "flex-end" }}>
                  <Button onClick={() => setRedeemModalVisible(false)}>
                    Cancel
                  </Button>
                  <Button type="primary" htmlType="submit" loading={processing}>
                    Redeem Points
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* Adjust Points Modal */}
      <Modal
        title={`Adjust Points - ${selectedCustomer?.customer.name}`}
        open={adjustModalVisible}
        onCancel={() => {
          setAdjustModalVisible(false);
          adjustForm.resetFields();
        }}
        footer={null}
      >
        {selectedCustomer && (
          <>
            <div
              style={{
                marginBottom: 16,
                padding: 12,
                // backgroundColor: "#f5f5f5",
                borderRadius: 6,
              }}
            >
              <Text>Current Points: </Text>
              <Tag color="green" style={{ fontSize: 14 }}>
                <GiftOutlined />{" "}
                {selectedCustomer.total_points.toLocaleString()}
              </Tag>
            </div>

            <Form form={adjustForm} layout="vertical" onFinish={handleAdjust}>
              <Form.Item
                name="points"
                label="Points Adjustment"
                rules={[
                  {
                    required: true,
                    message: "Please enter points adjustment",
                  },
                  { type: "number", message: "Must be a number" },
                ]}
                extra="Use positive numbers to add points, negative to remove points"
              >
                <InputNumber
                  style={{ width: "100%" }}
                  placeholder="e.g., 100 (add) or -50 (remove)"
                />
              </Form.Item>

              <Form.Item
                name="description"
                label="Reason"
                rules={[
                  {
                    required: true,
                    message: "Please provide a reason for the adjustment",
                  },
                ]}
              >
                <Input placeholder="e.g., Customer service credit, Correction" />
              </Form.Item>

              <Form.Item name="notes" label="Notes (Optional)">
                <Input.TextArea placeholder="Additional notes" rows={3} />
              </Form.Item>

              <Form.Item>
                <Space style={{ width: "100%", justifyContent: "flex-end" }}>
                  <Button onClick={() => setAdjustModalVisible(false)}>
                    Cancel
                  </Button>
                  <Button type="primary" htmlType="submit" loading={processing}>
                    Adjust Points
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* Transaction History Modal */}
      <Modal
        title={`Transaction History - ${selectedCustomer?.customer.name}`}
        open={transactionHistoryVisible}
        onCancel={() => {
          setTransactionHistoryVisible(false);
          setTransactions([]);
          setTransactionPagination((prev) => ({
            ...prev,
            current: 1,
            total: 0,
          }));
        }}
        footer={null}
        width={800}
      >
        {selectedCustomer && (
          <>
            <div
              style={{
                marginBottom: 16,
                padding: 12,
                // backgroundColor: "#f5f5f5",
                borderRadius: 6,
              }}
            >
              <Row gutter={16}>
                <Col span={8}>
                  <Text>Current Points: </Text>
                  <Tag color="green" style={{ fontSize: 14 }}>
                    <GiftOutlined />{" "}
                    {selectedCustomer.total_points.toLocaleString()}
                  </Tag>
                </Col>
                <Col span={8}>
                  <Text>Lifetime Earned: </Text>
                  <Tag color="blue" style={{ fontSize: 14 }}>
                    {selectedCustomer.lifetime_earned.toLocaleString()}
                  </Tag>
                </Col>
                <Col span={8}>
                  <Text>Lifetime Redeemed: </Text>
                  <Tag color="orange" style={{ fontSize: 14 }}>
                    {selectedCustomer.lifetime_redeemed.toLocaleString()}
                  </Tag>
                </Col>
              </Row>
            </div>

            <Table
              columns={[
                {
                  title: "Date",
                  dataIndex: "created_at",
                  key: "created_at",
                  render: (date: string) => new Date(date).toLocaleString(),
                  width: 150,
                },
                {
                  title: "Type",
                  dataIndex: "type",
                  key: "type",
                  render: (type: RewardsTransactionType) => (
                    <Tag
                      color={
                        type === RewardsTransactionType.EARN
                          ? "green"
                          : type === RewardsTransactionType.REDEEM
                            ? "orange"
                            : "blue"
                      }
                    >
                      {type}
                    </Tag>
                  ),
                  width: 100,
                },
                {
                  title: "Points",
                  dataIndex: "points",
                  key: "points",
                  render: (points: number, record: RewardsPointTransaction) => (
                    <Text
                      style={{
                        color:
                          record.type === RewardsTransactionType.EARN
                            ? "#52c41a"
                            : record.type === RewardsTransactionType.REDEEM
                              ? "#fa8c16"
                              : "#1890ff",
                        fontWeight: 500,
                      }}
                    >
                      {record.type === RewardsTransactionType.EARN
                        ? "+"
                        : record.type === RewardsTransactionType.REDEEM
                          ? "-"
                          : ""}
                      {Math.abs(points).toLocaleString()}
                    </Text>
                  ),
                  width: 100,
                },
                {
                  title: "Description",
                  dataIndex: "description",
                  key: "description",
                },
                {
                  title: "Reference",
                  dataIndex: "reference",
                  key: "reference",
                  render: (reference: string) => reference || "-",
                  width: 120,
                },
                {
                  title: "Balance After",
                  dataIndex: "balance_after",
                  key: "balance_after",
                  render: (balance: number) => (
                    <Text>{balance.toLocaleString()}</Text>
                  ),
                  width: 120,
                },
              ]}
              dataSource={transactions}
              rowKey="id"
              loading={transactionLoading}
              pagination={{
                current: transactionPagination.current,
                pageSize: transactionPagination.pageSize,
                total: transactionPagination.total,
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 50],
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} transactions`,
              }}
              onChange={handleTransactionTableChange}
              size="small"
            />
          </>
        )}
      </Modal>
    </>
  );
};

export default CustomerRewardsPage;
