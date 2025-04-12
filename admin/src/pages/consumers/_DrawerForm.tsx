/* eslint-disable */
import { useMutation } from "@tanstack/react-query";
import { Button, Drawer, Form, Input, Select, message } from "antd";
import { useEffect } from "react";
import { patch, post } from "../../api/crud-api";
import { endpoints, getUrlForModel } from "../../api/endpoints";
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
  const banner_type = Form.useWatch("banner_type", form);

  const createData = useMutation({
    mutationFn: async (data) => await post(endpoints.consumer, data),
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
      await patch(`${endpoints.consumer}/${data.id}`, data),
    onSuccess: (response) => {
      message.success("Updated Successfully");
      form.resetFields();
      onSubmitSuccess(true);
    },
    onError: () => {
      message.error("Something went wrong");
    },
  });

  const planOptions: any = useModelOptions(models?.Plan, "name");

  const onFinish = async (formValues: any) => {
    if (isEditing) {
      // Handle update logic if needed
      updateData.mutate({
        ...formValues,
        id: editedItem.id,
      });
    } else {
      const payload = {
        name: formValues.name,
        phone: formValues.phone,
        address: formValues.address,
        subdomain: formValues.subdomain,
        plan_id: formValues.plan_id, // dropdown or input
        email: formValues.email,
        password: formValues.password,
      };

      if (isEditing && editedItem) {
        return updateData.mutate(payload);
      }

      // @ts-ignore
      createData.mutate(payload);
    }
  };

  const onFinishFailed = (errorInfo: any) => {
    console.log("Failed:", errorInfo);
  };

  console.log(editedItem);

  useEffect(() => {
    if (isEditing && editedItem) {
      form.setFieldsValue({
        name: editedItem.name,
        email: editedItem.email,
        phone: editedItem.phone,
        address: editedItem.address,
        subdomain: editedItem.subdomain,
        plan_id: editedItem.plan_id,
      });
    } else {
      form.resetFields();
    }
  }, [isEditing, editedItem, form]);

  return (
    <>
      <Drawer
        title={isEditing ? "Update Banner" : "Add Banner"}
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

          <Form.Item label="Phone" name="phone">
            <Input />
          </Form.Item>

          <Form.Item label="Address" name="address">
            <Input />
          </Form.Item>

          <Form.Item
            label="Subdomain"
            name="subdomain"
            rules={[{ required: true, message: "This field is required" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item label="Plan ID" name="plan_id">
            <Select
              size="middle"
              allowClear
              // showSearch
              // optionFilterProp="label"
              // filterSort={(
              //   optionA: { label?: string },
              //   optionB: { label?: string }
              // ) =>
              //   (optionA?.label ?? "")
              //     .toLowerCase()
              //     .localeCompare((optionB?.label ?? "").toLowerCase())
              // }
              options={planOptions}
            />
          </Form.Item>

          <Form.Item
            label="Email"
            name="email"
            rules={[{ required: true, message: "This field is required" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: !isEditing, message: "This field is required" }]}
          >
            <Input.Password />
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
