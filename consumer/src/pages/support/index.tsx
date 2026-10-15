import { PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import {
  SupportTicket,
  SupportTicketInput,
  SupportTicketStatus,
  supportApi,
} from "../../api/support-api";
import PageTitle from "../../components/PageTitle";
import { queryKeys } from "../../constants/queryKeys";
import { useMessageStore } from "../../stores/messageStore";
import { setPageTitle } from "../../utils/setPageTitle";
import { getErrorMessage } from "../../utils/api-error";

const { Text, Paragraph } = Typography;

const statusMeta: Record<
  SupportTicketStatus,
  { label: string; color: string }
> = {
  OPEN: { label: "Open", color: "blue" },
  IN_PROGRESS: { label: "In Progress", color: "gold" },
  WAITING_ON_CUSTOMER: { label: "Waiting on You", color: "orange" },
  RESOLVED: { label: "Resolved", color: "green" },
  CLOSED: { label: "Closed", color: "default" },
};

const priorityMeta: Record<string, string> = {
  LOW: "default",
  MEDIUM: "blue",
  HIGH: "orange",
  URGENT: "red",
};

const categoryOptions = [
  { label: "Billing & Subscription", value: "BILLING" },
  { label: "Technical Issue", value: "TECHNICAL" },
  { label: "Feature Request", value: "FEATURE_REQUEST" },
  { label: "Account", value: "ACCOUNT" },
  { label: "Other", value: "OTHER" },
];

const priorityOptions = [
  { label: "Low", value: "LOW" },
  { label: "Medium", value: "MEDIUM" },
  { label: "High", value: "HIGH" },
  { label: "Urgent", value: "URGENT" },
];

const isClosed = (status: SupportTicketStatus) =>
  status === "CLOSED" || status === "RESOLVED";

export default function Support() {
  const queryClient = useQueryClient();
  const { messageApi } = useMessageStore();
  const [createForm] = Form.useForm();
  const [replyForm] = Form.useForm();
  const [status, setStatus] = useState<SupportTicketStatus>();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [openTicketId, setOpenTicketId] = useState<number>();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: [queryKeys.supportTickets, status, search],
    queryFn: () => supportApi.list({ status, search: search || undefined }),
  });

  const { data: ticket } = useQuery({
    queryKey: [queryKeys.supportTicket, openTicketId],
    queryFn: () => supportApi.detail(openTicketId as number),
    enabled: !!openTicketId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [queryKeys.supportTickets] });
    queryClient.invalidateQueries({ queryKey: [queryKeys.supportTicket] });
  };

  const create = useMutation({
    mutationFn: (values: SupportTicketInput) => supportApi.create(values),
    onSuccess: (created) => {
      invalidate();
      setCreateOpen(false);
      createForm.resetFields();
      setOpenTicketId(created.id);
      messageApi?.success("Support ticket created");
    },
    onError: (error) =>
      messageApi?.error(getErrorMessage(error, "Could not create the ticket")),
  });

  const reply = useMutation({
    mutationFn: (body: string) =>
      supportApi.reply(openTicketId as number, body),
    onSuccess: () => {
      invalidate();
      replyForm.resetFields();
    },
    onError: (error) =>
      messageApi?.error(getErrorMessage(error, "Could not send the reply")),
  });

  const close = useMutation({
    mutationFn: (id: number) => supportApi.close(id),
    onSuccess: () => {
      invalidate();
      messageApi?.success("Ticket closed");
    },
  });

  const reopen = useMutation({
    mutationFn: (id: number) => supportApi.reopen(id),
    onSuccess: () => {
      invalidate();
      messageApi?.success("Ticket reopened");
    },
  });

  return (
    <>
      {setPageTitle("Support")}
      <PageTitle
        title="Support"
        breadcrumbs={[{ title: "Home", href: "/" }, { title: "Support" }]}
        rightSection={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              createForm.resetFields();
              setCreateOpen(true);
            }}
          >
            New ticket
          </Button>
        }
      />

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="All statuses"
            allowClear
            value={status}
            onChange={setStatus}
            style={{ minWidth: 200 }}
            options={Object.entries(statusMeta).map(([value, meta]) => ({
              label: meta.label,
              value,
            }))}
          />
          <Input.Search
            placeholder="Search by subject"
            allowClear
            onSearch={setSearch}
            style={{ minWidth: 240 }}
          />
        </Space>
      </Card>

      <Card>
        <Table
          loading={isLoading}
          dataSource={tickets}
          rowKey="id"
          pagination={{ pageSize: 20 }}
          columns={[
            { title: "#", dataIndex: "id", width: 70 },
            {
              title: "Subject",
              dataIndex: "subject",
              render: (value: string, record: SupportTicket) => (
                <Button type="link" onClick={() => setOpenTicketId(record.id)}>
                  {value}
                </Button>
              ),
            },
            {
              title: "Category",
              dataIndex: "category",
              render: (value: string) =>
                categoryOptions.find((option) => option.value === value)
                  ?.label || value,
            },
            {
              title: "Priority",
              dataIndex: "priority",
              render: (value: string) => (
                <Tag color={priorityMeta[value]}>{value}</Tag>
              ),
            },
            {
              title: "Status",
              dataIndex: "status",
              render: (value: SupportTicketStatus) => (
                <Tag color={statusMeta[value].color}>
                  {statusMeta[value].label}
                </Tag>
              ),
            },
            {
              title: "Replies",
              render: (_: unknown, record: SupportTicket) =>
                record._count?.messages ?? 0,
            },
            {
              title: "Last activity",
              dataIndex: "last_reply_at",
              render: (value: string) =>
                dayjs(value).format("DD MMM YYYY, hh:mm A"),
            },
          ]}
        />
      </Card>

      <Drawer
        title="Raise a support ticket"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        width={480}
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{ category: "TECHNICAL", priority: "MEDIUM" }}
          onFinish={(values) => create.mutate(values)}
        >
          <Form.Item
            name="subject"
            label="Subject"
            rules={[{ required: true }]}
          >
            <Input placeholder="Short summary of the issue" maxLength={150} />
          </Form.Item>
          <Form.Item
            name="category"
            label="Category"
            rules={[{ required: true }]}
          >
            <Select options={categoryOptions} />
          </Form.Item>
          <Form.Item name="priority" label="Priority">
            <Select options={priorityOptions} />
          </Form.Item>
          <Form.Item
            name="message"
            label="Describe the problem"
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={6} maxLength={5000} showCount />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={create.isPending}
          >
            Submit ticket
          </Button>
        </Form>
      </Drawer>

      <Drawer
        title={ticket ? `#${ticket.id} · ${ticket.subject}` : "Ticket"}
        open={!!openTicketId}
        onClose={() => setOpenTicketId(undefined)}
        width={620}
        destroyOnClose
        extra={
          ticket &&
          (isClosed(ticket.status) ? (
            <Button onClick={() => reopen.mutate(ticket.id)}>Reopen</Button>
          ) : (
            <Popconfirm
              title="Close this ticket?"
              onConfirm={() => close.mutate(ticket.id)}
            >
              <Button danger>Close ticket</Button>
            </Popconfirm>
          ))
        }
      >
        {ticket && (
          <>
            <Space wrap style={{ marginBottom: 16 }}>
              <Tag color={statusMeta[ticket.status].color}>
                {statusMeta[ticket.status].label}
              </Tag>
              <Tag color={priorityMeta[ticket.priority]}>{ticket.priority}</Tag>
              <Text type="secondary">
                Opened {dayjs(ticket.created_at).format("DD MMM YYYY")} by{" "}
                {ticket.created_by?.name}
              </Text>
              {ticket.assigned_to && (
                <Text type="secondary">
                  Handled by {ticket.assigned_to.name}
                </Text>
              )}
            </Space>

            <Space direction="vertical" style={{ width: "100%" }} size={12}>
              {(ticket.messages || []).map((message) => {
                const fromSupport = message.author_type === "SUPER_ADMIN";
                return (
                  <Card
                    key={message.id}
                    size="small"
                    style={{
                      marginLeft: fromSupport ? 0 : 32,
                      marginRight: fromSupport ? 32 : 0,
                    }}
                  >
                    <Text strong>
                      {fromSupport
                        ? `${message.super_admin?.name || "Support"} (PosBuzz Support)`
                        : message.consumer_user?.name || "You"}
                    </Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(message.created_at).format("DD MMM YYYY, hh:mm A")}
                    </Text>
                    <Paragraph style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                      {message.body}
                    </Paragraph>
                  </Card>
                );
              })}
              {!ticket.messages?.length && <Empty description="No messages" />}
            </Space>

            <Form
              form={replyForm}
              layout="vertical"
              style={{ marginTop: 16 }}
              onFinish={(values) => reply.mutate(values.body)}
            >
              <Form.Item name="body" rules={[{ required: true }]}>
                <Input.TextArea
                  rows={4}
                  maxLength={5000}
                  placeholder="Write a reply…"
                />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={reply.isPending}
                block
              >
                Send reply
              </Button>
            </Form>
          </>
        )}
      </Drawer>
    </>
  );
}
