import {
  ArrowLeftOutlined,
  DeleteOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Typography,
  message,
  Divider,
} from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { returnsApi } from "../../api/returns-api";
import { salesApi } from "../../api/sales-api";
import PageTitle from "../../components/PageTitle";
import { queryKeys } from "../../constants/queryKeys";

import type {
  CreateReturnForm,
  CreateReturnItemForm,
  CreateReturnPaymentForm,
  CreateReturnExchangeForm,
} from "../../types/return.types";
import { PaymentMethod } from "../../types/sale.types";
import { setPageTitle } from "../../utils/setPageTitle";

const { Option } = Select;
const { Text, Title } = Typography;
const { TextArea } = Input;

const CreateReturn = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const [saleId, setSaleId] = useState<number | null>(null);
  const [selectedItems, setSelectedItems] = useState<CreateReturnItemForm[]>([]);
  const [payments, setPayments] = useState<CreateReturnPaymentForm[]>([]);
  const [exchanges, setExchanges] = useState<CreateReturnExchangeForm[]>([]);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [exchangeModalVisible, setExchangeModalVisible] = useState(false);

  // Get sale data when sale ID is selected
  const saleQuery = useQuery({
    queryKey: [queryKeys.sale, saleId],
    queryFn: () => salesApi.getSale(saleId!),
    enabled: !!saleId,
  });

  const createReturnMutation = useMutation({
    mutationFn: (data: CreateReturnForm) => returnsApi.createReturn(data),
    onSuccess: (data) => {
      message.success("Return created successfully!");
      queryClient.invalidateQueries({ queryKey: [queryKeys.returns] });
      navigate(`/returns/view/${data.id}`);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || "Failed to create return");
    },
  });

  useEffect(() => {
    setPageTitle("Create Return");
  }, []);

  const handleSaleSearch = () => {
    const searchSaleId = form.getFieldValue('search_sale_id');
    if (searchSaleId) {
      setSaleId(searchSaleId);
      setSelectedItems([]);
      setPayments([]);
      setExchanges([]);
    }
  };

  const handleItemSelect = (saleItem: any, quantity: number, refundAmount: number) => {
    const existingItemIndex = selectedItems.findIndex(
      item => item.sale_item_id === saleItem.id
    );

    if (existingItemIndex >= 0) {
      // Update existing item
      const updatedItems = [...selectedItems];
      updatedItems[existingItemIndex] = {
        ...updatedItems[existingItemIndex],
        quantity,
        refund_amount: refundAmount,
      };
      setSelectedItems(updatedItems);
    } else {
      // Add new item
      const newItem: CreateReturnItemForm = {
        sale_item_id: saleItem.id,
        variant_id: saleItem.variant_id,
        batch_id: saleItem.batch_id,
        quantity,
        refund_amount: refundAmount,
        max_quantity: saleItem.available_for_return || saleItem.quantity,
        variant_name: saleItem.variant_name,
        product_name: saleItem.product_name,
        unit_price: saleItem.unit_price,
        unit_name: saleItem.unit_name,
        image: saleItem.image,
      };
      setSelectedItems([...selectedItems, newItem]);
    }
  };

  const handleItemRemove = (saleItemId: number) => {
    setSelectedItems(items => items.filter(item => item.sale_item_id !== saleItemId));
  };

  const addPayment = (payment: CreateReturnPaymentForm) => {
    setPayments([...payments, payment]);
    setPaymentModalVisible(false);
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const addExchange = (exchange: CreateReturnExchangeForm) => {
    setExchanges([...exchanges, exchange]);
    setExchangeModalVisible(false);
  };

  const removeExchange = (index: number) => {
    setExchanges(exchanges.filter((_, i) => i !== index));
  };

  const handleSubmit = async (values: any) => {
    if (!saleId) {
      message.error("Please select a sale first");
      return;
    }

    if (selectedItems.length === 0) {
      message.error("Please select at least one item to return");
      return;
    }

    const returnData: CreateReturnForm = {
      original_sale_id: saleId,
      branch_id: values.branch_id || saleQuery.data?.branch_id,
      reason: values.reason,
      notes: values.notes,
      items: selectedItems,
      payments: payments.length > 0 ? payments : undefined,
      exchanges: exchanges.length > 0 ? exchanges : undefined,
    };

    await createReturnMutation.mutateAsync(returnData);
  };

  const getTotalRefund = () => {
    return selectedItems.reduce((sum, item) => sum + Number(item.refund_amount), 0);
  };

  const getTotalExchange = () => {
    return exchanges.reduce((sum, exchange) => sum + Number(exchange.line_total), 0);
  };

  const getTotalPayments = () => {
    return payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  };

  const saleItemColumns = [
    {
      title: "Product",
      key: "product",
      render: (record: any) => (
        <div>
          <div>{record.product_name}</div>
          <Text type="secondary">{record.variant_name}</Text>
        </div>
      ),
    },
    {
      title: "Original Qty",
      dataIndex: "quantity",
      key: "quantity",
    },
    {
      title: "Available",
      key: "available",
      render: (record: any) => record.available_for_return || record.quantity,
    },
    {
      title: "Unit Price",
      dataIndex: "unit_price",
      key: "unit_price",
      render: (price: number) => `$${Number(price).toFixed(2)}`,
    },
    {
      title: "Return Qty",
      key: "return_qty",
      render: (record: any) => {
        const selectedItem = selectedItems.find(item => item.sale_item_id === record.id);
        return (
          <InputNumber
            min={0}
            max={record.available_for_return || record.quantity}
            value={selectedItem?.quantity || 0}
            onChange={(value) => {
              const refundAmount = (value || 0) * record.unit_price;
              handleItemSelect(record, value || 0, refundAmount);
            }}
            style={{ width: 80 }}
          />
        );
      },
    },
    {
      title: "Refund Amount",
      key: "refund_amount",
      render: (record: any) => {
        const selectedItem = selectedItems.find(item => item.sale_item_id === record.id);
        return (
          <InputNumber
            min={0}
            value={selectedItem?.refund_amount || 0}
            onChange={(value) => {
              const quantity = selectedItem?.quantity || 0;
              handleItemSelect(record, quantity, value || 0);
            }}
            formatter={(value) => `$ ${value}`}
            parser={(value) => parseFloat(value!.replace(/\$\s?|(,*)/g, "")) || 0}
            style={{ width: 120 }}
          />
        );
      },
    },
  ];

  const selectedItemsColumns = [
    {
      title: "Product",
      key: "product",
      render: (record: CreateReturnItemForm) => (
        <div>
          <div>{record.product_name}</div>
          <Text type="secondary">{record.variant_name}</Text>
        </div>
      ),
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
    },
    {
      title: "Refund Amount",
      dataIndex: "refund_amount",
      key: "refund_amount",
      render: (amount: number) => `$${Number(amount).toFixed(2)}`,
    },
    {
      title: "Actions",
      key: "actions",
      render: (record: CreateReturnItemForm) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleItemRemove(record.sale_item_id)}
        />
      ),
    },
  ];

  return (
    <div>
      <PageTitle
        title="Create Return"
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Returns", href: "/returns" },
          { title: "Create Return" },
        ]}
      />

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Row gutter={[24, 24]}>
          {/* Sale Selection */}
          <Col span={24}>
            <Card title="Select Original Sale" size="small">
              <Row gutter={[16, 16]} align="middle">
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="search_sale_id"
                    label="Sale ID"
                    rules={[{ required: true, message: "Please enter sale ID" }]}
                  >
                    <InputNumber
                      placeholder="Enter sale ID"
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Button
                    type="primary"
                    icon={<SearchOutlined />}
                    onClick={handleSaleSearch}
                    loading={saleQuery.isLoading}
                  >
                    Search Sale
                  </Button>
                </Col>
              </Row>

              {saleQuery.data && (
                <Card size="small" style={{ marginTop: 16, backgroundColor: "#f9f9f9" }}>
                  <Row gutter={[16, 8]}>
                    <Col span={12}>
                      <Text strong>Sale Number: </Text>
                      <Text>{saleQuery.data.sale_number}</Text>
                    </Col>
                    <Col span={12}>
                      <Text strong>Customer: </Text>
                      <Text>{saleQuery.data.customer_name || "Walk-in Customer"}</Text>
                    </Col>
                    <Col span={12}>
                      <Text strong>Total Amount: </Text>
                      <Text>${Number(saleQuery.data.total_amount).toFixed(2)}</Text>
                    </Col>
                    <Col span={12}>
                      <Text strong>Sale Date: </Text>
                      <Text>{new Date(saleQuery.data.sale_date).toLocaleDateString()}</Text>
                    </Col>
                  </Row>
                </Card>
              )}
            </Card>
          </Col>

          {/* Sale Items */}
          {saleQuery.data && (
            <Col span={24}>
              <Card title="Sale Items" size="small">
                <Table
                  columns={saleItemColumns}
                  dataSource={saleQuery.data.items || []}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              </Card>
            </Col>
          )}

          {/* Selected Items for Return */}
          {selectedItems.length > 0 && (
            <Col span={24}>
              <Card title="Items to Return" size="small">
                <Table
                  columns={selectedItemsColumns}
                  dataSource={selectedItems}
                  rowKey="sale_item_id"
                  pagination={false}
                  size="small"
                />
                <Divider />
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Text strong>Total Refund: ${getTotalRefund().toFixed(2)}</Text>
                  </Col>
                  <Col span={12}>
                    <Text strong>Total Exchange: ${getTotalExchange().toFixed(2)}</Text>
                  </Col>
                </Row>
              </Card>
            </Col>
          )}

          {/* Return Details */}
          <Col xs={24} md={12}>
            <Card title="Return Details" size="small">
              <Form.Item name="reason" label="Reason for Return">
                <Select placeholder="Select reason">
                  <Option value="Defective">Defective</Option>
                  <Option value="Wrong Item">Wrong Item</Option>
                  <Option value="Customer Request">Customer Request</Option>
                  <Option value="Quality Issue">Quality Issue</Option>
                  <Option value="Other">Other</Option>
                </Select>
              </Form.Item>

              <Form.Item name="notes" label="Notes">
                <TextArea rows={3} placeholder="Additional notes..." />
              </Form.Item>
            </Card>
          </Col>

          {/* Payments & Exchanges */}
          <Col xs={24} md={12}>
            <Card title="Payments & Exchanges" size="small">
              <Space direction="vertical" style={{ width: "100%" }}>
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => setPaymentModalVisible(true)}
                  block
                >
                  Add Payment
                </Button>

                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => setExchangeModalVisible(true)}
                  block
                >
                  Add Exchange Item
                </Button>

                {payments.length > 0 && (
                  <div>
                    <Title level={5}>Payments</Title>
                    {payments.map((payment, index) => (
                      <div key={index} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Text>{payment.payment_method}: ${payment.amount.toFixed(2)}</Text>
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => removePayment(index)}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {exchanges.length > 0 && (
                  <div>
                    <Title level={5}>Exchanges</Title>
                    {exchanges.map((exchange, index) => (
                      <div key={index} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Text>Qty {exchange.quantity}: ${exchange.line_total.toFixed(2)}</Text>
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => removeExchange(index)}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <Divider />
                <div>
                  <Text>Total Payments: ${getTotalPayments().toFixed(2)}</Text>
                </div>
              </Space>
            </Card>
          </Col>

          {/* Actions */}
          <Col span={24}>
            <Card size="small">
              <Space>
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate("/returns")}
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={createReturnMutation.isPending}
                  disabled={selectedItems.length === 0}
                >
                  Create Return
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </Form>

      {/* Payment Modal */}
      <Modal
        title="Add Payment"
        open={paymentModalVisible}
        onCancel={() => setPaymentModalVisible(false)}
        footer={null}
      >
        <PaymentForm
          onSubmit={addPayment}
          onCancel={() => setPaymentModalVisible(false)}
        />
      </Modal>

      {/* Exchange Modal */}
      <Modal
        title="Add Exchange Item"
        open={exchangeModalVisible}
        onCancel={() => setExchangeModalVisible(false)}
        footer={null}
      >
        <ExchangeForm
          onSubmit={addExchange}
          onCancel={() => setExchangeModalVisible(false)}
        />
      </Modal>
    </div>
  );
};

// Payment Form Component
const PaymentForm = ({
  onSubmit,
  onCancel,
}: {
  onSubmit: (payment: CreateReturnPaymentForm) => void;
  onCancel: () => void;
}) => {
  const [form] = Form.useForm();

  const handleSubmit = async (values: any) => {
    await form.validateFields();
    onSubmit(values);
    form.resetFields();
  };

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit}>
      <Form.Item
        name="payment_method"
        label="Payment Method"
        rules={[{ required: true, message: "Please select payment method" }]}
      >
        <Select>
          {Object.values(PaymentMethod).map(method => (
            <Option key={method} value={method}>{method}</Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        name="amount"
        label="Amount"
        rules={[{ required: true, message: "Please enter amount" }]}
      >
        <InputNumber
          style={{ width: "100%" }}
          min={0}
          step={0.01}
          addonBefore="$"
        />
      </Form.Item>

      <Form.Item name="reference" label="Reference">
        <Input placeholder="Transaction reference..." />
      </Form.Item>

      <Form.Item name="notes" label="Notes">
        <TextArea rows={2} placeholder="Payment notes..." />
      </Form.Item>

      <Form.Item>
        <Space>
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="primary" htmlType="submit">
            Add Payment
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

// Exchange Form Component
const ExchangeForm = ({
  onSubmit,
  onCancel,
}: {
  onSubmit: (exchange: CreateReturnExchangeForm) => void;
  onCancel: () => void;
}) => {
  const [form] = Form.useForm();

  const handleSubmit = async (values: any) => {
    await form.validateFields();
    const exchange: CreateReturnExchangeForm = {
      ...values,
      line_total: values.quantity * values.unit_price,
    };
    onSubmit(exchange);
    form.resetFields();
  };

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit}>
      <Form.Item
        name="variant_id"
        label="Product Variant ID"
        rules={[{ required: true, message: "Please enter variant ID" }]}
      >
        <InputNumber style={{ width: "100%" }} />
      </Form.Item>

      <Form.Item name="batch_id" label="Batch ID">
        <InputNumber style={{ width: "100%" }} />
      </Form.Item>

      <Form.Item
        name="quantity"
        label="Quantity"
        rules={[{ required: true, message: "Please enter quantity" }]}
      >
        <InputNumber style={{ width: "100%" }} min={1} />
      </Form.Item>

      <Form.Item
        name="unit_price"
        label="Unit Price"
        rules={[{ required: true, message: "Please enter unit price" }]}
      >
        <InputNumber
          style={{ width: "100%" }}
          min={0}
          step={0.01}
          addonBefore="$"
        />
      </Form.Item>

      <Form.Item>
        <Space>
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="primary" htmlType="submit">
            Add Exchange
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default CreateReturn;
