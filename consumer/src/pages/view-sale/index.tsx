import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
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
} from 'antd';
import dayjs from 'dayjs';
import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { salesApi } from '../../api/sales-api';
import PageTitle from '../../components/PageTitle';
import { queryKeys, queryStaleTimeMap } from '../../constants/queryKeys';
import { PaymentMethod, PaymentStatus } from '../../types/sale.types';
import { setPageTitle } from '../../utils/setPageTitle';

const { Text } = Typography;

const SaleDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const saleQuery = useQuery({
    queryKey: [queryKeys.sale, parseInt(id || '0')],
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

  useEffect(() => {
    if (saleQuery.isError) {
      message.error('Failed to load sale details');
      navigate('/sales');
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
        return 'green';
      case PaymentStatus.PARTIAL:
        return 'orange';
      case PaymentStatus.DUE:
        return 'red';
      case PaymentStatus.CANCELLED:
        return 'default';
      default:
        return 'default';
    }
  };

  const getPaymentMethodColor = (method: PaymentMethod) => {
    switch (method) {
      case PaymentMethod.CASH:
        return 'green';
      case PaymentMethod.CARD:
        return 'blue';
      case PaymentMethod.BANK_TRANSFER:
        return 'purple';
      case PaymentMethod.CHEQUE:
        return 'orange';
      case PaymentMethod.MOBILE_MONEY:
        return 'cyan';
      case PaymentMethod.MFS:
        return 'magenta';
      case PaymentMethod.DEPOSIT:
        return 'gold';
      case PaymentMethod.CREDIT:
        return 'red';
      default:
        return 'default';
    }
  };

  const getPaymentMethodLabel = (method: PaymentMethod) => {
    switch (method) {
      case PaymentMethod.CASH:
        return 'Cash';
      case PaymentMethod.CARD:
        return 'Card';
      case PaymentMethod.BANK_TRANSFER:
        return 'Bank Transfer';
      case PaymentMethod.CHEQUE:
        return 'Cheque';
      case PaymentMethod.MOBILE_MONEY:
        return 'Mobile Money';
      case PaymentMethod.MFS:
        return 'MFS';
      case PaymentMethod.DEPOSIT:
        return 'Deposit';
      case PaymentMethod.CREDIT:
        return 'Credit';
      default:
        return method;
    }
  };

  const itemColumns = [
    {
      title: 'Product',
      key: 'product',
      render: (record: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {record.variant?.image && (
            <img
              src={record.variant.image}
              alt={record.variant.name}
              style={{
                width: 40,
                height: 40,
                objectFit: 'cover',
                borderRadius: 4,
              }}
            />
          )}
          <div>
            <div style={{ fontWeight: 500 }}>{record.variant?.product?.name}</div>
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
      title: 'Batch',
      key: 'batch',
      render: (record: any) =>
        record.batch ? (
          <div>
            <Text strong>{record.batch.batch_number}</Text>
            {record.batch.expiry_date && (
              <div style={{ fontSize: 11, color: '#666' }}>
                Exp: {dayjs(record.batch.expiry_date).format('DD/MM/YYYY')}
              </div>
            )}
          </div>
        ) : (
          'N/A'
        ),
    },
    {
      title: 'Unit Price',
      dataIndex: 'unit_price',
      key: 'unit_price',
      render: (price: number) => `$${(Number(price) || 0).toFixed(2)}`,
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (quantity: number, record: any) => (
        <div>
          <span>{quantity}</span>
          {record.variant?.sale_unit && (
            <div style={{ fontSize: 11, color: '#666' }}>
              {record.variant.sale_unit.name}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Discount',
      dataIndex: 'discount_amount',
      key: 'discount_amount',
      render: (discount: number) => discount > 0 ? `-$${(Number(discount) || 0).toFixed(2)}` : '$0.00',
    },
    {
      title: 'Tax',
      dataIndex: 'tax_amount',
      key: 'tax_amount',
      render: (tax: number) => `$${(Number(tax) || 0).toFixed(2)}`,
    },
    {
      title: 'Total',
      dataIndex: 'line_total',
      key: 'line_total',
      render: (total: number) => (
        <Text strong>${(Number(total) || 0).toFixed(2)}</Text>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Text>Sale not found</Text>
      </div>
    );
  }

  return (
    <div>
      <PageTitle
        title={`Sale #${sale.sale_number}`}
        breadcrumbs={[
          { title: 'Home', href: '/' },
          { title: 'Sales', href: '/sales' },
          { title: sale.sale_number },
        ]}
        rightSection={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/sales')}>
              Back to Sales
            </Button>
            <Button type="primary" icon={<PrinterOutlined />}>
              Print Receipt
            </Button>
          </Space>
        }
      />

      <Row gutter={16}>
        <Col span={16}>
          {/* Sale Details */}
          <Card title="Sale Information" style={{ marginBottom: 16 }}>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="Sale Number">
                {sale.sale_number}
              </Descriptions.Item>
              <Descriptions.Item label="Sale Date">
                {dayjs(sale.sale_date).format('DD/MM/YYYY HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="Customer">
                {sale.customer_name || 'Walking Customer'}
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                {sale.customer_phone || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {sale.customer_email || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Branch">
                {sale.branch?.name || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Served By">
                {sale.user_name || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Sale Type">
                <Tag color="blue">{sale.sale_type?.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Payment Methods">
                {sale.payments && sale.payments.length > 0 ? (
                  <div>
                    {sale.payments.map((payment: any, index: number) => (
                      <Tag key={index} color={getPaymentMethodColor(payment.payment_method)} style={{ marginBottom: 4 }}>
                        {getPaymentMethodLabel(payment.payment_method)}: ${(Number(payment.amount) || 0).toFixed(2)}
                      </Tag>
                    ))}
                  </div>
                ) : sale.payment_method ? (
                  <Tag color={getPaymentMethodColor(sale.payment_method)}>
                    {getPaymentMethodLabel(sale.payment_method)}
                  </Tag>
                ) : (
                  <span>N/A</span>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Payment Status">
                <Tag color={getPaymentStatusColor(sale.payment_status)}>
                  {sale.payment_status.toUpperCase()}
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
                    title: 'Payment Method',
                    dataIndex: 'payment_method',
                    key: 'payment_method',
                    render: (method: PaymentMethod) => (
                      <Tag color={getPaymentMethodColor(method)}>
                        {getPaymentMethodLabel(method)}
                      </Tag>
                    ),
                  },
                  {
                    title: 'Amount',
                    dataIndex: 'amount',
                    key: 'amount',
                    render: (amount: number) => `$${(Number(amount) || 0).toFixed(2)}`,
                  },
                  {
                    title: 'Reference',
                    dataIndex: 'reference',
                    key: 'reference',
                    render: (reference: string) => reference || 'N/A',
                  },
                  {
                    title: 'Notes',
                    dataIndex: 'notes',
                    key: 'notes',
                    render: (notes: string) => notes || 'N/A',
                  },
                  {
                    title: 'Date',
                    dataIndex: 'created_at',
                    key: 'created_at',
                    render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm'),
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
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text>Subtotal:</Text>
                <Text>${(Number(sale?.subtotal) || 0).toFixed(2)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text>Discount:</Text>
                <Text>-${(Number(sale?.discount_amount) || 0).toFixed(2)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text>Shipping:</Text>
                <Text>${(Number(sale?.shipping_cost) || 0).toFixed(2)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text>Tax:</Text>
                <Text>${(Number(sale?.tax_amount) || 0).toFixed(2)}</Text>
              </div>
              <Divider style={{ margin: '12px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text strong style={{ fontSize: 16 }}>Total:</Text>
                <Text strong style={{ fontSize: 16 }}>${(Number(sale?.total_amount) || 0).toFixed(2)}</Text>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text>Total Paid:</Text>
                <Text>${(Number(sale?.received_amount) || 0).toFixed(2)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text>Change:</Text>
                <Text 
                  style={{ 
                    color: (Number(sale?.change_amount) || 0) >= 0 ? '#52c41a' : '#ff4d4f' 
                  }}
                >
                  ${(Number(sale?.change_amount) || 0).toFixed(2)}
                </Text>
              </div>

              {/* Payment Breakdown */}
              {sale.payments && sale.payments.length > 0 && (
                <>
                  <Divider style={{ margin: '12px 0' }} />
                  <div style={{ marginBottom: 8 }}>
                    <Text strong style={{ fontSize: 14 }}>Payment Breakdown:</Text>
                  </div>
                  {sale.payments.map((payment: any, index: number) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 12 }}>
                        <Tag color={getPaymentMethodColor(payment.payment_method)} style={{ fontSize: 11 }}>
                          {getPaymentMethodLabel(payment.payment_method)}
                        </Tag>
                      </Text>
                      <Text style={{ fontSize: 12 }}>${(Number(payment.amount) || 0).toFixed(2)}</Text>
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
