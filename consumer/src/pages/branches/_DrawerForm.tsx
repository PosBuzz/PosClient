import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Drawer, Form, Input, Switch } from "antd";
import { useEffect } from "react";
import { patch, post } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import { useMessageStore } from "../../stores/messageStore";
import { queryKeys } from "../../constants/queryKeys";

const { TextArea } = Input;

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
    mutationFn: async (data) => await post(endpoints.createBranch, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.branches] });
      messageApi?.success("Branch created successfully");
      form.resetFields();
      onSubmitSuccess();
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to create branch"
      );
    },
  });

  const updateData = useMutation({
    mutationFn: async (data: any) =>
      await patch(endpoints.updateBranch(data.id), data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.branches] });
      messageApi?.success("Branch updated successfully");
      form.resetFields();
      onSubmitSuccess(true);
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to update branch"
      );
    },
  });

  const onFinish = async (formValues: any) => {
    const payload = {
      name: formValues.name,
      phone: formValues.phone,
      email: formValues.email,
      address: formValues.address,
      is_main: formValues.is_main || false,
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
        phone: editedItem.phone,
        email: editedItem.email,
        address: editedItem.address,
        is_main: editedItem.is_main,
      });
    } else {
      form.resetFields();
    }
  }, [isEditing, editedItem, form]);

  return (
    <Drawer
      title={isEditing ? "Update Branch" : "Add Branch"}
      onClose={onClose}
      width={600}
      open={open}
      style={{ maxHeight: "100vh", overflowY: "auto" }}
    >
      <Form
        form={form}
        name="branch-form"
        labelCol={{ span: 8 }}
        wrapperCol={{ span: 16 }}
        labelAlign="right"
        onFinish={onFinish}
        onFinishFailed={onFinishFailed}
        autoComplete="off"
      >
        <Form.Item
          label="Branch Name"
          name="name"
          rules={[{ required: true, message: "Branch name is required" }]}
        >
          <Input placeholder="Enter branch name" />
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
          <TextArea rows={3} placeholder="Enter branch address (optional)" />
        </Form.Item>

        <Form.Item
          label="Main Branch"
          name="is_main"
          valuePropName="checked"
          extra="Only one branch can be marked as main branch"
        >
          <Switch />
        </Form.Item>

        <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={updateData.isPending || createData.isPending}
          >
            {isEditing ? "Update Branch" : "Create Branch"}
          </Button>
        </Form.Item>
      </Form>
    </Drawer>
  );
}
