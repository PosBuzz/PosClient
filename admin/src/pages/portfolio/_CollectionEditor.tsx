import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { deleteApi, get, patch, post } from "../../api/http";
import { useMessageStore } from "../../stores/messageStore";
import { describeError } from "./_errors";

export type FieldType = "text" | "textarea" | "number" | "switch" | "list";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  help?: string;
  rows?: number;
  step?: number;
  precision?: number;
}

interface CollectionEditorProps<T> {
  /** Human label used in the drawer title and toast messages. */
  itemLabel: string;
  endpoint: string;
  queryKey: string;
  fields: FieldDef[];
  columns: ColumnsType<T>;
  defaults?: Record<string, unknown>;
}

/**
 * One CRUD surface for every portfolio content collection. Each collection
 * supplies its own field list and table columns; the form, drawer, queries and
 * mutations are shared.
 */
export default function CollectionEditor<T extends { id: number }>({
  itemLabel,
  endpoint,
  queryKey,
  fields,
  columns,
  defaults = {},
}: CollectionEditorProps<T>) {
  const queryClient = useQueryClient();
  const { messageApi } = useMessageStore();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T>();

  const {
    data = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<T[]>({
    queryKey: [queryKey],
    queryFn: () => get(endpoint),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [queryKey] });

  const save = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      editing
        ? patch(`${endpoint}/${editing.id}`, values)
        : post(endpoint, values),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      form.resetFields();
      messageApi?.success(`${itemLabel} saved`);
    },
    onError: () => messageApi?.error(`Could not save the ${itemLabel}`),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteApi(`${endpoint}/${id}`),
    onSuccess: () => {
      invalidate();
      messageApi?.success(`${itemLabel} deleted`);
    },
    onError: () => messageApi?.error(`Could not delete the ${itemLabel}`),
  });

  const showForm = (record?: T) => {
    setEditing(record);
    setOpen(true);
    form.setFieldsValue(
      record
        ? {
            ...record,
            // Prisma returns Decimal columns as strings; the number inputs need
            // real numbers to render.
            ...Object.fromEntries(
              fields
                .filter((field) => field.type === "number")
                .map((field) => [
                  field.name,
                  Number((record as Record<string, unknown>)[field.name] ?? 0),
                ]),
            ),
          }
        : { is_published: true, sort_order: data.length + 1, ...defaults },
    );
  };

  const tableColumns: ColumnsType<T> = [
    ...columns,
    {
      title: "Published",
      dataIndex: "is_published",
      width: 110,
      render: (value: boolean) =>
        value ? <Tag color="green">Live</Tag> : <Tag>Hidden</Tag>,
    },
    {
      title: "Order",
      dataIndex: "sort_order",
      width: 80,
    },
    {
      title: "Actions",
      width: 110,
      render: (_: unknown, record: T) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => showForm(record)}
          />
          <Popconfirm
            title={`Delete this ${itemLabel.toLowerCase()}?`}
            onConfirm={() => remove.mutate(record.id)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      {isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={`Could not load ${itemLabel.toLowerCase()} content`}
          description={describeError(error)}
          action={
            <Button size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      )}

      <div style={{ marginBottom: 16, textAlign: "right" }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => showForm()}
        >
          Add {itemLabel}
        </Button>
      </div>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={tableColumns}
        scroll={{ x: 900 }}
        pagination={{ pageSize: 20 }}
      />

      <Drawer
        title={`${editing ? "Edit" : "Add"} ${itemLabel}`}
        open={open}
        onClose={() => setOpen(false)}
        width={560}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => save.mutate(values)}
        >
          {fields.map((field) => (
            <Form.Item
              key={field.name}
              name={field.name}
              label={field.label}
              extra={field.help}
              valuePropName={field.type === "switch" ? "checked" : "value"}
              rules={
                field.required
                  ? [{ required: true, message: "This field is required" }]
                  : undefined
              }
            >
              {field.type === "textarea" ? (
                <Input.TextArea rows={field.rows || 4} />
              ) : field.type === "number" ? (
                <InputNumber
                  style={{ width: "100%" }}
                  step={field.step}
                  precision={field.precision}
                />
              ) : field.type === "switch" ? (
                <Switch />
              ) : field.type === "list" ? (
                <Select
                  mode="tags"
                  tokenSeparators={["\n"]}
                  open={false}
                  suffixIcon={null}
                  placeholder="Type an entry and press Enter"
                />
              ) : (
                <Input />
              )}
            </Form.Item>
          ))}

          <Form.Item name="sort_order" label="Sort order">
            <InputNumber style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="is_published"
            label="Published"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            block
            loading={save.isPending}
          >
            Save {itemLabel}
          </Button>
        </Form>
      </Drawer>
    </>
  );
}
