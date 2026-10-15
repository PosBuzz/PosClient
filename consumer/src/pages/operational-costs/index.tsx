import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Form,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Typography,
} from "antd";
import InputNumber from "../../components/NumberInput";
import dayjs, { Dayjs } from "dayjs";
import { useState } from "react";
import {
  OperationalCost,
  OperationalCostInput,
  operationalCostsApi,
} from "../../api/operational-costs-api";
import { Money, takaPrefix } from "../../components/Currency";
import PageTitle from "../../components/PageTitle";
import { queryKeys } from "../../constants/queryKeys";
import { useAuthStore } from "../../stores/authStore";
import { useMessageStore } from "../../stores/messageStore";
import { setPageTitle } from "../../utils/setPageTitle";
import { getErrorMessage } from "../../utils/api-error";

const key = "operational-costs";

export default function OperationalCosts() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { messageApi } = useMessageStore();
  const [form] = Form.useForm();
  const [month, setMonth] = useState<Dayjs>(dayjs());
  const [branchId, setBranchId] = useState<number>();
  const [editing, setEditing] = useState<OperationalCost>();
  const [open, setOpen] = useState(false);
  const from = month.startOf("month").format("YYYY-MM-DD");
  const to = month.endOf("month").format("YYYY-MM-DD");

  const { data = [], isLoading } = useQuery({
    queryKey: [key, from, to, branchId],
    queryFn: () => operationalCostsApi.list({ from, to, branch_id: branchId }),
  });
  const save = useMutation({
    mutationFn: (values: OperationalCostInput) =>
      editing
        ? operationalCostsApi.update(editing.id, values)
        : operationalCostsApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [key] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.eod] });
      setOpen(false);
      form.resetFields();
      messageApi?.success("Operational cost saved");
    },
    onError: (error) =>
      messageApi?.error(
        getErrorMessage(error, "Could not save operational cost"),
      ),
  });
  const remove = useMutation({
    mutationFn: operationalCostsApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [key] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.eod] });
      messageApi?.success("Operational cost deleted");
    },
  });
  const showForm = (cost?: OperationalCost) => {
    setEditing(cost);
    setOpen(true);
    form.setFieldsValue(
      cost
        ? {
            ...cost,
            amount: Number(cost.amount),
            incurred_on: dayjs(cost.incurred_on),
          }
        : { incurred_on: dayjs(), branch_id: branchId },
    );
  };
  const total = data.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <>
      {setPageTitle("Operational Costs")}
      <PageTitle
        title="Operational Costs"
        breadcrumbs={[
          { title: "Home", href: "/" },
          { title: "Operational Costs" },
        ]}
        rightSection={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => showForm()}
          >
            Declare cost
          </Button>
        }
      />
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} md={16}>
          <Card>
            <Space wrap>
              <DatePicker
                picker="month"
                value={month}
                onChange={(value) => value && setMonth(value)}
                allowClear={false}
              />
              <Select
                placeholder="All branches"
                allowClear
                value={branchId}
                onChange={setBranchId}
                style={{ minWidth: 200 }}
                options={(user?.branches || []).map((branch) => ({
                  label: branch.name,
                  value: branch.id,
                }))}
              />
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Total operational cost"
              value={total}
              precision={2}
              prefix={takaPrefix}
            />
          </Card>
        </Col>
      </Row>
      <Card>
        <Table
          loading={isLoading}
          dataSource={data}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          columns={[
            {
              title: "Date",
              dataIndex: "incurred_on",
              render: (value: string) => dayjs(value).format("DD MMM YYYY"),
            },
            {
              title: "Cost name",
              dataIndex: "name",
              render: (value: string, record: OperationalCost) => (
                <>
                  <Typography.Text strong>{value}</Typography.Text>
                  {record.notes && (
                    <>
                      <br />
                      <Typography.Text type="secondary">
                        {record.notes}
                      </Typography.Text>
                    </>
                  )}
                </>
              ),
            },
            {
              title: "Branch",
              render: (_: unknown, record: OperationalCost) =>
                record.branch?.name || "All business",
            },
            {
              title: "Amount",
              dataIndex: "amount",
              align: "right" as const,
              render: (value: number) => <Money value={value} />,
            },
            {
              title: "Actions",
              width: 110,
              render: (_: unknown, record: OperationalCost) => (
                <Space>
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => showForm(record)}
                  />
                  <Popconfirm
                    title="Delete this cost?"
                    onConfirm={() => remove.mutate(record.id)}
                  >
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>
      <Drawer
        title={editing ? "Edit operational cost" : "Declare operational cost"}
        open={open}
        onClose={() => setOpen(false)}
        width={480}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) =>
            save.mutate({
              ...values,
              incurred_on: values.incurred_on.format("YYYY-MM-DD"),
            })
          }
        >
          <Form.Item name="name" label="Cost name" rules={[{ required: true }]}>
            <Input
              placeholder="Rent, electricity, transport…"
              maxLength={120}
            />
          </Form.Item>
          <Form.Item name="amount" label="Amount" rules={[{ required: true }]}>
            <InputNumber
              min={0.01}
              precision={2}
              prefix={takaPrefix}
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Form.Item
            name="incurred_on"
            label="Date"
            rules={[{ required: true }]}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="branch_id" label="Branch">
            <Select
              allowClear
              placeholder="Applies to the whole business"
              options={(user?.branches || []).map((branch) => ({
                label: branch.name,
                value: branch.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={save.isPending}
          >
            Save cost
          </Button>
        </Form>
      </Drawer>
    </>
  );
}
