import {
  ArrowLeftOutlined,
  CopyOutlined,
  DownloadOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
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
import saveAs from "file-saver";
import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { salesApi } from "../../api/sales-api";
import { Money } from "../../components/Currency";
import PageTitle from "../../components/PageTitle";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { useMessageStore } from "../../stores/messageStore";
import { setPageTitle } from "../../utils/setPageTitle";

const { Text } = Typography;

const QuotationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { messageApi } = useMessageStore();

  const quotationQuery = useQuery({
    queryKey: [queryKeys.quotation, parseInt(id || "0")],
    queryFn: () => salesApi.getQuotation(parseInt(id!)),
    enabled: !!id,
    staleTime: queryStaleTimeMap[queryKeys.quotation],
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 404) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const quotation = quotationQuery.data;
  const loading = quotationQuery.isLoading;
  const promotionDiscount =
    quotation?.items?.reduce(
      (sum: number, item: any) =>
        sum + (Number(item.promotion_discount_amount) || 0),
      0,
    ) ||
    Number(quotation?.promotion_discount) ||
    0;
  const averageDiscount =
    quotation?.items?.reduce(
      (sum: number, item: any) =>
        sum + (Number(item.average_discount_amount) || 0),
      0,
    ) || 0;
  const specialDiscount =
    quotation?.items?.reduce(
      (sum: number, item: any) =>
        sum + (Number(item.special_discount_amount) || 0),
      0,
    ) || 0;
  const totalDiscount = Number(quotation?.discount_amount) || 0;

  useEffect(() => {
    if (quotationQuery.isError) {
      messageApi?.error("Failed to load quotation details");
      navigate("/quotations");
    }
  }, [quotationQuery.isError, navigate]);

  useEffect(() => {
    if (quotation) {
      setPageTitle(`Quotation #${quotation.sale_number}`);
    }
  }, [quotation]);

  const handleConvertToSale = () => {
    if (!quotation) return;
    navigate(`/sales/new?quotation_id=${quotation.id}`);
  };

  const handleDownloadPdf = async () => {
    if (!quotation) return;

    try {
      const pdfBlob = await salesApi.downloadQuotationPdf(Number(quotation.id));

      const filename = `quotation-${quotation.sale_number}.pdf`;

      saveAs(pdfBlob, filename);

      messageApi?.success({
        content: "PDF downloaded successfully!",
      });
    } catch (error) {
      console.error("Error downloading PDF:", error);
      messageApi?.error({
        content: "Failed to download PDF",
      });
    }
  };

  const getItemPromotionLabel = (record: any) => {
    const itemPromotionName =
      record.applied_promotion?.name || record.applied_promotion_name;

    if (itemPromotionName) {
      return itemPromotionName;
    }

    if (quotation?.promotion?.name) {
      return quotation.promotion.name;
    }

    return null;
  };

  const itemColumns = [
    {
      title: "Product",
      key: "product",
      render: (record: any) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {record.variant?.product?.name || "Product"}
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.variant?.name || ""}
          </Text>
          {record.variant?.sku && (
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                SKU: {record.variant?.sku}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Unit Price",
      dataIndex: "unit_price",
      key: "unit_price",
      render: (price: number) => <Money value={price} />,
    },
    {
      title: "Unit Price (Sold)",
      key: "sold_unit_price",
      render: (_: any, record: any) => (
        <Money value={record.sold_unit_price ?? record.unit_price} />
      ),
    },
    {
      title: "Quantity",
      key: "quantity",
      render: (record: any) => (
        <div>
          <div>{record.quantity}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.variant?.sale_unit?.name || ""}
          </Text>
        </div>
      ),
    },
    {
      title: "Avg Disc",
      key: "average_discount_amount",
      render: (_: any, record: any) => (
        <Money value={record.average_discount_amount} negative />
      ),
    },
    {
      title: "Special Disc",
      key: "special_discount_amount",
      render: (_: any, record: any) => (
        <Money value={record.special_discount_amount} negative />
      ),
    },
    {
      title: "Promo Disc",
      key: "promotion_discount_amount",
      render: (_: any, record: any) => {
        const promoLabel = getItemPromotionLabel(record);

        return (
          <div className="flex items-center gap-2">
            <Money value={record.promotion_discount_amount} negative />
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
        const isInc = String(record.variant?.product?.tax_method || "")
          .toLowerCase()
          .startsWith("inc");
        return (
          <div>
            <Money value={tax} />
            <span
              style={{
                marginLeft: 4,
                fontSize: 11,
                color: isInc ? "#389e0d" : "#cf1322",
              }}
            >
              ({isInc ? "inc" : "exc"})
            </span>
          </div>
        );
      },
    },
    {
      title: "Line Total",
      dataIndex: "line_total",
      key: "line_total",
      render: (total: number) => <Money value={total} />,
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!quotation) {
    return null;
  }

  return (
    <div>
      <PageTitle
        title={`Quotation #${quotation.sale_number}`}
        breadcrumbs={[
          { title: "Home", href: "/" },
          { title: "Quotations", href: "/quotations" },
          { title: `Quotation #${quotation.sale_number}` },
        ]}
        rightSection={
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/quotations")}
            >
              Back to Quotations
            </Button>
            <Button
              icon={<CopyOutlined />}
              onClick={() =>
                navigate(`/add-quotation?copy_from=${quotation.id}`)
              }
            >
              Copy Quotation
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleDownloadPdf}>
              Download PDF
            </Button>
            <Button
              type="primary"
              icon={<SwapOutlined />}
              onClick={handleConvertToSale}
              disabled={!!quotation.converted_to_sale_id}
            >
              {quotation.converted_to_sale_id
                ? "Already Converted"
                : "Convert to Sale"}
            </Button>
          </Space>
        }
      />

      {quotation.converted_to_sale_id && (
        <Card style={{ marginBottom: 16 }}>
          <Space direction="vertical">
            <Text strong>This quotation has been converted to a sale</Text>
            <Text type="secondary">
              Converted on:{" "}
              {quotation.converted_at
                ? dayjs(quotation.converted_at).format("MMM DD, YYYY hh:mm A")
                : "N/A"}
            </Text>
            <Button
              type="link"
              onClick={() =>
                navigate(`/sales/view/${quotation.converted_to_sale_id}`)
              }
            >
              View Sale →
            </Button>
          </Space>
        </Card>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="Quotation Details">
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Quotation Number">
                <Text strong>{quotation.sale_number}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Date">
                {dayjs(quotation.sale_date).format("MMM DD, YYYY HH:mm")}
              </Descriptions.Item>
              <Descriptions.Item label="Branch">
                {quotation.branch?.name || "N/A"}
              </Descriptions.Item>
              <Descriptions.Item label="Created By">
                {quotation.user?.name || "N/A"}
              </Descriptions.Item>
              <Descriptions.Item label="Customer" span={2}>
                {quotation.customer_name ||
                  quotation.customer?.name ||
                  "Walk-in Customer"}
                {(quotation.customer_phone || quotation.customer?.phone) && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Phone:{" "}
                      {quotation.customer_phone || quotation.customer?.phone}
                    </Text>
                  </div>
                )}
                {(quotation.customer_email || quotation.customer?.email) && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Email:{" "}
                      {quotation.customer_email || quotation.customer?.email}
                    </Text>
                  </div>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Served By" span={2}>
                {quotation.served_by_name ||
                  quotation.served_by?.name ||
                  "Self Served"}
              </Descriptions.Item>
              <Descriptions.Item label="Price Type">
                <Tag
                  color={
                    quotation.price_type === "wholesale" ? "blue" : "default"
                  }
                >
                  {quotation.price_type === "wholesale"
                    ? "Wholesale"
                    : "Regular"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                {quotation.converted_to_sale_id ? (
                  <Tag color="success">Converted</Tag>
                ) : (
                  <Tag color="default">Pending</Tag>
                )}
              </Descriptions.Item>
            </Descriptions>

            {quotation.notes && (
              <>
                <Divider />
                <div>
                  <Text type="secondary">Notes:</Text>
                  <div style={{ marginTop: 8 }}>
                    <Text>{quotation.notes}</Text>
                  </div>
                </div>
              </>
            )}
          </Card>

          <Card title="Items" style={{ marginTop: 16 }}>
            <Table
              columns={itemColumns}
              dataSource={quotation.items || []}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Summary">
            <Space direction="vertical" style={{ width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text>Subtotal:</Text>
                <Text strong>
                  <Money value={quotation.subtotal} />
                </Text>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text>Tax:</Text>
                <Text><Money value={quotation.tax_amount} /></Text>
              </div>
              {promotionDiscount > 0 && (
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <Text style={{ color: "#52c41a" }}>Promo Discount:</Text>
                  <Text style={{ color: "#52c41a" }}>
                    <Money value={promotionDiscount} negative />
                  </Text>
                </div>
              )}
              {averageDiscount > 0 && (
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <Text>Average Discount:</Text>
                  <Text><Money value={averageDiscount} negative /></Text>
                </div>
              )}
              {specialDiscount > 0 && (
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <Text>Special Discount:</Text>
                  <Text><Money value={specialDiscount} negative /></Text>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text strong>Total Discount:</Text>
                <Text strong>
                  <Money value={totalDiscount} negative={totalDiscount > 0} />
                </Text>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text>Shipping:</Text>
                <Text><Money value={quotation.shipping_cost} /></Text>
              </div>
              <Divider style={{ margin: "12px 0" }} />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 18,
                }}
              >
                <Text strong>Total:</Text>
                <Text strong style={{ color: "#1890ff" }}>
                  <Money value={quotation.total_amount} />
                </Text>
              </div>
            </Space>
          </Card>

          {quotation.converted_to_sale_id ? null : (
            <Card title="Actions" style={{ marginTop: 16 }}>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Button
                  type="primary"
                  icon={<SwapOutlined />}
                  onClick={handleConvertToSale}
                  block
                  size="large"
                >
                  Convert to Sale
                </Button>
              </Space>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default QuotationDetail;
