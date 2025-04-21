import { useMutation } from "@tanstack/react-query";
import { Button, DatePicker, Drawer, Form, Input, Select, message } from "antd";
import dayjs from "dayjs";
import { useEffect } from "react";
import { patch, post } from "../../api/crud-api";
import { getUrlForModel } from "../../api/endpoints";

// @ts-ignore
export default function DrawerForm({
  model,
  onClose,
  open,
  onSubmitSuccess,
  isEditing,
  editedItem,
  fetchData,
  consumers,
  ...props
}) {
  const [form] = Form.useForm();
  const consumer_id = Form.useWatch("consumer_id", form);

  const createData = useMutation({
    mutationFn: async (data) => await post(getUrlForModel(model), data),
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

  const consumerOptions: any = consumers?.map((i: any) => ({
    label: `${i.company_name} (${i.plan.name})`,
    value: i.id,
  }));

  const onFinish = async (formValues: any) => {
    const payload = {
      consumer_id: formValues.consumer_id,
      amount: +formValues.amount,
      billing_month: dayjs(formValues.billing_month).format("YYYY-MM"),
      reference: formValues.reference,
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

  const disabledBillingMonths = fetchData
    ?.filter((bill: any) => bill.consumer_id === consumer_id)
    ?.map((bill: any) =>
      dayjs(bill.billing_month).startOf("month").toISOString()
    );

  const isMonthDisabled = (current: dayjs.Dayjs) => {
    if (!current) return false;
    return disabledBillingMonths?.some((disabledMonth: string) =>
      current.isSame(dayjs(disabledMonth), "month")
    );
  };

  useEffect(() => {
    if (isEditing && editedItem) {
      form.setFieldsValue({
        consumer_id: editedItem.consumer_id,
        amount: editedItem.amount,
        billing_month: dayjs(editedItem.billing_month),
        reference: editedItem.reference,
      });
    } else {
      form.resetFields();
    }
  }, [isEditing, editedItem, form]);

  useEffect(() => {
    const selectedConsumer = consumers?.find((i) => i.id === consumer_id);
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
                optionB: { label?: string }
              ) =>
                (optionA?.label ?? "")
                  .toLowerCase()
                  .localeCompare((optionB?.label ?? "").toLowerCase())
              }
              options={consumerOptions}
            />
          </Form.Item>
          <Form.Item
            label="Billing Month"
            name="billing_month"
            rules={[{ required: true, message: "This field is required" }]}
          >
            <DatePicker
              style={{ width: "100%" }}
              picker="month"
              disabledDate={isMonthDisabled}
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
