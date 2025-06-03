import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Drawer, Form, Input } from "antd";
import { useEffect } from "react";
import { patch, post } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import { useMessageStore } from "../../stores/messageStore";
import { queryKeys } from "../../constants/queryKeys";
import ImageInput from "../../components/ImageInput";
import { getImageUrlForCloudinaryImage } from "../../utils/upload";

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
    mutationFn: async (data) => await post(endpoints.createBrand, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.brands] });
      messageApi?.success("Brand created successfully");
      form.resetFields();
      onSubmitSuccess();
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to create brand"
      );
    },
  });

  const updateData = useMutation({
    mutationFn: async (data: any) =>
      await patch(endpoints.updateBrand(data.id), data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.brands] });
      messageApi?.success("Brand updated successfully");
      form.resetFields();
      onSubmitSuccess(true);
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to update brand"
      );
    },
  });

  const onFinish = async (formValues: any) => {
    if (formValues.logo) {
      const url = getImageUrlForCloudinaryImage(formValues, "logo");
      formValues.logo = url;
    }

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
        website: editedItem.website,
        logo: [
          {
            uid: "-1",
            status: "done",
            thumbUrl: editedItem?.logo,
          },
        ],
      });
    } else {
      form.resetFields();
    }
  }, [isEditing, editedItem, form]);

  return (
    <Drawer
      title={isEditing ? "Update Brand" : "Add Brand"}
      onClose={onClose}
      width={500}
      open={open}
      style={{ maxHeight: "100vh", overflowY: "auto" }}
    >
      <Form
        form={form}
        name="brand-form"
        labelCol={{ span: 8 }}
        wrapperCol={{ span: 16 }}
        labelAlign="right"
        onFinish={onFinish}
        onFinishFailed={onFinishFailed}
        autoComplete="off"
      >
        <Form.Item
          label="Brand Name"
          name="name"
          rules={[{ required: true, message: "Brand name is required" }]}
        >
          <Input placeholder="Enter brand name" />
        </Form.Item>

        <Form.Item
          label="Website"
          name="website"
          rules={[
            { required: false },
            { type: "url", message: "Please enter a valid website URL" },
          ]}
        >
          <Input placeholder="Enter website URL (optional)" />
        </Form.Item>

        <ImageInput name="logo" label="logo" />

        <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={updateData.isPending || createData.isPending}
          >
            {isEditing ? "Update Brand" : "Create Brand"}
          </Button>
        </Form.Item>
      </Form>
    </Drawer>
  );
}
