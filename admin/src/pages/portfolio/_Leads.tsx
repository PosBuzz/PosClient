import { DeleteOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Input,
  Popconfirm,
  Row,
  Select,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import { endpoints } from "../../api/endpoints";
import { deleteApi, get, patch } from "../../api/http";
import { useMessageStore } from "../../stores/messageStore";
import { getErrorMessage } from "../../utils/api-error";

const { Text, Paragraph } = Typography;

type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "WON" | "LOST";

interface Lead {
  id: number;
  type: "CONTACT" | "DEMO";
  status: LeadStatus;
  name: string;
  email: string;
  phone?: string | null;
  business_name?: string | null;
  industry?: string | null;
  locations?: string | null;
  message?: string | null;
  source_page?: string | null;
  notes?: string | null;
  created_at: string;
}

const statusColors: Record<LeadStatus, string> = {
  NEW: "blue",
  CONTACTED: "gold",
  QUALIFIED: "purple",
  WON: "green",
  LOST: "default",
};

const statusOptions = Object.keys(statusColors).map((value) => ({
  label: value,
  value,
}));

export default function Leads() {
  const queryClient = useQueryClient();
  const { messageApi } = useMessageStore();
  const [status, setStatus] = useState<LeadStatus>();
  const [type, setType] = useState<"CONTACT" | "DEMO">();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Lead>();
  const [notes, setNotes] = useState("");

  const query = new URLSearchParams({
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
    ...(search ? { search } : {}),
  });

  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["portfolio-leads", query.toString()],
    queryFn: () => get(`${endpoints.portfolioLeads}?${query}`),
  });

  const { data: stats } = useQuery({
    queryKey: ["portfolio-lead-stats"],
    queryFn: () => get(endpoints.portfolioLeadStats),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["portfolio-leads"] });
    queryClient.invalidateQueries({ queryKey: ["portfolio-lead-stats"] });
  };

  const update = useMutation({
    mutationFn: (values: { id: number; status?: LeadStatus; notes?: string }) =>
      patch(`${endpoints.portfolioLeads}/${values.id}`, {
        ...(values.status ? { status: values.status } : {}),
        ...(values.notes !== undefined ? { notes: values.notes } : {}),
      }),
    onSuccess: () => {
      invalidate();
      messageApi?.success("Lead updated");
    },
    onError: (error) =>
      messageApi?.error(getErrorMessage(error, "Could not update the lead")),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteApi(`${endpoints.portfolioLeads}/${id}`),
    onSuccess: () => {
      invalidate();
      setSelected(undefined);
      messageApi?.success("Lead deleted");
    },
  });

  return (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="New leads" value={stats?.new ?? 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Last 7 days" value={stats?.last_7_days ?? 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Won" value={stats?.won ?? 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="All leads" value={stats?.total ?? 0} />
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
        <Col xs={24} md={6}>
          <Select
            placeholder="All types"
            allowClear
            style={{ width: "100%" }}
            options={[
              { label: "Contact form", value: "CONTACT" },
              { label: "Demo request", value: "DEMO" },
            ]}
            value={type}
            onChange={setType}
          />
        </Col>
        <Col xs={24} md={8}>
          <Input.Search
            placeholder="Search name, email or business"
            allowClear
            onSearch={setSearch}
          />
        </Col>
      </Row>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={leads}
        scroll={{ x: 900 }}
        pagination={{ pageSize: 20 }}
        columns={[
          {
            title: "Received",
            dataIndex: "created_at",
            width: 170,
            render: (value: string) =>
              dayjs(value).format("DD MMM YYYY, hh:mm A"),
          },
          {
            title: "Name",
            dataIndex: "name",
            render: (value: string, record: Lead) => (
              <Button
                type="link"
                onClick={() => {
                  setSelected(record);
                  setNotes(record.notes || "");
                }}
              >
                {value}
              </Button>
            ),
          },
          { title: "Email", dataIndex: "email" },
          {
            title: "Business",
            dataIndex: "business_name",
            render: (value: string) => value || "—",
          },
          {
            title: "Type",
            dataIndex: "type",
            width: 110,
            render: (value: string) => (
              <Tag color={value === "DEMO" ? "geekblue" : "cyan"}>{value}</Tag>
            ),
          },
          {
            title: "Status",
            dataIndex: "status",
            width: 150,
            render: (value: LeadStatus, record: Lead) => (
              <Select
                size="small"
                value={value}
                style={{ width: 130 }}
                options={statusOptions}
                onChange={(next) =>
                  update.mutate({ id: record.id, status: next })
                }
              />
            ),
          },
          {
            title: "",
            width: 60,
            render: (_: unknown, record: Lead) => (
              <Popconfirm
                title="Delete this lead?"
                onConfirm={() => remove.mutate(record.id)}
              >
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            ),
          },
        ]}
      />

      <Drawer
        title={selected ? `Lead from ${selected.name}` : "Lead"}
        open={!!selected}
        onClose={() => setSelected(undefined)}
        width={520}
        destroyOnClose
      >
        {selected && (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Type">
                <Tag color={selected.type === "DEMO" ? "geekblue" : "cyan"}>
                  {selected.type}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                <a href={`mailto:${selected.email}`}>{selected.email}</a>
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                {selected.phone || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Business">
                {selected.business_name || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Industry">
                {selected.industry || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Outlets">
                {selected.locations || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Source page">
                {selected.source_page || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Received">
                {dayjs(selected.created_at).format("DD MMM YYYY, hh:mm A")}
              </Descriptions.Item>
            </Descriptions>

            {selected.message && (
              <Card size="small" title="Message" style={{ marginTop: 16 }}>
                <Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
                  {selected.message}
                </Paragraph>
              </Card>
            )}

            <div style={{ marginTop: 16 }}>
              <Text strong>Internal notes</Text>
              <Input.TextArea
                rows={4}
                value={notes}
                maxLength={4000}
                style={{ marginTop: 8 }}
                onChange={(event) => setNotes(event.target.value)}
              />
              <Button
                type="primary"
                style={{ marginTop: 8 }}
                loading={update.isPending}
                onClick={() => update.mutate({ id: selected.id, notes })}
              >
                Save notes
              </Button>
            </div>
          </>
        )}
      </Drawer>
    </>
  );
}
