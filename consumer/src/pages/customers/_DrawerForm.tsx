import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Drawer, Form, Input, Select } from "antd";
import { useEffect } from "react";
import { patch, post } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import { useMessageStore } from "../../stores/messageStore";
import { queryKeys } from "../../constants/queryKeys";
import { CustomerType } from "../../types/customer.types";

const { TextArea } = Input;
const { Option } = Select;

// @ts-ignore
export default function DrawerForm({
  onClose,
  open,
  onSubmitSuccess,
  isEditing,
  editedItem,
  ...props
}) {
  const [form] = Form.useForm();
  const { messageApi } = useMessageStore();
  const queryClient = useQueryClient();

  const createData = useMutation({
    mutationFn: async (data: any) => await post(endpoints.createCustomer, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.customers] });
      messageApi?.success("Customer created successfully");
      form.resetFields();
      onSubmitSuccess();
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to create customer"
      );
    },
  });

  const updateData = useMutation({
    mutationFn: async (data: any) =>
      await patch(endpoints.updateCustomer(data.id), data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.customers] });
      messageApi?.success("Customer updated successfully");
      form.resetFields();
      onSubmitSuccess(true);
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to update customer"
      );
    },
  });

  const onFinish = async (formValues: any) => {
    const payload = {
      name: formValues.name,
      email: formValues.email,
      phone: formValues.phone,
      address: formValues.address,
      customer_type: formValues.customer_type,
    };

    if (isEditing && editedItem) {
      return updateData.mutate({
        ...payload,
        id: editedItem.id,
      });
    }

    // @ts-ignore
    createData.mutate(payload);
  };

  const onFinishFailed = (errorInfo: any) => {
    console.log("Failed:", errorInfo);
  };

  useEffect(() => {
    if (isEditing && editedItem) {
      form.setFieldsValue({
        name: editedItem.name,
        email: editedItem.email,
        phone: editedItem.phone,
        address: editedItem.address,
        customer_type: editedItem.customer_type,
      });
    } else {
      form.resetFields();
    }
  }, [isEditing, editedItem, form]);

  return (
    <Drawer
      title={isEditing ? "Update Customer" : "Add Customer"}
      onClose={onClose}
      width={600}
      open={open}
      style={{ maxHeight: "100vh", overflowY: "auto" }}
    >
      <Form
        form={form}
        name="customer-form"
        labelCol={{ span: 8 }}
        wrapperCol={{ span: 16 }}
        labelAlign="right"
        onFinish={onFinish}
        onFinishFailed={onFinishFailed}
        autoComplete="off"
        initialValues={{
          customer_type: CustomerType.INDIVIDUAL,
        }}
      >
        <Form.Item
          label="Customer Name"
          name="name"
          rules={[{ required: true, message: "Customer name is required" }]}
        >
          <Input placeholder="Enter customer name" />
        </Form.Item>

        <Form.Item
          label="Customer Type"
          name="customer_type"
          rules={[{ required: true, message: "Customer type is required" }]}
        >
          <Select placeholder="Select customer type">
            <Option value={CustomerType.INDIVIDUAL}>Individual</Option>
            <Option value={CustomerType.BUSINESS}>Business</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Email"
          name="email"
          rules={[
            { required: false },
            { type: "email", message: "Please enter a valid email address" },
          ]}
        >
          <Input placeholder="Enter email address" />
        </Form.Item>

        <Form.Item
          label="Phone"
          name="phone"
          rules={[
            { required: false },
            {
              pattern: /^[\d\s\-\+\(\)]+$/,
              message: "Please enter a valid phone number",
            },
          ]}
        >
          <Input placeholder="Enter phone number" />
        </Form.Item>

        <Form.Item label="Address" name="address" rules={[{ required: false }]}>
          <TextArea rows={3} placeholder="Enter customer address (optional)" />
        </Form.Item>

        <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={updateData.isPending || createData.isPending}
          >
            {isEditing ? "Update Customer" : "Create Customer"}
          </Button>
        </Form.Item>
      </Form>
    </Drawer>
  );
}
