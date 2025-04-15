/* eslint-disable */
import { useMutation } from "@tanstack/react-query";
import { Button, Drawer, Form, Input, Select, message } from "antd";
import { useEffect } from "react";
import { patch, post } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import { models } from "../../constants/Models";
import useModelOptions from "../../hooks/useModelOptions";

// @ts-ignore
export default function DrawerForm({
  model,
  onClose,
  open,
  onSubmitSuccess,
  isEditing,
  editedItem,
  ...props
}) {
  const [form] = Form.useForm();

  const createData = useMutation({
    mutationFn: async (data) => await post(endpoints.plan, data),
    onSuccess: (response) => {
      message.success("Saved Successfully");
      form.resetFields();
      onSubmitSuccess();
    },
    onError: () => {
      message.error("Something went wrong");
    },
  });

  const updateData = useMutation({
    mutationFn: async (data: any) =>
      await patch(`${endpoints.plan}/${data.id}`, data),
    onSuccess: (response) => {
      message.success("Updated Successfully");
      form.resetFields();
      onSubmitSuccess(true);
    },
    onError: () => {
      message.error("Something went wrong");
    },
  });

  const permissionOptions: any = useModelOptions(models?.Permission, "action");

  const onFinish = async (formValues: any) => {
    const payload = {
      name: formValues.name,
      price: +formValues.price,
      permission_ids: formValues.permission_ids,
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
        price: editedItem.price,
        permission_ids: editedItem.permissions?.map(
          (p: any) => p.permission_id
        ),
      });
    } else {
      form.resetFields();
    }
  }, [isEditing, editedItem, form]);

  return (
    <>
      <Drawer
        title={isEditing ? "Update Plan" : "Add Plan"}
        onClose={onClose}
        width={600}
        open={open}
        style={{ maxHeight: "100vh", overflowY: "auto" }} // Adjusting drawer max height
      >
        <Form
          form={form}
          name="basic"
          labelCol={{ span: 8 }} // Adjust column width for better alignment
          wrapperCol={{ span: 16 }}
          labelAlign="right" // Right-align the labels
          onFinish={onFinish}
          onFinishFailed={onFinishFailed}
          autoComplete="off"
        >
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: "This field is required" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Price"
            name="price"
            rules={[
              {
                required: true,
                message: "This field is required",
              },
            ]}
          >
            <Input type="number" />
          </Form.Item>

          <Form.Item label="Permissions" name="permission_ids">
            <Select
              size="middle"
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              filterSort={(
                optionA: { label?: string },
                optionB: { label?: string }
              ) =>
                (optionA?.label ?? "")
                  .toLowerCase()
                  .localeCompare((optionB?.label ?? "").toLowerCase())
              }
              options={permissionOptions}
            />
          </Form.Item>

          <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={updateData.isPending || createData.isPending}
            >
              Save
            </Button>
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}
