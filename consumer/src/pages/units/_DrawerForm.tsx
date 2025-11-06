import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Drawer, Form, Input } from "antd";
import { useEffect } from "react";
import { patch, post } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import { useMessageStore } from "../../stores/messageStore";
import { queryKeys } from "../../constants/queryKeys";

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
    mutationFn: async (data) => await post(endpoints.createUnit, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.units] });
      messageApi?.success("Unit created successfully");
      form.resetFields();
      onSubmitSuccess();
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to create unit"
      );
    },
  });

  const updateData = useMutation({
    mutationFn: async (data: any) =>
      await patch(endpoints.updateUnit(data.id), data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.units] });
      messageApi?.success("Unit updated successfully");
      form.resetFields();
      onSubmitSuccess(true);
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to update unit"
      );
    },
  });

  const onFinish = async (formValues: any) => {
    if (isEditing && editedItem) {
      return updateData.mutate({
        ...formValues,
        id: editedItem.id,
      });
    }

    // @ts-ignore
    createData.mutate(formValues);
  };

  const onFinishFailed = (errorInfo: any) => {
    console.log("Failed:", errorInfo);
  };

  useEffect(() => {
    if (isEditing && editedItem) {
      form.setFieldsValue({
        name: editedItem.name,
      });
    } else {
      form.resetFields();
    }
  }, [isEditing, editedItem, form]);

  return (
    <Drawer
      title={isEditing ? "Update Unit" : "Add Unit"}
      onClose={onClose}
      width={500}
      open={open}
      style={{ maxHeight: "100vh", overflowY: "auto" }}
    >
      <Form
        form={form}
        name="unit-form"
        labelCol={{ span: 8 }}
        wrapperCol={{ span: 16 }}
        labelAlign="right"
        onFinish={onFinish}
        onFinishFailed={onFinishFailed}
        autoComplete="off"
      >
        <Form.Item
          label="Unit Name"
          name="name"
          rules={[{ required: true, message: "Unit name is required" }]}
        >
          <Input placeholder="Enter unit name (e.g. Kilogram, Liter)" />
        </Form.Item>

        <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={updateData.isPending || createData.isPending}
          >
            {isEditing ? "Update Unit" : "Create Unit"}
          </Button>
        </Form.Item>
      </Form>
    </Drawer>
  );
}
