/* eslint-disable */
import { useMutation } from "@tanstack/react-query";
import {
  Button,
  Drawer,
  Form,
  Input,
  Select,
  message
} from "antd";
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
    mutationFn: async (data) => await post(endpoints.createConsumer, data),
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
      await patch(getUrlForModel(model, data.id), data),
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

      // @ts-ignore
      createData.mutate(payload);
    }
  };

  const onFinishFailed = (errorInfo: any) => {
    console.log("Failed:", errorInfo);
  };

  useEffect(() => {
    if (editedItem) {
      const { data } = editedItem;

      const parsedData = JSON.parse(data ? data : "{}");

      const val = {
        is_active: editedItem?.is_active,
        banner_type: editedItem.banner_type,
        title: parsedData?.title,
        sub_title: parsedData?.sub_title,
        open_in_newtab: parsedData?.open_in_newtab,
        url: parsedData?.url,
        image: [
          {
            uid: "-1",
            status: "done",
            thumbUrl: parsedData?.image,
          },
        ],
      };
      form.setFieldsValue(val);
    } else {
      form.resetFields();
    }
  }, [isEditing, editedItem]);

  return (
    <>
      <Drawer
        title={isEditing ? "Update Banner" : "Add Banner"}
        onClose={onClose}
        width={600}
        open={open}
        bodyStyle={{ maxHeight: "100vh", overflowY: "auto" }} // Adjusting drawer max height
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
            label="Consumer Name"
            name="consumer_name"
            rules={[{ required: true }]}
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
            rules={[{ required: true }]}
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
            label="Password"
            name="password"
            rules={[{ required: true }]}
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
