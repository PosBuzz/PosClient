import { CurrencyIcon } from "../../components/Currency";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { purchasePaymentsApi } from "../../api/purchase-payments-api";
import PageTitle from "../../components/PageTitle";
import PaymentMethodSection from "../../components/PaymentMethodSection";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { useMessageStore } from "../../stores/messageStore";
import {
  MakePurchasePaymentForm,
  PurchasePayment,
} from "../../types/purchase-payment.types";
import { PaymentMethod } from "../../types/sale.types";
import { PAYMENT_METHODS_REQUIRING_PROVIDER } from "../../utils/payment-provider.utils";
import { formatCurrency } from "../../utils/formatters";
import { setPageTitle } from "../../utils/setPageTitle";
import { getErrorMessage } from "../../utils/api-error";

const { Text } = Typography;

const MakePurchasePayment = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { messageApi } = useMessageStore();
  const queryClient = useQueryClient();
  const [payments, setPayments] = useState<PurchasePayment[]>([
    { payment_method: PaymentMethod.CASH, amount: 0, reference: "" },
  ]);

  // Fetch batch details
  const batchQuery = useQuery({
    queryKey: [queryKeys.batchForPayment, parseInt(id || "0")],
    queryFn: () => purchasePaymentsApi.getBatchForPayment(parseInt(id!)),
    enabled: !!id,
    staleTime: queryStaleTimeMap[queryKeys.batchForPayment],
    retry: (failureCount: number, error: any) => {
      if (error?.response?.status === 404) return false;
      return failureCount < 3;
    },
  });

  const batch = batchQuery.data;
  const loading = batchQuery.isLoading;

  useEffect(() => {
    if (batchQuery.isError) {
      messageApi?.error("Failed to load batch details");
      navigate("/purchase-payments");
    }
  }, [batchQuery.isError, navigate]);

  useEffect(() => {
    if (batch) {
      setPageTitle(`Make Payment - Batch #${batch.batch_number}`);
      // Set default payment amount to remaining amount
      setPayments([
        {
          payment_method: PaymentMethod.CASH,
          amount: batch.remaining_amount,
          reference: "",
        },
      ]);
    }
  }, [batch]);

  // Make payment mutation
  const makePaymentMutation = useMutation({
    mutationFn: (data: MakePurchasePaymentForm) =>
      purchasePaymentsApi.makePayment(data),
    onSuccess: async (_response, variables) => {
      messageApi?.success("Payment recorded successfully!");

      queryClient.removeQueries({
        queryKey: [queryKeys.batchForPayment, variables.batch_id],
        exact: true,
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [queryKeys.purchasePaymentBatches],
          refetchType: "all",
        }),
        queryClient.invalidateQueries({
          queryKey: [queryKeys.batchForPayment],
          refetchType: "all",
        }),
        queryClient.invalidateQueries({
          queryKey: [queryKeys.batchPayments, variables.batch_id],
        }),
        queryClient.invalidateQueries({
          queryKey: [queryKeys.batches],
        }),
        queryClient.invalidateQueries({
          queryKey: [queryKeys.vendorDetails],
        }),
      ]);

      navigate("/purchase-payments");
    },
    onError: (error: any) => {
      messageApi?.error(getErrorMessage(error, "Failed to record payment"));
    },
  });

  const handleSubmit = () => {
    if (!batch) return;
    if (batch.quantity <= 0 || batch.remaining_amount <= 0) {
      messageApi?.error("This batch has no payable quantity or balance");
      return;
    }

    // Validate payments
    const validPayments = payments.filter((p) => p.amount > 0);
    if (validPayments.length === 0) {
      messageApi?.error("Please add at least one payment with an amount");
      return;
    }

    // Validate providers
    for (const payment of validPayments) {
      if (
        PAYMENT_METHODS_REQUIRING_PROVIDER.includes(payment.payment_method) &&
        !payment.payment_type
      ) {
        messageApi?.error(
          `${payment.payment_method} payment must have a provider selected`,
        );
        return;
      }
    }

    const totalPaymentAmount = validPayments.reduce(
      (sum, p) => sum + p.amount,
      0,
    );

    if (totalPaymentAmount > batch.remaining_amount) {
      messageApi?.error(
        `Total payment amount (${formatCurrency(
          totalPaymentAmount,
        )}) exceeds remaining amount (${formatCurrency(batch.remaining_amount)})`,
      );
      return;
    }

    const paymentData: MakePurchasePaymentForm = {
      batch_id: parseInt(id!),
      payments: validPayments,
    };

    makePaymentMutation.mutate(paymentData);
  };

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case PaymentMethod.CASH:
        return "green";
      case PaymentMethod.CARD:
        return "blue";
      case PaymentMethod.BANK_TRANSFER:
        return "purple";
      case PaymentMethod.CHEQUE:
        return "orange";
      case PaymentMethod.MOBILE_MONEY:
      case PaymentMethod.MFS:
        return "cyan";
      default:
        return "default";
    }
  };

  // Payment history columns
  const paymentColumns = [
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      width: 140,
      render: (date: string) => dayjs(date).format("MMM DD, YYYY HH:mm"),
    },
    {
      title: "Method",
      dataIndex: "payment_method",
      key: "payment_method",
      width: 130,
      render: (method: string) => (
        <Tag color={getPaymentMethodColor(method)}>
          {method?.replace(/_/g, " ")}
        </Tag>
      ),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      width: 110,
      align: "right" as const,
      render: (amount: number) => (
        <Text strong style={{ color: "#52c41a" }}>
          {formatCurrency(amount)}
        </Text>
      ),
    },
    {
      title: "Reference",
      dataIndex: "reference",
      key: "reference",
      render: (ref: string) => ref || "-",
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "100px 0" }}>
        <Spin tip="Loading batch details..." />
      </div>
    );
  }

  if (!batch) return null;

  const canRecordPayment =
    batch.payment_status !== "paid" &&
    batch.quantity > 0 &&
    batch.remaining_amount > 0;
  const totalPaying = payments.reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0,
  );

  return (
    <div>
      <PageTitle
        title={`Make Payment - Batch #${batch.batch_number}`}
        breadcrumbs={[
          { title: "Home" },
          { title: "Purchase Payments", href: "/purchase-payments" },
          { title: canRecordPayment ? "Make Payment" : "Payment Details" },
        ]}
        rightSection={
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/purchase-payments")}
          >
            Back to Purchase Payments
          </Button>
        }
      />

      <Row gutter={[16, 16]}>
        {/* Left Column - Batch Info & Payment History */}
        <Col xs={24} lg={12}>
          <Card title="Batch Information" style={{ marginBottom: 16 }}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Batch Number">
                <Text strong>{batch.batch_number}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Product">
                {batch.variant?.product?.name} - {batch.variant?.name}
              </Descriptions.Item>
              <Descriptions.Item label="Branch">
                {batch.branch?.name}
              </Descriptions.Item>
              <Descriptions.Item label="Vendor">
                {batch.vendor?.name || "No vendor"}
              </Descriptions.Item>
              <Descriptions.Item label="Quantity">
                {batch.quantity}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag
                  color={
                    batch.payment_status === "due"
                      ? "red"
                      : batch.payment_status === "partial"
                        ? "orange"
                        : "green"
                  }
                >
                  {batch.payment_status?.toUpperCase()}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Total Cost">
                <Text strong style={{ fontSize: 16 }}>
                  {formatCurrency(batch.total_cost)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Paid Amount">
                <Text style={{ fontSize: 16, color: "#52c41a" }}>
                  {formatCurrency(batch.paid_amount)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Remaining Amount">
                <Text strong style={{ fontSize: 18, color: "#ff4d4f" }}>
                  {formatCurrency(batch.remaining_amount)}
                </Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Payment History */}
          {batch.purchasePayments && batch.purchasePayments.length > 0 && (
            <Card title="Payment History">
              <Table
                columns={paymentColumns}
                dataSource={batch.purchasePayments}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </Card>
          )}
        </Col>

        {/* Right Column - Payment Form */}
        <Col xs={24} lg={12}>
          <Card
            title={canRecordPayment ? "Record New Payment" : "Payment Details"}
          >
            {canRecordPayment ? (
              <>
                <PaymentMethodSection
                  payments={payments}
                  onChange={setPayments}
                  maxAmount={batch.remaining_amount}
                />

                <Divider />

                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <Text>Total Payment Amount:</Text>
                    <Text strong style={{ fontSize: 16, color: "#1890ff" }}>
                      {formatCurrency(totalPaying)}
                    </Text>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text>Remaining After Payment:</Text>
                    <Text
                      strong
                      style={{
                        fontSize: 16,
                        color:
                          batch.remaining_amount - totalPaying <= 0
                            ? "#52c41a"
                            : "#ff4d4f",
                      }}
                    >
                      {formatCurrency(
                        Math.max(0, batch.remaining_amount - totalPaying),
                      )}
                    </Text>
                  </div>
                </div>

                <Divider />

                <Space style={{ width: "100%" }}>
                  <Button
                    type="primary"
                    icon={<CurrencyIcon />}
                    loading={makePaymentMutation.isPending}
                    onClick={handleSubmit}
                  >
                    Record Payment
                  </Button>
                  <Button
                    onClick={() => navigate("/purchase-payments")}
                    disabled={makePaymentMutation.isPending}
                  >
                    Cancel
                  </Button>
                </Space>
              </>
            ) : (
              <Text type="secondary">
                This batch has no payable quantity or balance. Review the
                payment history on the left.
              </Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default MakePurchasePayment;
