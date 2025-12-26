import { ArrowLeftOutlined, SwapOutlined, CopyOutlined } from '@ant-design/icons';
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
import { setPageTitle } from '../../utils/setPageTitle';

const { Text } = Typography;

const QuotationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const quotationQuery = useQuery({
    queryKey: [queryKeys.quotation, parseInt(id || '0')],
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

  useEffect(() => {
    if (quotationQuery.isError) {
      message.error('Failed to load quotation details');
      navigate('/quotations');
    }
  }, [quotationQuery.isError, navigate]);

  useEffect(() => {
    if (quotation) {
      setPageTitle(`Quotation #${quotation.sale_number}`);
    }
  }, [quotation]);

  const handleConvertToSale = () => {
    if (!quotation) return;
    navigate(`/sales/add?quotation_id=${quotation.id}`);
  };

  const itemColumns = [
    {
      title: 'Product',
      key: 'product',
      render: (record: any) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {record.variant?.product?.name || 'Product'}
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.variant?.name || ''}
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
      title: 'Unit Price',
      dataIndex: 'unit_price',
      key: 'unit_price',
      render: (price: number) => `$${Number(price || 0).toFixed(2)}`,
    },
    {
      title: 'Quantity',
      key: 'quantity',
      render: (record: any) => (
        <div>
          <div>{record.quantity}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.variant?.sale_unit?.name || ''}
          </Text>
        </div>
      ),
    },
    {
      title: 'Tax',
      dataIndex: 'tax_amount',
      key: 'tax_amount',
      render: (tax: number) => `$${Number(tax || 0).toFixed(2)}`,
    },
    {
      title: 'Line Total',
      dataIndex: 'line_total',
      key: 'line_total',
      render: (total: number) => `$${Number(total || 0).toFixed(2)}`,
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
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
          { title: 'Home', href: '/' },
          { title: 'Quotations', href: '/quotations' },
          { title: `Quotation #${quotation.sale_number}` },
        ]}
        rightSection={
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/quotations')}
            >
              Back to Quotations
            </Button>
            <Button
              icon={<CopyOutlined />}
              onClick={() => navigate(`/add-quotation?copy_from=${quotation.id}`)}
            >
              Copy Quotation
            </Button>
            <Button
              type="primary"
              icon={<SwapOutlined />}
              onClick={handleConvertToSale}
              disabled={!!quotation.converted_to_sale_id}
            >
              {quotation.converted_to_sale_id ? 'Already Converted' : 'Convert to Sale'}
            </Button>
          </Space>
        }
      />

      {quotation.converted_to_sale_id && (
        <Card style={{ marginBottom: 16 }}>
          <Space direction="vertical">
            <Text strong>This quotation has been converted to a sale</Text>
            <Text type="secondary">
              Converted on: {quotation.converted_at ? dayjs(quotation.converted_at).format('MMM DD, YYYY hh:mm A') : 'N/A'}
            </Text>
            <Button 
              type="link" 
              onClick={() => navigate(`/sales/view/${quotation.converted_to_sale_id}`)}
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
                {dayjs(quotation.sale_date).format('MMM DD, YYYY HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="Branch">
                {quotation.branch?.name || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Created By">
                {quotation.user?.name || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Customer" span={2}>
                {quotation.customer_name || quotation.customer?.name || 'Walk-in Customer'}
                {(quotation.customer_phone || quotation.customer?.phone) && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Phone: {quotation.customer_phone || quotation.customer?.phone}
                    </Text>
                  </div>
                )}
                {(quotation.customer_email || quotation.customer?.email) && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Email: {quotation.customer_email || quotation.customer?.email}
                    </Text>
                  </div>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Price Type">
                <Tag color={quotation.price_type === 'wholesale' ? 'blue' : 'default'}>
                  {quotation.price_type === 'wholesale' ? 'Wholesale' : 'Regular'}
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
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Subtotal:</Text>
                <Text strong>${Number(quotation.subtotal || 0).toFixed(2)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Tax:</Text>
                <Text>${Number(quotation.tax_amount || 0).toFixed(2)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Discount:</Text>
                <Text>-${Number(quotation.discount_amount || 0).toFixed(2)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Shipping:</Text>
                <Text>${Number(quotation.shipping_cost || 0).toFixed(2)}</Text>
              </div>
              <Divider style={{ margin: '12px 0' }} />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 18,
                }}
              >
                <Text strong>Total:</Text>
                <Text strong style={{ color: '#1890ff' }}>
                  ${Number(quotation.total_amount || 0).toFixed(2)}
                </Text>
              </div>
            </Space>
          </Card>

          <Card title="Actions" style={{ marginTop: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
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
        </Col>
      </Row>
    </div>
  );
};

export default QuotationDetail;
