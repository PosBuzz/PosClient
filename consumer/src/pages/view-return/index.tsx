import { ArrowLeftOutlined, FilePdfOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Row,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { Link, useNavigate, useParams } from "react-router-dom";
import { returnsApi } from "../../api/returns-api";
import { salesApi } from "../../api/sales-api";
import PageTitle from "../../components/PageTitle";
import PdfPreviewModal, {
  usePdfPreview,
} from "../../components/PdfPreviewModal";
import type { ReturnExchange, ReturnItem } from "../../types/return.types";
import { formatCurrency, formatDate } from "../../utils/formatters";

const { Text } = Typography;

export default function ViewReturn() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { preview, previewProps } = usePdfPreview();

  const {
    data: returnData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["return", id],
    queryFn: () => returnsApi.getReturn(Number(id)),
    enabled: !!id,
  });

  const { data: saleData } = useQuery({
    queryKey: ["sale", returnData?.original_sale_id],
    queryFn: () => salesApi.getSale(returnData!.original_sale_id),
    enabled: !!returnData?.original_sale_id,
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error || !returnData) {
    return <Alert message="Return not found" type="error" />;
  }

  const returnDetail = returnData;

  const itemColumns = [
    {
      title: "Product",
      key: "product",
      render: (_: any, record: ReturnItem) => {
        const productName =
          record.variant?.product?.name || record.product_name || "N/A";
        const variantName =
          record.variant?.name || record.variant_name || "N/A";
        return `${productName} - ${variantName}`;
      },
    },
    {
      title: "Quantity Returned",
      dataIndex: "quantity",
      key: "quantity",
    },
  ];

  const paymentColumns = [
    {
      title: "Method",
      dataIndex: "payment_method",
      key: "payment_method",
      render: (method: string) => (
        <Tag
          color={
            method === "CASH"
              ? "green"
              : method === "CARD"
                ? "blue"
                : method === "EXCHANGE"
                  ? "orange"
                  : "purple"
          }
        >
          {method?.replace("_", " ") || "N/A"}
        </Tag>
      ),
    },
    {
      title: "Reference",
      dataIndex: "reference",
      key: "reference",
      render: (reference: string) => reference || "N/A",
    },
    {
      title: "Payment Type",
      dataIndex: "payment_type",
      key: "payment_type",
      render: (paymentType: string) => paymentType || "N/A",
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      render: (amount: number) => formatCurrency(amount),
    },
  ];

  const exchangeColumns = [
    {
      title: "New Product",
      key: "newProduct",
      render: (_: any, record: ReturnExchange) => {
        const productName =
          record.variant?.product?.name || record.product_name || "N/A";
        const variantName =
          record.variant?.name || record.variant_name || "N/A";
        return `${productName} - ${variantName}`;
      },
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
    },
    {
      title: "Unit Price",
      dataIndex: "unit_price",
      key: "unit_price",
      render: (price: number) => formatCurrency(price),
    },
    {
      title: "Total",
      key: "total",
      render: (_: any, record: ReturnExchange) =>
        formatCurrency(record.quantity * record.unit_price),
    },
  ];

  const handlePreviewPdf = (id: number, returnNumber: string) =>
    preview(() => returnsApi.downloadReturnPdf(id), {
      title: `Return ${returnNumber}`,
      fileName: `return-${returnNumber}.pdf`,
    });
  return (
    <div>
      <PageTitle
        title={`Return #${returnDetail.return_number}`}
        breadcrumbs={[
          { title: "Returns" },
          { title: `Return #${returnDetail.return_number}` },
        ]}
      />

      <Space style={{ marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/returns")}
        >
          Back to Returns
        </Button>
        <Button
          type="primary"
          icon={<FilePdfOutlined />}
          onClick={() =>
            handlePreviewPdf(returnDetail.id, returnDetail.return_number)
          }
        >
          Preview Return Receipt
        </Button>
      </Space>

      <Row gutter={16}>
        <Col span={24}>
          <Card title="Return Information">
            <Row gutter={16}>
              <Col span={12}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Return Number">
                    <Text strong>{returnDetail.return_number}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Return Date">
                    {formatDate(returnDetail.return_date)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Total Refund">
                    <Text strong style={{ fontSize: "16px" }}>
                      {formatCurrency(returnDetail.total_refund)}
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Total Exchange">
                    <Text strong style={{ fontSize: "16px" }}>
                      {formatCurrency(returnDetail.total_exchange)}
                    </Text>
                  </Descriptions.Item>
                </Descriptions>
              </Col>
              <Col span={12}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Original Sale">
                    <Link to={`/sales/view/${returnDetail.original_sale_id}`}>
                      Sale #
                      {saleData?.sale_number || returnDetail.original_sale_id}
                    </Link>
                  </Descriptions.Item>
                  <Descriptions.Item label="Customer">
                    {saleData?.customer?.name || "Walk-in Customer"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Processed By">
                    {returnDetail.user?.name || "Unknown"}
                  </Descriptions.Item>
                  {returnDetail.notes && (
                    <Descriptions.Item label="Notes">
                      {returnDetail.notes}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="Returned Items">
            <Table
              dataSource={returnDetail.items}
              columns={itemColumns}
              pagination={false}
              rowKey="id"
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {returnDetail.payments.length > 0 && (
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={12}>
            <Card title="Refund Payments">
              <Table
                dataSource={returnDetail.payments}
                columns={paymentColumns}
                pagination={false}
                rowKey="id"
                size="small"
                summary={() => (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0}>
                      <Text strong>Total Refunded</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1}>
                      <Text strong>
                        {formatCurrency(
                          returnDetail.payments.reduce(
                            (sum, p) => sum + +p.amount,
                            0,
                          ),
                        )}
                      </Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            </Card>
          </Col>
          {returnDetail.exchanges.length > 0 && (
            <Col span={12}>
              <Card title="Exchange Items">
                <Table
                  dataSource={returnDetail.exchanges}
                  columns={exchangeColumns}
                  pagination={false}
                  rowKey="id"
                  size="small"
                  summary={() => (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0}>
                        <Text strong>Total Exchange Value</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1} />
                      <Table.Summary.Cell index={2} />
                      <Table.Summary.Cell index={3}>
                        <Text strong>
                          {formatCurrency(
                            returnDetail.exchanges.reduce(
                              (sum, e) => sum + e.quantity * e.unit_price,
                              0,
                            ),
                          )}
                        </Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  )}
                />
              </Card>
            </Col>
          )}
        </Row>
      )}

      {returnDetail.exchanges.length > 0 &&
        returnDetail.payments.length === 0 && (
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={24}>
              <Card title="Exchange Items">
                <Table
                  dataSource={returnDetail.exchanges}
                  columns={exchangeColumns}
                  pagination={false}
                  rowKey="id"
                  size="small"
                  summary={() => (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0}>
                        <Text strong>Total Exchange Value</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1} />
                      <Table.Summary.Cell index={2} />
                      <Table.Summary.Cell index={3}>
                        <Text strong>
                          {formatCurrency(
                            returnDetail.exchanges.reduce(
                              (sum, e) => sum + e.quantity * e.unit_price,
                              0,
                            ),
                          )}
                        </Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  )}
                />
              </Card>
            </Col>
          </Row>
        )}

      <PdfPreviewModal {...previewProps} />
    </div>
  );
}
