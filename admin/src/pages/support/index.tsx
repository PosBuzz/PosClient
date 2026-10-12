import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import { endpoints } from "../../api/endpoints";
import { get, patch, post } from "../../api/http";
import PageTitle from "../../components/PageTitle";
import { AdminPermission } from "../../constants/adminPermissions";
import { useAuthStore } from "../../stores/authStore";
import { useMessageStore } from "../../stores/messageStore";
import { setPageTitle } from "../../utils/setPageTitle";
import { getErrorMessage } from "../../utils/api-error";

const { Text, Paragraph } = Typography;

type TicketStatus =
  "OPEN" | "IN_PROGRESS" | "WAITING_ON_CUSTOMER" | "RESOLVED" | "CLOSED";

interface TicketMessage {
  id: number;
  body: string;
  author_type: "CONSUMER" | "SUPER_ADMIN";
  created_at: string;
  consumer_user?: { id: number; name: string } | null;
  super_admin?: { id: number; name: string } | null;
}

interface Ticket {
  id: number;
  subject: string;
  category: string;
  priority: string;
  status: TicketStatus;
  last_reply_at: string;
  created_at: string;
  consumer?: {
    id: number;
    company_name: string;
    subdomain: string;
    email?: string;
    phone?: string | null;
    plan?: { id: number; name: string };
  };
  created_by?: { id: number; name: string; email: string };
  assigned_to?: { id: number; name: string } | null;
  messages?: TicketMessage[];
  _count?: { messages: number };
}

const statusMeta: Record<TicketStatus, { label: string; color: string }> = {
  OPEN: { label: "Open", color: "blue" },
  IN_PROGRESS: { label: "In Progress", color: "gold" },
  WAITING_ON_CUSTOMER: { label: "Waiting on Customer", color: "orange" },
  RESOLVED: { label: "Resolved", color: "green" },
  CLOSED: { label: "Closed", color: "default" },
};

const statusOptions = Object.entries(statusMeta).map(([value, meta]) => ({
  label: meta.label,
  value,
}));

const priorityColors: Record<string, string> = {
  LOW: "default",
  MEDIUM: "blue",
  HIGH: "orange",
  URGENT: "red",
};

const priorityOptions = ["LOW", "MEDIUM", "HIGH", "URGENT"].map((value) => ({
  label: value,
  value,
}));

const isClosed = (status: TicketStatus) =>
  status === "RESOLVED" || status === "CLOSED";

const categoryLabels: Record<string, string> = {
  BILLING: "Billing & Subscription",
  TECHNICAL: "Technical Issue",
  FEATURE_REQUEST: "Feature Request",
  ACCOUNT: "Account",
  OTHER: "Other",
};

const title = "Support Tickets";

const Support = () => {
  const queryClient = useQueryClient();
  const { messageApi } = useMessageStore();
  const { user } = useAuthStore();
  const [replyForm] = Form.useForm();

  const [status, setStatus] = useState<TicketStatus>();
  const [priority, setPriority] = useState<string>();
  const [consumerId, setConsumerId] = useState<number>();
  const [search, setSearch] = useState("");
  const [openTicketId, setOpenTicketId] = useState<number>();

  const listQuery = new URLSearchParams({
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(consumerId ? { consumer_id: String(consumerId) } : {}),
    ...(search ? { search } : {}),
  });

  const {
    data: tickets = [],
    isLoading,
    refetch,
  } = useQuery<Ticket[]>({
    queryKey: ["support-tickets", listQuery.toString()],
    queryFn: () => get(`${endpoints.supportTickets}?${listQuery}`),
  });

  const { data: stats } = useQuery({
    queryKey: ["support-ticket-stats"],
    queryFn: () => get(endpoints.supportTicketStats),
  });

  const { data: ticket } = useQuery<Ticket>({
    queryKey: ["support-ticket", openTicketId],
    queryFn: () => get(endpoints.supportTicket(openTicketId as number)),
    enabled: !!openTicketId,
  });

  // The consumer list drives the tenant filter; only admins allowed to see
  // consumers get it, everyone else filters by subject/status instead.
  const canListConsumers = user?.permissions?.includes(
    AdminPermission.show_consumers,
  );
  const { data: consumers } = useQuery({
    queryKey: ["all-Consumer"],
    queryFn: () => get(endpoints.consumer),
    enabled: !!canListConsumers,
  });

  const invalidate = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["support-ticket"] });
    queryClient.invalidateQueries({ queryKey: ["support-ticket-stats"] });
  };

  const reply = useMutation({
    mutationFn: (values: { body: string; status?: TicketStatus }) =>
      post(endpoints.supportTicketMessages(openTicketId as number), values),
    onSuccess: () => {
      invalidate();
      replyForm.resetFields();
      messageApi?.success("Reply sent");
    },
    onError: (error) =>
      messageApi?.error(getErrorMessage(error, "Could not send the reply")),
  });

  const update = useMutation({
    mutationFn: (values: {
      id: number;
      status?: TicketStatus;
      priority?: string;
      assigned_to_id?: number | null;
    }) => {
      const { id, ...rest } = values;
      return patch(endpoints.supportTicket(id), rest);
    },
    onSuccess: () => {
      invalidate();
      messageApi?.success("Ticket updated");
    },
    onError: (error) =>
      messageApi?.error(getErrorMessage(error, "Could not update the ticket")),
  });

  return (
    <>
      {setPageTitle(title)}
      <PageTitle
        title={title}
        breadcrumbs={[{ title: "Dashboard", href: "/" }, { title }]}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Open tickets" value={stats?.open ?? 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Unassigned" value={stats?.unassigned ?? 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Urgent"
              value={stats?.urgent ?? 0}
              valueStyle={{ color: stats?.urgent ? "#cf1322" : undefined }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="All tickets" value={stats?.total ?? 0} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Select
            placeholder="All statuses"
            allowClear
            style={{ width: "100%" }}
            options={statusOptions}
            value={status}
            onChange={setStatus}
          />
        </Col>
        <Col xs={24} md={5}>
          <Select
            placeholder="All priorities"
            allowClear
            style={{ width: "100%" }}
            options={priorityOptions}
            value={priority}
            onChange={setPriority}
          />
        </Col>
        {canListConsumers && (
          <Col xs={24} md={6}>
            <Select
              placeholder="All consumers"
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: "100%" }}
              value={consumerId}
              onChange={setConsumerId}
              options={(consumers || []).map((c: any) => ({
                label: c.company_name,
                value: c.id,
              }))}
            />
          </Col>
        )}
        <Col xs={24} md={6}>
          <Input.Search
            placeholder="Search by subject"
            allowClear
            onSearch={setSearch}
          />
        </Col>
      </Row>

      <Table
        loading={isLoading}
        dataSource={tickets}
        rowKey="id"
        scroll={{ x: 900 }}
        pagination={{ pageSize: 20 }}
        columns={[
          { title: "#", dataIndex: "id", width: 70 },
          {
            title: "Subject",
            dataIndex: "subject",
            render: (value: string, record: Ticket) => (
              <Button type="link" onClick={() => setOpenTicketId(record.id)}>
                {value}
              </Button>
            ),
          },
          {
            title: "Consumer",
            render: (_: unknown, record: Ticket) => (
              <>
                <Text strong>{record.consumer?.company_name}</Text>
                <br />
                <Text type="secondary">{record.consumer?.subdomain}</Text>
              </>
            ),
          },
          {
            title: "Category",
            dataIndex: "category",
            render: (value: string) => categoryLabels[value] || value,
          },
          {
            title: "Priority",
            dataIndex: "priority",
            render: (value: string) => (
              <Tag color={priorityColors[value]}>{value}</Tag>
            ),
          },
          {
            title: "Status",
            dataIndex: "status",
            render: (value: TicketStatus) => (
              <Tag color={statusMeta[value].color}>
                {statusMeta[value].label}
              </Tag>
            ),
          },
          {
            title: "Assignee",
            render: (_: unknown, record: Ticket) =>
              record.assigned_to?.name || (
                <Text type="secondary">Unassigned</Text>
              ),
          },
          {
            title: "Last activity",
            dataIndex: "last_reply_at",
            render: (value: string) =>
              dayjs(value).format("DD MMM YYYY, hh:mm A"),
          },
        ]}
      />

      <Drawer
        title={ticket ? `#${ticket.id} · ${ticket.subject}` : "Ticket"}
        open={!!openTicketId}
        onClose={() => setOpenTicketId(undefined)}
        width={680}
        destroyOnClose
      >
        {ticket && (
          <>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="Consumer">
                {ticket.consumer?.company_name} ({ticket.consumer?.subdomain})
              </Descriptions.Item>
              <Descriptions.Item label="Raised by">
                {ticket.created_by?.name} · {ticket.created_by?.email}
              </Descriptions.Item>
              <Descriptions.Item label="Plan">
                {ticket.consumer?.plan?.name || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Category">
                {categoryLabels[ticket.category] || ticket.category}
              </Descriptions.Item>
              <Descriptions.Item label="Opened">
                {dayjs(ticket.created_at).format("DD MMM YYYY, hh:mm A")}
              </Descriptions.Item>
            </Descriptions>

            <Space wrap align="end" style={{ margin: "16px 0" }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Status
                </Text>
                <Select
                  style={{ minWidth: 200, display: "block" }}
                  value={ticket.status}
                  options={statusOptions}
                  onChange={(value) =>
                    update.mutate({ id: ticket.id, status: value })
                  }
                />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Priority
                </Text>
                <Select
                  style={{ minWidth: 140, display: "block" }}
                  value={ticket.priority}
                  options={priorityOptions}
                  onChange={(value) =>
                    update.mutate({ id: ticket.id, priority: value })
                  }
                />
              </div>
              {ticket.assigned_to?.id === user?.id ? (
                <Button
                  onClick={() =>
                    update.mutate({ id: ticket.id, assigned_to_id: null })
                  }
                >
                  Unassign me
                </Button>
              ) : (
                <Button
                  onClick={() =>
                    update.mutate({
                      id: ticket.id,
                      assigned_to_id: user?.id,
                    })
                  }
                >
                  Assign to me
                </Button>
              )}
              <Text type="secondary">
                {ticket.assigned_to
                  ? `Assigned to ${ticket.assigned_to.name}`
                  : "Unassigned"}
              </Text>
            </Space>

            <Space direction="vertical" style={{ width: "100%" }} size={12}>
              {(ticket.messages || []).map((message) => {
                const fromSupport = message.author_type === "SUPER_ADMIN";
                return (
                  <Card
                    key={message.id}
                    size="small"
                    style={{
                      marginLeft: fromSupport ? 32 : 0,
                      marginRight: fromSupport ? 0 : 32,
                    }}
                  >
                    <Text strong>
                      {fromSupport
                        ? `${message.super_admin?.name || "Support"} (Support)`
                        : `${message.consumer_user?.name || "Customer"} (${ticket.consumer?.company_name})`}
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
              onFinish={(values) => reply.mutate(values)}
            >
              <Form.Item
                name="body"
                rules={[{ required: true, message: "Write a reply first" }]}
              >
                <Input.TextArea
                  rows={4}
                  maxLength={5000}
                  placeholder="Reply to the customer…"
                />
              </Form.Item>
              <Space wrap>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={reply.isPending}
                >
                  Send reply
                </Button>
                <Text type="secondary">
                  {isClosed(ticket.status)
                    ? `Replying leaves the ticket ${statusMeta[ticket.status].label}.`
                    : "Replying moves the ticket to Waiting on Customer. Use the status control above for anything else."}
                </Text>
              </Space>
            </Form>
          </>
        )}
      </Drawer>
    </>
  );
};

export default Support;
