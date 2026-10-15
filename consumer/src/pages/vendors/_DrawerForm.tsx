import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Drawer, Form, Input } from "antd";
import { useEffect } from "react";
import { patch, post } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import { useMessageStore } from "../../stores/messageStore";
import { queryKeys } from "../../constants/queryKeys";
import { getErrorMessage } from "../../utils/api-error";

const { TextArea } = Input;

interface VendorFormValues {
  id: number;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  address?: string;
}

interface DrawerFormProps {
  open: boolean;
  onClose: () => void;
  onSubmitSuccess: () => void;
  isEditing: boolean;
  editedItem: VendorFormValues | null;
}

export default function DrawerForm({
  onClose,
  open,
  onSubmitSuccess,
  isEditing,
  editedItem,
}: DrawerFormProps) {
  const [form] = Form.useForm();
  const { messageApi } = useMessageStore();
  const queryClient = useQueryClient();

  const createData = useMutation({
    mutationFn: async (data: Record<string, unknown>) =>
      await post(endpoints.createVendor, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.vendors] });
      messageApi?.success("Vendor created successfully");
      form.resetFields();
      onSubmitSuccess();
    },
    onError: (error: any) => {
      messageApi?.error(getErrorMessage(error, "Failed to create vendor"));
    },
  });

  const updateData = useMutation({
    mutationFn: async (data: { id: number } & Record<string, unknown>) =>
      await patch(endpoints.updateVendor(data.id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.vendors] });
      messageApi?.success("Vendor updated successfully");
      form.resetFields();
      onSubmitSuccess();
    },
    onError: (error: any) => {
      messageApi?.error(getErrorMessage(error, "Failed to update vendor"));
    },
  });

  const onFinish = async (formValues: any) => {
    const payload = {
      name: formValues.name,
      contact: formValues.contact,
      phone: formValues.phone,
      email: formValues.email,
      address: formValues.address,
    };

    if (isEditing && editedItem) {
      return updateData.mutate({
        ...payload,
        id: editedItem.id,
      });
    }

    createData.mutate(payload);
  };

  const onFinishFailed = (errorInfo: any) => {
    console.log("Failed:", errorInfo);
  };

  useEffect(() => {
    if (isEditing && editedItem) {
      form.setFieldsValue({
        name: editedItem.name,
        contact: editedItem.contact,
        phone: editedItem.phone,
        email: editedItem.email,
        address: editedItem.address,
      });
    } else {
      form.resetFields();
    }
  }, [isEditing, editedItem, form]);

  return (
    <Drawer
      title={isEditing ? "Update Vendor" : "Add Vendor"}
      onClose={onClose}
      width={500}
      open={open}
      style={{ maxHeight: "100vh", overflowY: "auto" }}
    >
      <Form
        form={form}
        name="vendor-form"
        labelCol={{ span: 8 }}
        wrapperCol={{ span: 16 }}
        labelAlign="right"
        onFinish={onFinish}
        onFinishFailed={onFinishFailed}
        autoComplete="off"
      >
        <Form.Item
          label="Vendor Name"
          name="name"
          rules={[{ required: true, message: "Vendor name is required" }]}
        >
          <Input placeholder="Enter vendor name" />
        </Form.Item>

        <Form.Item
          label="Contact Person"
          name="contact"
          rules={[{ required: false }]}
        >
          <Input placeholder="Enter contact person name" />
        </Form.Item>

        <Form.Item
          label="Phone"
          name="phone"
          rules={[
            { required: false },
            {
              pattern: /^[\d\s\-+()]+$/,
              message: "Please enter a valid phone number",
            },
          ]}
        >
          <Input placeholder="Enter phone number" />
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

        <Form.Item label="Address" name="address" rules={[{ required: false }]}>
          <TextArea rows={3} placeholder="Enter vendor address (optional)" />
        </Form.Item>

        <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={updateData.isPending || createData.isPending}
          >
            {isEditing ? "Update Vendor" : "Create Vendor"}
          </Button>
        </Form.Item>
      </Form>
    </Drawer>
  );
}
