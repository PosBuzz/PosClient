import { useMutation } from "@tanstack/react-query";
import { Button, DatePicker, Drawer, Form, Input, Select } from "antd";
import dayjs from "dayjs";
import { useEffect } from "react";
import { patch, post } from "../../api/http";
import { endpoints } from "../../api/endpoints";
import { useMessageStore } from "../../stores/messageStore";

export default function DrawerForm({
  onClose,
  open,
  onSubmitSuccess,
  isEditing,
  editedItem,
  consumers,
  refetch,
}) {
  const [form] = Form.useForm();
  const consumer_id = Form.useWatch("consumer_id", form);
  const selectedConsumer = consumers?.find((i) => i.id === consumer_id);

  const { messageApi } = useMessageStore();

  const createData = useMutation({
    mutationFn: async (data) => await post(endpoints.billing, data),
    onSuccess: () => {
      refetch();
      messageApi?.success("Saved Successfully");
      form.resetFields();
      onSubmitSuccess();
    },
    onError: () => {
      messageApi?.error("Something went wrong");
    },
  });

  const updateData = useMutation({
    mutationFn: async (data: any) =>
      await patch(`${endpoints.billing}/${data.id}`, data),
    onSuccess: () => {
      refetch();
      messageApi?.success("Updated Successfully");
      form.resetFields();
      onSubmitSuccess(true);
    },
    onError: () => {
      messageApi?.error("Something went wrong");
    },
  });

  const consumerOptions: any = consumers?.map((i: any) => ({
    label: `${i.company_name} (${i.plan.name})`,
    value: i.id,
  }));

  const onFinish = async (formValues: any) => {
    const reference = formValues.reference?.trim() || null;

    const payload = {
      consumer_id: formValues.consumer_id,
      plan_id: selectedConsumer?.plan.id,
      amount: +formValues.amount,
      billing_date: dayjs(formValues.billing_date).toISOString(),
      reference,
    };

    if (isEditing && editedItem) {
      return updateData.mutate({
        ...payload,
        id: editedItem.id,
      });
    }

    // @ts-expect-error -- the legacy mutation infers a narrower payload type.
    createData.mutate(payload);
  };

  const onFinishFailed = (errorInfo: any) => {
    console.log("Failed:", errorInfo);
  };

  useEffect(() => {
    if (isEditing && editedItem) {
      form.setFieldsValue({
        consumer_id: editedItem.consumer_id,
        amount: editedItem.amount,
        billing_date: dayjs(editedItem.billing_date),
        reference: editedItem.reference,
      });
    } else {
      form.resetFields();
    }
  }, [isEditing, editedItem, form]);

  useEffect(() => {
    if (selectedConsumer && !isEditing) {
      form.setFieldValue("amount", selectedConsumer?.plan.price);
    }
  }, [consumer_id]);

  return (
    <>
      <Drawer
        title={isEditing ? "Update Bill" : "Add Bill"}
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
          <Form.Item label="Consumer" name="consumer_id">
            <Select
              placeholder="Select Consumer"
              size="middle"
              allowClear
              showSearch
              optionFilterProp="label"
              filterSort={(
                optionA: { label?: string },
                optionB: { label?: string },
              ) =>
                (optionA?.label ?? "")
                  .toLowerCase()
                  .localeCompare((optionB?.label ?? "").toLowerCase())
              }
              options={consumerOptions}
            />
          </Form.Item>
          <Form.Item
            label="Billing Date"
            name="billing_date"
            rules={[{ required: true, message: "This field is required" }]}
          >
            <DatePicker
              style={{ width: "100%" }}
              // disabledDate={isMonthDisabled}
              disabled={!consumer_id}
            />
          </Form.Item>

          <Form.Item
            label="Amount"
            name="amount"
            rules={[
              {
                required: true,
                message: "This field is required",
              },
            ]}
          >
            <Input type="number" />
          </Form.Item>

          <Form.Item label="Reference" name="reference">
            <Input />
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
