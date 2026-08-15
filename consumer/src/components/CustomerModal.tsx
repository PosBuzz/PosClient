import { Button, DatePicker, Form, Input, Modal, Select, Space } from "antd";
import dayjs from "dayjs";
import { useEffect } from "react";
import { Customer, CustomerType } from "../types/customer.types";

const { Option } = Select;
const { TextArea } = Input;

interface CustomerModalProps {
  open: boolean;
  onClose: () => void;
  onCreateCustomer: (
    customer: Omit<
      Customer,
      "id" | "consumer_id" | "created_at" | "updated_at"
    >,
  ) => void;
}

const CustomerModal: React.FC<CustomerModalProps> = ({
  open,
  onClose,
  onCreateCustomer,
}) => {
  const [form] = Form.useForm();

  const handleCreateCustomer = (values: any) => {
    const newCustomer = {
      name: values.name,
      email: values.email,
      phone: values.phone,
      address: values.address,
      birthday: values.birthday
        ? values.birthday.format("YYYY-MM-DD")
        : undefined,
      customer_type: values.customer_type,
    };
    onCreateCustomer(newCustomer);
    handleClose();
  };

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  if (!open) {
    return null;
  }

  return (
    <Modal
      title="Add New Customer"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={600}
      destroyOnClose
    >
      <Form form={form} onFinish={handleCreateCustomer} layout="vertical">
        <Form.Item
          name="name"
          label="Customer Name"
          rules={[{ required: true, message: "Please enter customer name" }]}
        >
          <Input placeholder="Enter customer name" />
        </Form.Item>

        <Form.Item
          name="customer_type"
          label="Customer Type"
          rules={[{ required: true, message: "Please select customer type" }]}
          initialValue={CustomerType.INDIVIDUAL}
        >
          <Select>
            <Option value={CustomerType.INDIVIDUAL}>Individual</Option>
            <Option value={CustomerType.BUSINESS}>Business</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="phone"
          label="Phone"
          rules={[{ required: true, message: "Please enter phone number" }]}
        >
          <Input placeholder="Enter phone number" />
        </Form.Item>

        <Form.Item
          name="email"
          label="Email"
          rules={[{ type: "email", message: "Please enter valid email" }]}
        >
          <Input placeholder="Enter email address" />
        </Form.Item>

        <Form.Item name="birthday" label="Birthday">
          <DatePicker
            style={{ width: "100%" }}
            format="YYYY-MM-DD"
            placeholder="Select date of birth (optional)"
            disabledDate={(current) =>
              current && current > dayjs().endOf("day")
            }
          />
        </Form.Item>

        <Form.Item name="address" label="Address">
          <TextArea rows={3} placeholder="Enter address" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Space style={{ width: "100%", justifyContent: "flex-end" }}>
            <Button onClick={handleClose}>Cancel</Button>
            <Button type="primary" htmlType="submit">
              Add Customer
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CustomerModal;
