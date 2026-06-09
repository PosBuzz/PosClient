import { ArrowLeftOutlined, DollarOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  Descriptions,
  Row,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { get } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import PageTitle from "../../components/PageTitle";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { VendorDetailsResponse } from "../../types/purchase-payment.types";
import { setPageTitle } from "../../utils/setPageTitle";

const { Text } = Typography;

const paymentStatusColor: Record<string, string> = {
  paid: "green",
  partial: "orange",
  due: "red",
};

const ViewVendor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: [queryKeys.vendorDetails, parseInt(id || "0")],
    queryFn: () => get(endpoints.getVendorDetails(parseInt(id!))),
    enabled: !!id,
    staleTime: queryStaleTimeMap[queryKeys.vendorDetails],
    retry: (failureCount: number, error: any) => {
      if (error?.response?.status === 404) return false;
      return failureCount < 3;
    },
  });

  const vendorDetails = data as VendorDetailsResponse | undefined;

  useEffect(() => {
    if (isError) {
      message.error("Failed to load vendor details");
      navigate("/vendors");
    }
  }, [isError, navigate]);

  useEffect(() => {
    if (vendorDetails) {
      setPageTitle(`Vendor - ${vendorDetails.vendor.name}`);
    }
  }, [vendorDetails]);

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "100px 0" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!vendorDetails) return null;

  const { vendor, batches, allPayments, summary } = vendorDetails;

  // Batch table columns
  const batchColumns = [
    {
      title: "Batch #",
      dataIndex: "batch_number",
      key: "batch_number",
      width: 120,
    },
    {
      title: "Product",
      key: "product",
      render: (_: any, record: any) =>
        `${record.variant.product.name} - ${record.variant.name}`,
    },
    {
      title: "Branch",
      key: "branch",
      render: (_: any, record: any) => record.branch?.name || "-",
    },
    {
      title: "Qty",
      dataIndex: "quantity",
      key: "quantity",
      width: 70,
    },
    {
      title: "Cost Price",
      dataIndex: "cost_price",
      key: "cost_price",
      width: 100,
      render: (val: string) => `$${Number(val).toFixed(2)}`,
    },
    {
      title: "Total Cost",
      dataIndex: "total_cost",
      key: "total_cost",
      width: 110,
      render: (val: number) => `$${Number(val).toFixed(2)}`,
    },
    {
      title: "Paid",
      dataIndex: "paid_amount",
      key: "paid_amount",
      width: 110,
      render: (val: number) => `$${Number(val).toFixed(2)}`,
    },
    {
      title: "Remaining",
      dataIndex: "remaining_amount",
      key: "remaining_amount",
      width: 110,
      render: (val: number) => (
        <Text
          type={Number(val) > 0 ? "danger" : "success"}
          strong={Number(val) > 0}
        >
          ${Number(val).toFixed(2)}
        </Text>
      ),
    },
    {
      title: "Status",
      dataIndex: "payment_status",
      key: "payment_status",
      width: 90,
      render: (status: string) => (
        <Tag color={paymentStatusColor[status] || "default"}>
          {status?.charAt(0).toUpperCase() + status?.slice(1)}
        </Tag>
      ),
    },
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      width: 110,
      render: (date: string) =>
        date ? new Date(date).toLocaleDateString() : "-",
    },
  ];

  // Payment history table columns
  const paymentColumns = [
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      width: 110,
      render: (date: string) =>
        date ? new Date(date).toLocaleDateString() : "-",
    },
    {
      title: "Batch #",
      dataIndex: "batch_number",
      key: "batch_number",
      width: 120,
    },
    {
      title: "Product",
      key: "product",
      render: (_: any, record: any) =>
        `${record.product_name} - ${record.variant_name}`,
    },
    {
      title: "Method",
      dataIndex: "payment_method",
      key: "payment_method",
      width: 130,
      render: (method: string) =>
        method?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ||
        "-",
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      width: 110,
      render: (val: number) => `$${Number(val).toFixed(2)}`,
    },
    {
      title: "Reference",
      dataIndex: "reference",
      key: "reference",
      render: (ref: string) => ref || "-",
    },
  ];

  return (
    <>
      <PageTitle
        title={vendor.name}
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Vendors", href: "/vendors" },
          { title: vendor.name },
        ]}
        rightSection={
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/vendors")}
          >
            Back to Vendors
          </Button>
        }
      />

      <Row gutter={16}>
        {/* Left Column */}
        <Col xs={24} lg={16}>
          {/* Vendor Information */}
          <Card title="Vendor Information" style={{ marginBottom: 16 }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Name">
                {vendor.name}
              </Descriptions.Item>
              <Descriptions.Item label="Contact">
                {vendor.contact || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                {vendor.phone || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {vendor.email || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Address" span={2}>
                {vendor.address || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {new Date(vendor.created_at).toLocaleDateString()}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Purchase History */}
          <Card
            title={`Purchase History (${summary.totalBatches})`}
            style={{ marginBottom: 16 }}
          >
            <Table
              rowKey="id"
              columns={batchColumns}
              dataSource={batches}
              pagination={false}
              scroll={{ x: 1000 }}
              size="small"
            />
          </Card>

          {/* Payment History */}
          {allPayments.length > 0 && (
            <Card
              title={`Payment History (${allPayments.length})`}
              style={{ marginBottom: 16 }}
            >
              <Table
                rowKey="id"
                columns={paymentColumns}
                dataSource={allPayments}
                pagination={false}
                scroll={{ x: 700 }}
                size="small"
              />
            </Card>
          )}
        </Col>

        {/* Right Column - Summary */}
        <Col xs={24} lg={8}>
          <Card style={{ marginBottom: 16 }}>
            <Statistic
              title="Total Purchases"
              value={summary.totalCost}
              precision={2}
              prefix="$"
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
          <Card style={{ marginBottom: 16 }}>
            <Statistic
              title="Total Paid"
              value={summary.totalPaid}
              precision={2}
              prefix="$"
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
          <Card style={{ marginBottom: 16 }}>
            <Statistic
              title="Total Owed"
              value={summary.totalOwed}
              precision={2}
              valueStyle={{ color: summary.totalOwed > 0 ? "#ff4d4f" : "#52c41a" }}
              prefix={<DollarOutlined />}
            />
          </Card>
          <Card>
            <Statistic
              title="Total Batches"
              value={summary.totalBatches}
              valueStyle={{ color: "#722ed1" }}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
};

export default ViewVendor;
