import { ArrowLeftOutlined, PrinterOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  message,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { salesApi } from "../../api/sales-api";
import PageTitle from "../../components/PageTitle";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { PaymentMethod, PaymentStatus } from "../../types/sale.types";
import { setPageTitle } from "../../utils/setPageTitle";

const { Text } = Typography;

const SaleDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const saleQuery = useQuery({
    queryKey: [queryKeys.sale, parseInt(id || "0")],
    queryFn: () => salesApi.getSale(parseInt(id!)),
    enabled: !!id,
    staleTime: queryStaleTimeMap[queryKeys.sale],
    retry: (failureCount, error: any) => {
      // Don't retry on 404 errors
      if (error?.response?.status === 404) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const sale = saleQuery.data;
  const loading = saleQuery.isLoading;
  const promotionDiscount =
    sale?.items?.reduce(
      (sum: number, item: any) =>
        sum + (Number(item.promotion_discount_amount) || 0),
      0,
    ) || Number(sale?.promotion_discount) || 0;
  const averageDiscount =
    sale?.items?.reduce(
      (sum: number, item: any) =>
        sum + (Number(item.average_discount_amount) || 0),
      0,
    ) || 0;
  const specialDiscount =
    sale?.items?.reduce(
      (sum: number, item: any) =>
        sum + (Number(item.special_discount_amount) || 0),
      0,
    ) || 0;
  const totalDiscount = Number(sale?.discount_amount) || 0;

  useEffect(() => {
    if (saleQuery.isError) {
      message.error("Failed to load sale details");
      navigate("/sales");
    }
  }, [saleQuery.isError, navigate]);

  useEffect(() => {
    if (sale) {
      setPageTitle(`Sale #${sale.sale_number}`);
    }
  }, [sale]);

  const getPaymentStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PAID:
        return "green";
      case PaymentStatus.PARTIAL:
        return "orange";
      case PaymentStatus.DUE:
        return "red";
      case PaymentStatus.CANCELLED:
        return "default";
      default:
        return "default";
    }
  };

  // Use database payment status - backend now calculates correctly
  const getActualPaymentStatus = (sale: any) => {
    // Use the database payment_status directly since backend calculates it correctly now
    return sale?.payment_status || PaymentStatus.DUE;
  };

  // Use database total amount - backend now calculates correctly
  const getCorrectTotal = (sale: any) => {
    // Use the database total_amount directly since backend calculates it correctly now
    return Number(sale?.total_amount) || 0;
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
        return "cyan";
      case PaymentMethod.MFS:
        return "magenta";
      case PaymentMethod.CREDIT:
        return "red";
      default:
        return "default";
    }
  };

  const getPaymentMethodLabel = (method: PaymentMethod) => {
    switch (method) {
      case PaymentMethod.CASH:
        return "Cash";
      case PaymentMethod.CARD:
        return "Card";
      case PaymentMethod.BANK_TRANSFER:
        return "Bank Transfer";
      case PaymentMethod.CHEQUE:
        return "Cheque";
      case PaymentMethod.MOBILE_MONEY:
        return "Mobile Money";
      case PaymentMethod.MFS:
        return "MFS";
      case PaymentMethod.CREDIT:
        return "Credit";
      default:
        return method;
    }
  };

  const getItemPromotionLabel = (record: any) => {
    const itemPromotionName =
      record.applied_promotion?.name || record.applied_promotion_name;

    if (itemPromotionName) {
      return itemPromotionName;
    }

    if (sale?.promotion?.name) {
      return sale.promotion.name;
    }

    return null;
  };

  const handlePrint = async () => {
    if (!sale) return;

    try {

      const customerRewards = sale.customer?.rewards_points;
      const amountPaid = Number(sale?.received_amount) || 0;
      const correctTotal = getCorrectTotal(sale);

      // Format payment methods
      const paymentMethods =
        sale.payments && sale.payments.length > 0
          ? sale.payments
              .map((payment: any) =>
                getPaymentMethodLabel(payment.payment_method),
              )
              .join(", ")
          : "Cash";

      // Format receipt data according to the required structure
      const receiptData = {
        orderId: sale.sale_number,
        receiptNumber: sale.sale_number,
        saleNumber: sale.sale_number,
        sale_number: sale.sale_number,
        barcodeValue: sale.sale_number,
        date: dayjs(sale.sale_date).format("YYYY-MM-DD"),
        time: dayjs(sale.sale_date).format("HH:mm:ss"),
        sale_date: sale.sale_date,
        cashier: sale.user?.name || sale.user_name || "Staff",
        servedBy: sale.served_by?.name || undefined,
        customer: sale.customer_name || "Walk-in Customer",
        customerName: sale.customer_name || sale.customer?.name || "Walk-in Customer",
        customerPhone: sale.customer_phone || sale.customer?.phone || "",
        customerEmail: sale.customer_email || sale.customer?.email || "",
        rewardPoints: customerRewards?.total_points,
        pointsEarned: customerRewards?.lifetime_earned,
        pointsRedeemed: customerRewards?.lifetime_redeemed,
        branch: sale.branch
          ? {
              name: sale.branch.name,
              address: sale.branch.address,
              phone: sale.branch.phone,
              email: sale.branch.email,
            }
          : undefined,
        user: sale.user
          ? {
              name: sale.user.name,
              id: String(sale.user.id),
            }
          : undefined,
        items:
          sale.items?.map((item: any) => {
            const quantity = Number(item.quantity) || 0;
            const unitPrice = Number(item.unit_price) || 0;
            const grossLineTotal = unitPrice * quantity;
            const averageDiscountAmount = Number(item.average_discount_amount) || 0;
            const specialDiscountAmount = Number(item.special_discount_amount) || 0;
            const promotionDiscountAmount = Number(item.promotion_discount_amount) || 0;
            const discountAmount =
              averageDiscountAmount + specialDiscountAmount + promotionDiscountAmount;
            const taxAmount = Number(item.tax_amount) || 0;
            const taxMethod = item.variant?.product?.tax_method || "exclusive";
            const isInclusiveTax = String(taxMethod).toLowerCase().startsWith("inc");
            const computedLineTotal = Math.max(
              0,
              grossLineTotal - discountAmount + (isInclusiveTax ? 0 : taxAmount),
            );

            return {
              name: `${item.variant?.product?.name || "Product"} - ${item.variant?.name || ""}`.trim(),
              quantity,
              unitPrice,
              price: unitPrice,
              grossLineTotal,
              averageDiscountAmount,
              specialDiscountAmount,
              promotionDiscountAmount,
              discountAmount,
              taxAmount,
              taxPercentage: Number(item.variant?.product?.tax) || 0,
              taxMethod,
              lineTotal: computedLineTotal,
              total: computedLineTotal,
            };
          }) || [],
        subtotal: Number(sale?.subtotal) || 0,
        discount: totalDiscount,
        discountAmount: totalDiscount,
        shipping: Number(sale?.shipping_cost) || 0,
        shippingCost: Number(sale?.shipping_cost) || 0,
        tax: Number(sale?.tax_amount) || 0,
        taxAmount: Number(sale?.tax_amount) || 0,
        total: correctTotal,
        totalAmount: correctTotal,
        amountPaid,
        receivedAmount: amountPaid,
        change: Math.max(0, amountPaid - correctTotal),
        changeAmount: Math.max(0, amountPaid - correctTotal),
        due: Math.max(0, correctTotal - amountPaid),
        dueAmount: Math.max(0, correctTotal - amountPaid),
        paymentMethod: paymentMethods,
        payments:
          sale.payments?.map((payment: any) => ({
            payment_method: getPaymentMethodLabel(payment.payment_method),
            amount: Number(payment.amount) || 0,
          })) || [],
        paymentStatus: sale.payment_status,
        notes: sale.notes || undefined,
      };

      // Send direct request to localhost:8080/print
      const response = await fetch("http://localhost:8080/print", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(receiptData),
      });

      if (response.ok) {
        await response.json(); // Parse response for completeness
        message.success("Receipt printed successfully!");
      } else {
        const errorText = await response.text();
        message.error("Failed to print receipt: " + errorText);
      }
    } catch (error: any) {
      console.error("Print error:", error);
      if (error.message.includes("fetch")) {
        message.error(
          "Printing agent is not running. Please start the printing agent on your computer and try again.",
        );
      } else {
        message.error("Failed to print receipt. Please check your connection.");
      }
    }
  };

  const itemColumns = [
    {
      title: "Product",
      key: "product",
      render: (record: any) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {record.variant?.image && (
            <img
              src={record.variant.image}
              alt={record.variant.name}
              style={{
                width: 40,
                height: 40,
                objectFit: "cover",
                borderRadius: 4,
              }}
            />
          )}
          <div>
            <div style={{ fontWeight: 500 }}>
              {record.variant?.product?.name}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.variant?.name}
            </Text>
            {record.variant?.sku && (
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  SKU: {record.variant.sku}
                </Text>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Batch",
      key: "batch",
      render: (record: any) =>
        record.batch ? (
          <div>
            <Text strong>{record.batch.batch_number}</Text>
            {record.batch.expiry_date && (
              <div style={{ fontSize: 11, color: "#666" }}>
                Exp: {dayjs(record.batch.expiry_date).format("DD/MM/YYYY")}
              </div>
            )}
          </div>
        ) : (
          "N/A"
        ),
    },
    {
      title: "Unit Price",
      dataIndex: "unit_price",
      key: "unit_price",
      render: (price: number) => `$${(Number(price) || 0).toFixed(2)}`,
    },
    {
      title: "Unit Price (Sold)",
      key: "sold_unit_price",
      render: (_: any, record: any) =>
        `$${(Number(record.sold_unit_price ?? record.unit_price) || 0).toFixed(2)}`,
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      render: (quantity: number, record: any) => (
        <div>
          <span>{quantity}</span>
          {record.variant?.sale_unit && (
            <div style={{ fontSize: 11, color: "#666" }}>
              {record.variant.sale_unit.name}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Avg Disc",
      key: "average_discount_amount",
      render: (_: any, record: any) =>
        `-$${(Number(record.average_discount_amount) || 0).toFixed(2)}`,
    },
    {
      title: "Special Disc",
      key: "special_discount_amount",
      render: (_: any, record: any) =>
        `-$${(Number(record.special_discount_amount) || 0).toFixed(2)}`,
    },
    {
      title: "Promo Disc",
      key: "promotion_discount_amount",
      render: (_: any, record: any) => {
        const promoLabel = getItemPromotionLabel(record);

        return (
          <div className="flex items-center gap-2">
            <span>{`-$${(Number(record.promotion_discount_amount) || 0).toFixed(2)}`}</span>
            {promoLabel ? <Tag color="processing">{promoLabel}</Tag> : null}
          </div>
        );
      },
    },
    {
      title: "Tax",
      dataIndex: "tax_amount",
      key: "tax_amount",
      render: (tax: number, record: any) => {
        const isInc = String(record.tax_method || "").toLowerCase().startsWith("inc");
        return (
          <div>
            <span>${(Number(tax) || 0).toFixed(2)}</span>
            <span style={{ marginLeft: 4, fontSize: 11, color: isInc ? "#389e0d" : "#cf1322" }}>
              ({isInc ? "inc" : "exc"})
            </span>
          </div>
        );
      },
    },
    {
      title: "Total",
      dataIndex: "line_total",
      key: "line_total",
      render: (total: number) => (
        <Text strong>${(Number(total) || 0).toFixed(2)}</Text>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Text>Sale not found</Text>
      </div>
    );
  }

  return (
    <div>
      <PageTitle
        title={`Sale #${sale.sale_number}`}
        breadcrumbs={[
          { title: "Home", href: "/" },
          { title: "Sales", href: "/sales" },
          { title: sale.sale_number },
        ]}
        rightSection={
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/sales")}
            >
              Back to Sales
            </Button>
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={handlePrint}
            >
              Print Receipt
            </Button>
          </Space>
        }
      />

      <Row gutter={16}>
        <Col span={16}>
          {/* Show quotation banner if converted from quotation */}
          {sale.converted_from_quotations &&
            sale.converted_from_quotations.length > 0 &&
            (() => {
              const sourceQuotation = sale.converted_from_quotations?.[0];
              if (!sourceQuotation) return null;

              return (
                <Card style={{ marginBottom: 16 }}>
                  <Space direction="vertical">
                    <Text strong>This sale was converted from a quotation</Text>
                    <Text type="secondary">
                      Original Quotation: {sourceQuotation.sale_number}
                    </Text>
                    <Text type="secondary">
                      Quotation Date:{" "}
                      {dayjs(sourceQuotation.created_at).format(
                        "MMM DD, YYYY hh:mm A",
                      )}
                    </Text>
                    <Button
                      type="link"
                      onClick={() =>
                        navigate(`/quotations/view/${sourceQuotation.id}`)
                      }
                    >
                      View Original Quotation →
                    </Button>
                  </Space>
                </Card>
              );
            })()}

          {/* Sale Details */}
          <Card title="Sale Information" style={{ marginBottom: 16 }}>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="Sale Number">
                {sale.sale_number}
              </Descriptions.Item>
              <Descriptions.Item label="Sale Date">
                {dayjs(sale.sale_date).format("DD/MM/YYYY HH:mm")}
              </Descriptions.Item>
              <Descriptions.Item label="Customer">
                {sale.customer_name || "Walking Customer"}
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                {sale.customer_phone || "N/A"}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {sale.customer_email || "N/A"}
              </Descriptions.Item>
              <Descriptions.Item label="Branch">
                {sale.branch?.name || "N/A"}
              </Descriptions.Item>
              <Descriptions.Item label="Created By">
                {sale.user?.name || sale.user_name || "N/A"}
              </Descriptions.Item>
              <Descriptions.Item label="Served By">
                {sale.served_by?.name || sale.served_by_name || "N/A"}
              </Descriptions.Item>
              {sale.promotion && (
                <Descriptions.Item label="Promotion Applied">
                  <Tag color="green">{sale.promotion.name}</Tag>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Sale Type">
                <Tag color="blue">{sale.sale_type?.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Payment Methods">
                {sale.payments && sale.payments.length > 0 ? (
                  <div>
                    {sale.payments.map((payment: any, index: number) => (
                      <Tag
                        key={index}
                        color={getPaymentMethodColor(payment.payment_method)}
                        style={{ marginBottom: 4 }}
                      >
                        {getPaymentMethodLabel(payment.payment_method)}: $
                        {(Number(payment.amount) || 0).toFixed(2)}
                      </Tag>
                    ))}
                  </div>
                ) : (
                  <span>N/A</span>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Payment Status">
                <Tag
                  color={getPaymentStatusColor(getActualPaymentStatus(sale))}
                >
                  {getActualPaymentStatus(sale).toUpperCase()}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            {sale.notes && (
              <>
                <Divider />
                <div>
                  <Text strong>Notes:</Text>
                  <div style={{ marginTop: 8 }}>
                    <Text>{sale.notes}</Text>
                  </div>
                </div>
              </>
            )}
          </Card>

          {/* Sale Items */}
          <Card title="Sale Items">
            <Table
              columns={itemColumns}
              dataSource={sale.items}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>

          {/* Payment Details */}
          {sale.payments && sale.payments.length > 0 && (
            <Card title="Payment Details" style={{ marginTop: 16 }}>
              <Table
                columns={[
                  {
                    title: "Payment Method",
                    dataIndex: "payment_method",
                    key: "payment_method",
                    render: (method: PaymentMethod) => (
                      <Tag color={getPaymentMethodColor(method)}>
                        {getPaymentMethodLabel(method)}
                      </Tag>
                    ),
                  },
                  {
                    title: "Amount",
                    dataIndex: "amount",
                    key: "amount",
                    render: (amount: number) =>
                      `$${(Number(amount) || 0).toFixed(2)}`,
                  },
                  {
                    title: "Reference",
                    dataIndex: "reference",
                    key: "reference",
                    render: (reference: string) => reference || "N/A",
                  },
                  {
                    title: "Notes",
                    dataIndex: "notes",
                    key: "notes",
                    render: (notes: string) => notes || "N/A",
                  },
                  {
                    title: "Date",
                    dataIndex: "created_at",
                    key: "created_at",
                    render: (date: string) =>
                      dayjs(date).format("DD/MM/YYYY HH:mm"),
                  },
                ]}
                dataSource={sale.payments}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </Card>
          )}
        </Col>

        <Col span={8}>
          {/* Payment Summary */}
          <Card title="Payment Summary">
            <div style={{ marginBottom: 16 }}>
              {/* Use database subtotal */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <Text>Subtotal:</Text>
                <Text>${(Number(sale?.subtotal) || 0).toFixed(2)}</Text>
              </div>
              {promotionDiscount > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: "#52c41a" }}>Promo Discount:</Text>
                  <Text style={{ color: "#52c41a" }}>
                    -${promotionDiscount.toFixed(2)}
                  </Text>
                </div>
              )}
              {averageDiscount > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <Text>Average Discount:</Text>
                  <Text>-${averageDiscount.toFixed(2)}</Text>
                </div>
              )}
              {specialDiscount > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <Text>Special Discount:</Text>
                  <Text>-${specialDiscount.toFixed(2)}</Text>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <Text strong>Total Discount:</Text>
                <Text strong>
                  {totalDiscount > 0 ? `-$${totalDiscount.toFixed(2)}` : "$0.00"}
                </Text>
              </div>
              {(Number(sale?.shipping_cost) || 0) > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <Text>Shipping:</Text>
                  <Text>${(Number(sale?.shipping_cost) || 0).toFixed(2)}</Text>
                </div>
              )}
              {(Number(sale?.tax_amount) || 0) > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <Text>Tax:</Text>
                  <Text>${(Number(sale?.tax_amount) || 0).toFixed(2)}</Text>
                </div>
              )}
              <Divider style={{ margin: "12px 0" }} />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                <Text strong style={{ fontSize: 16 }}>
                  Total:
                </Text>
                <Text strong style={{ fontSize: 16 }}>
                  ${getCorrectTotal(sale).toFixed(2)}
                </Text>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <Text>Total Paid:</Text>
                <Text style={{ color: "#52c41a" }}>
                  ${(Number(sale?.received_amount) || 0).toFixed(2)}
                </Text>
              </div>
              {/* Calculate change based on correct total */}
              {(() => {
                const correctTotal = getCorrectTotal(sale);
                const received = Number(sale?.received_amount) || 0;
                const due = Math.max(0, correctTotal - received);
                if (due > 0) {
                  return (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <Text>Due:</Text>
                      <Text style={{ color: "#ff4d4f" }}>
                        ${due.toFixed(2)}
                      </Text>
                    </div>
                  );
                }

                const change = Math.max(0, received - correctTotal);
                return change !== 0 ? (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <Text>Change:</Text>
                    <Text
                      style={{
                        color: change >= 0 ? "#52c41a" : "#ff4d4f",
                      }}
                    >
                      ${change.toFixed(2)}
                    </Text>
                  </div>
                ) : null;
              })()}

              {/* Payment Status */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                <Text>Payment Status:</Text>
                <Tag
                  color={getPaymentStatusColor(getActualPaymentStatus(sale))}
                >
                  {getActualPaymentStatus(sale).toUpperCase()}
                </Tag>
              </div>

              {/* Payment Breakdown */}
              {sale.payments && sale.payments.length > 0 && (
                <>
                  <Divider style={{ margin: "12px 0" }} />
                  <div style={{ marginBottom: 8 }}>
                    <Text strong style={{ fontSize: 14 }}>
                      Payment Breakdown:
                    </Text>
                  </div>
                  {sale.payments.map((payment: any, index: number) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <Text style={{ fontSize: 12 }}>
                        <Tag
                          color={getPaymentMethodColor(payment.payment_method)}
                          style={{ fontSize: 11 }}
                        >
                          {getPaymentMethodLabel(payment.payment_method)}
                        </Tag>
                      </Text>
                      <Text style={{ fontSize: 12 }}>
                        ${(Number(payment.amount) || 0).toFixed(2)}
                      </Text>
                    </div>
                  ))}
                </>
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SaleDetail;
