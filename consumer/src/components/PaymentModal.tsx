import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Table,
  InputNumber,
  Typography,
  Row,
  Col,
  Divider,
  message,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { PaymentMethod, SalePayment } from '../types/sale.types';

const { Option } = Select;
const { Text } = Typography;

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (payments: SalePayment[]) => void;
  totalAmount: number;
  initialPayments?: SalePayment[];
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  open,
  onClose,
  onSave,
  totalAmount,
  initialPayments = [],
}) => {
  const [form] = Form.useForm();
  const [payments, setPayments] = useState<SalePayment[]>(initialPayments);

  useEffect(() => {
    setPayments(initialPayments);
  }, [initialPayments, open]);

  const paymentMethodOptions = [
    { label: 'Cash', value: PaymentMethod.CASH },
    { label: 'Card', value: PaymentMethod.CARD },
    { label: 'Cheque', value: PaymentMethod.CHEQUE },
    { label: 'Bank Transfer', value: PaymentMethod.BANK_TRANSFER },
    { label: 'Mobile Money', value: PaymentMethod.MOBILE_MONEY },
    { label: 'MFS', value: PaymentMethod.MFS },
    { label: 'Deposit', value: PaymentMethod.DEPOSIT },
    { label: 'Credit', value: PaymentMethod.CREDIT },
  ];

  const addPayment = (values: any) => {
    const newPayment: SalePayment = {
      payment_method: values.payment_method,
      amount: values.amount,
      reference: values.reference,
      notes: values.notes,
    };

    setPayments([...payments, newPayment]);
    form.resetFields();
  };

  const removePayment = (index: number) => {
    const updatedPayments = payments.filter((_, i) => i !== index);
    setPayments(updatedPayments);
  };

  const updatePayment = (index: number, field: string, value: any) => {
    const updatedPayments = payments.map((payment, i) =>
      i === index ? { ...payment, [field]: value } : payment
    );
    setPayments(updatedPayments);
  };

  const getTotalPaid = () => {
    return payments.reduce((sum, payment) => sum + payment.amount, 0);
  };

  const getRemainingAmount = () => {
    return totalAmount - getTotalPaid();
  };

  const handleSave = () => {
    if (payments.length === 0) {
      message.error('Please add at least one payment method');
      return;
    }

    const totalPaid = getTotalPaid();
    if (totalPaid > totalAmount) {
      message.error('Total payment cannot exceed the total amount');
      return;
    }

    onSave(payments);
    onClose();
  };

  const columns = [
    {
      title: 'Payment Method',
      dataIndex: 'payment_method',
      key: 'payment_method',
      render: (method: PaymentMethod, record: SalePayment, index: number) => (
        <Select
          value={method}
          onChange={(value) => updatePayment(index, 'payment_method', value)}
          style={{ width: 150 }}
        >
          {paymentMethodOptions.map((option) => (
            <Option key={option.value} value={option.value}>
              {option.label}
            </Option>
          ))}
        </Select>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number, record: SalePayment, index: number) => (
        <InputNumber
          value={amount}
          onChange={(value) => updatePayment(index, 'amount', value || 0)}
          min={0.01}
          precision={2}
          style={{ width: 120 }}
          formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
        />
      ),
    },
    {
      title: 'Reference',
      dataIndex: 'reference',
      key: 'reference',
      render: (reference: string, record: SalePayment, index: number) => (
        <Input
          value={reference}
          onChange={(e) => updatePayment(index, 'reference', e.target.value)}
          placeholder="Transaction reference"
          style={{ width: 150 }}
        />
      ),
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      key: 'notes',
      render: (notes: string, record: SalePayment, index: number) => (
        <Input
          value={notes}
          onChange={(e) => updatePayment(index, 'notes', e.target.value)}
          placeholder="Payment notes"
          style={{ width: 150 }}
        />
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: SalePayment, index: number) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removePayment(index)}
        />
      ),
    },
  ];

  return (
    <Modal
      title="Payment Details"
      open={open}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="save" type="primary" onClick={handleSave}>
          Save Payments
        </Button>,
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Text strong>Total Amount: </Text>
            <Text style={{ fontSize: 16, color: '#1890ff' }}>
              ${totalAmount.toFixed(2)}
            </Text>
          </Col>
          <Col span={8}>
            <Text strong>Total Paid: </Text>
            <Text style={{ fontSize: 16, color: '#52c41a' }}>
              ${getTotalPaid().toFixed(2)}
            </Text>
          </Col>
          <Col span={8}>
            <Text strong>Remaining: </Text>
            <Text
              style={{
                fontSize: 16,
                color: getRemainingAmount() > 0 ? '#f5222d' : '#52c41a',
              }}
            >
              ${getRemainingAmount().toFixed(2)}
            </Text>
          </Col>
        </Row>
      </div>

      <Divider />

      <Form form={form} onFinish={addPayment} layout="vertical">
        <Row gutter={16}>
          <Col span={6}>
            <Form.Item
              name="payment_method"
              label="Payment Method"
              rules={[{ required: true, message: 'Please select payment method' }]}
            >
              <Select placeholder="Select method">
                {paymentMethodOptions.map((option) => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              name="amount"
              label="Amount"
              rules={[
                { required: true, message: 'Please enter amount' },
                {
                  validator: (_, value) => {
                    if (value && value + getTotalPaid() > totalAmount) {
                      return Promise.reject(
                        new Error('Total payment cannot exceed bill amount')
                      );
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <InputNumber
                min={0.01}
                precision={2}
                style={{ width: '100%' }}
                formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                placeholder="0.00"
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="reference" label="Reference">
              <Input placeholder="Transaction reference" />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="notes" label="Notes">
              <Input placeholder="Notes" />
            </Form.Item>
          </Col>
          <Col span={2}>
            <Form.Item label=" ">
              <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
                Add
              </Button>
            </Form.Item>
          </Col>
        </Row>
      </Form>

      <Divider />

      <Table
        dataSource={payments}
        columns={columns}
        pagination={false}
        size="small"
        locale={{ emptyText: 'No payments added' }}
        rowKey={(record, index) => index!}
      />

      {getRemainingAmount() > 0 && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            backgroundColor: '#fff2e8',
            border: '1px solid #ffbb96',
            borderRadius: 6,
          }}
        >
          <Text type="warning">
            <strong>Notice:</strong> There is an outstanding balance of $
            {getRemainingAmount().toFixed(2)}. The payment status will be set to "Partial".
          </Text>
        </div>
      )}
    </Modal>
  );
};

export default PaymentModal;
