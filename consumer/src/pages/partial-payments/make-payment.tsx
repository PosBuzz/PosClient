import { CurrencyIcon } from "../../components/Currency";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  PlusOutlined,
  PrinterOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Input,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import InputNumber from "../../components/NumberInput";
import dayjs from "dayjs";
import saveAs from "file-saver";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { paymentsApi } from "../../api/payments-api";
import { salesApi } from "../../api/sales-api";
import PageTitle from "../../components/PageTitle";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { useMessageStore } from "../../stores/messageStore";
import { MakePaymentForm } from "../../types/payment.types";
import { PaymentMethod, SalePayment } from "../../types/sale.types";
import { formatCurrency } from "../../utils/formatters";
import { setPageTitle } from "../../utils/setPageTitle";
import { invalidateSalesReports } from "../../utils/invalidate-sales-reports";
import { getErrorMessage } from "../../utils/api-error";

const { Text } = Typography;
const { Option } = Select;

const MakePayment = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { messageApi } = useMessageStore();
  const queryClient = useQueryClient();
  const [downloadingPaymentId, setDownloadingPaymentId] = useState<
    number | null
  >(null);
  const [payments, setPayments] = useState<SalePayment[]>([
    {
      payment_method: PaymentMethod.CASH,
      amount: 0,
      reference: "",
      // notes: "",
    },
  ]);

  // Fetch sale details
  const saleQuery = useQuery({
    queryKey: [queryKeys.saleForPayment, parseInt(id || "0")],
    queryFn: () => paymentsApi.getSaleForPayment(parseInt(id!)),
    enabled: !!id,
    staleTime: queryStaleTimeMap[queryKeys.saleForPayment],
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 404) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const sale = saleQuery.data;
  const loading = saleQuery.isLoading;

  useEffect(() => {
    if (saleQuery.isError) {
      messageApi?.error("Failed to load sale details");
      navigate("/partial-payments");
    }
  }, [saleQuery.isError, navigate]);

  useEffect(() => {
    if (sale) {
      setPageTitle(`Make Payment - Sale #${sale.sale_number}`);
      // Set default payment amount to remaining amount
      setPayments([
        {
          payment_method: PaymentMethod.CASH,
          amount: sale.remaining_amount,
          reference: "",
          // notes: "",
        },
      ]);
    }
  }, [sale]);

  // Make payment mutation
  const makePaymentMutation = useMutation({
    mutationFn: (data: MakePaymentForm) => paymentsApi.makePayment(data),
    onSuccess: () => {
      messageApi?.success("Payment recorded successfully!");
      queryClient.invalidateQueries({ queryKey: [queryKeys.partialPayments] });
      // Collected/due amounts feed the dashboard, EOD and sales reports
      invalidateSalesReports(queryClient);
      navigate("/partial-payments");
    },
    onError: (error: any) => {
      messageApi?.error(getErrorMessage(error, "Failed to record payment"));
    },
  });

  const handleSubmit = () => {
    // Validate payments
    if (payments.length === 0) {
      messageApi?.error("Please add at least one payment method");
      return;
    }

    const totalPaymentAmount = payments.reduce((sum, p) => sum + p.amount, 0);

    if (totalPaymentAmount === 0) {
      messageApi?.error("Total payment amount must be greater than 0");
      return;
    }

    if (totalPaymentAmount > sale!.remaining_amount) {
      messageApi?.error(
        `Total payment amount (${formatCurrency(
          totalPaymentAmount,
        )}) exceeds remaining amount (${formatCurrency(sale!.remaining_amount)})`,
      );
      return;
    }

    const paymentData: MakePaymentForm = {
      sale_id: parseInt(id!),
      payments: payments,
    };

    makePaymentMutation.mutate(paymentData);
  };

  const getPaymentMethodColor = (method: PaymentMethod) => {
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

  // Money receipt for one payment: its own date, method, reference and the
  // balance before/after, unlike the sale-level receipt.
  const handleDownloadPaymentReceipt = async (paymentId: number) => {
    if (!id) return;
    setDownloadingPaymentId(paymentId);
    try {
      const blob = await salesApi.generatePaymentReceipt(
        parseInt(id),
        paymentId,
      );
      saveAs(blob, `money-receipt-${sale?.sale_number}-${paymentId}.pdf`);
    } catch (error) {
      messageApi?.error(
        getErrorMessage(error, "Failed to download money receipt"),
      );
    } finally {
      setDownloadingPaymentId(null);
    }
  };

  // Payment history columns
  const paymentColumns = [
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      render: (date: string) => dayjs(date).format("MMM DD, YYYY HH:mm"),
    },
    {
      title: "Method",
      dataIndex: "payment_method",
      key: "payment_method",
      render: (method: PaymentMethod) => (
        <Tag color={getPaymentMethodColor(method)}>
          {method.replace(/_/g, " ")}
        </Tag>
      ),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
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
    {
      title: "Notes",
      dataIndex: "notes",
      key: "notes",
      render: (notes: string) => notes || "-",
    },
    {
      title: "Receipt",
      key: "receipt",
      align: "right" as const,
      width: 90,
      render: (record: SalePayment & { id: number }) => (
        <Tooltip title="Download money receipt for this payment">
          <Button
            type="text"
            size="small"
            icon={<PrinterOutlined />}
            loading={downloadingPaymentId === record.id}
            onClick={() => handleDownloadPaymentReceipt(record.id)}
          />
        </Tooltip>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "100px 0" }}>
        <Spin tip="Loading sale details..." />
      </div>
    );
  }

  if (!sale) {
    return null;
  }

  return (
    <div>
      <PageTitle
        title={`Make Payment - Sale #${sale.sale_number}`}
        breadcrumbs={[
          { title: "Home" },
          { title: "Due Payments" },
          { title: "Make Payment" },
        ]}
        rightSection={
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/partial-payments")}
            style={{ marginBottom: 16 }}
          >
            Back to Due Payments
          </Button>
        }
      />

      <Row gutter={[16, 16]}>
        {/* Sale Information */}
        <Col xs={24} lg={12}>
          <Card title="Sale Information" style={{ marginBottom: 16 }}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Sale Number">
                <Text strong>{sale.sale_number}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Sale Date">
                {dayjs(sale.sale_date).format("MMM DD, YYYY HH:mm")}
              </Descriptions.Item>
              <Descriptions.Item label="Customer">
                {sale.customer_name || "Walk-in Customer"}
                {sale.customer_phone && (
                  <div>
                    <Text type="secondary">{sale.customer_phone}</Text>
                  </div>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Branch">
                {sale.branch_name}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color="orange">PARTIAL</Tag>
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Total Amount">
                <Text strong style={{ fontSize: 16 }}>
                  {formatCurrency(sale.total_amount)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Received Amount">
                <Text style={{ fontSize: 16, color: "#52c41a" }}>
                  {formatCurrency(sale.received_amount)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Remaining Amount">
                <Text strong style={{ fontSize: 18, color: "#ff4d4f" }}>
                  {formatCurrency(sale.remaining_amount)}
                </Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Payment History */}
          {sale.payments && sale.payments.length > 0 && (
            <Card title="Payment History">
              <Table
                columns={paymentColumns}
                dataSource={sale.payments}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </Card>
          )}
        </Col>

        {/* Payment Form */}
        <Col xs={24} lg={12}>
          <Card title="Record New Payment">
            <div style={{ marginBottom: 16 }}>
              <Text strong>Payment Methods</Text>

              <div style={{ marginTop: 8, marginBottom: 8 }}>
                <Button
                  type="dashed"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    const totalPaid = payments.reduce(
                      (sum, p) => sum + p.amount,
                      0,
                    );
                    const remainingAmount = Math.max(
                      0,
                      sale.remaining_amount - totalPaid,
                    );
                    const newPayment: SalePayment = {
                      payment_method: PaymentMethod.CASH,
                      amount: remainingAmount > 0 ? remainingAmount : 0,
                      reference: "",
                    };
                    setPayments([...payments, newPayment]);
                  }}
                  style={{ width: "100%" }}
                >
                  Add Payment Method
                </Button>
              </div>

              <div style={{ minHeight: "auto" }}>
                {payments.map((payment, index) => (
                  <div
                    key={index}
                    style={{
                      marginBottom: 8,
                    }}
                  >
                    <Row gutter={4}>
                      <Col span={6}>
                        <Select
                          size="small"
                          value={payment.payment_method}
                          onChange={(value) => {
                            const updatedPayments = [...payments];
                            updatedPayments[index].payment_method = value;
                            setPayments(updatedPayments);
                          }}
                          style={{ width: "100%" }}
                          placeholder="Method"
                        >
                          <Option value={PaymentMethod.CASH}>Cash</Option>
                          <Option value={PaymentMethod.CARD}>Card</Option>
                          <Option value={PaymentMethod.CHEQUE}>Cheque</Option>
                          <Option value={PaymentMethod.BANK_TRANSFER}>
                            Bank Transfer
                          </Option>
                          <Option value={PaymentMethod.MOBILE_MONEY}>
                            Mobile Money
                          </Option>
                          <Option value={PaymentMethod.MFS}>MFS</Option>
                          <Option value={PaymentMethod.CREDIT}>Credit</Option>
                          <Option value={PaymentMethod.EXCHANGE}>
                            Exchange
                          </Option>
                        </Select>
                      </Col>
                      <Col span={6}>
                        <InputNumber
                          size="small"
                          value={payment.amount}
                          onChange={(value) => {
                            const updatedPayments = [...payments];
                            updatedPayments[index].amount = value || 0;
                            setPayments(updatedPayments);
                          }}
                          min={0}
                          precision={2}
                          style={{ width: "100%" }}
                          placeholder="0.00"
                        />
                      </Col>
                      <Col span={6}>
                        <Input
                          size="small"
                          value={payment.reference}
                          onChange={(e) => {
                            const updatedPayments = [...payments];
                            updatedPayments[index].reference = e.target.value;
                            setPayments(updatedPayments);
                          }}
                          placeholder="Reference"
                        />
                      </Col>
                      {/* <Col span={4}>
                        <Input
                          size="small"
                          value={payment.notes}
                          onChange={(e) => {
                            const updatedPayments = [...payments];
                            updatedPayments[index].notes = e.target.value;
                            setPayments(updatedPayments);
                          }}
                          placeholder="Notes"
                        />
                      </Col> */}
                      <Col span={2}>
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            const updatedPayments = payments.filter(
                              (_, i) => i !== index,
                            );
                            setPayments(updatedPayments);
                          }}
                        />
                      </Col>
                    </Row>
                  </div>
                ))}
              </div>
            </div>

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
                  {formatCurrency(
                    payments.reduce((sum, p) => sum + p.amount, 0),
                  )}
                </Text>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <Text>Remaining After Payment:</Text>
                <Text
                  strong
                  style={{
                    fontSize: 16,
                    color:
                      sale.remaining_amount -
                        payments.reduce((sum, p) => sum + p.amount, 0) <=
                      0
                        ? "#52c41a"
                        : "#ff4d4f",
                  }}
                >
                  {formatCurrency(
                    Math.max(
                      0,
                      sale.remaining_amount -
                        payments.reduce((sum, p) => sum + p.amount, 0),
                    ),
                  )}
                </Text>
              </div>
            </div>

            <Space style={{ width: "100%" }}>
              <Button
                type="primary"
                icon={<CurrencyIcon />}
                loading={makePaymentMutation.isPending}
                onClick={handleSubmit}
                block
              >
                Record Payment
              </Button>
              <Button
                onClick={() => navigate("/partial-payments")}
                disabled={makePaymentMutation.isPending}
              >
                Cancel
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default MakePayment;
