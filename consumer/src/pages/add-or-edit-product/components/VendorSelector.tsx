import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { getErrorMessage } from "../../../utils/api-error";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Form,
  Input,
  List,
  Modal,
  Select,
  Space,
  Tooltip,
  Typography,
} from "antd";
import { useMemo, useState } from "react";
import { inventoryApi } from "../../../api/inventory-api";
import { queryKeys, queryStaleTimeMap } from "../../../constants/queryKeys";
import { useMessageStore } from "../../../stores/messageStore";

const { Text } = Typography;

interface VendorOption {
  id: number;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  address?: string;
}

interface VendorFormValues {
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  address?: string;
}

interface VendorSelectorProps {
  value?: number;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  size?: "small" | "middle" | "large";
  disabled?: boolean;
  status?: "error" | "warning";
  allowClear?: boolean;
  showManageButton?: boolean;
}

export default function VendorSelector({
  value,
  onChange,
  placeholder,
  size = "middle",
  disabled,
  status,
  allowClear = true,
  showManageButton = true,
}: VendorSelectorProps) {
  const [manageOpen, setManageOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VendorOption | null>(null);
  const [form] = Form.useForm<VendorFormValues>();
  const { messageApi } = useMessageStore();
  const queryClient = useQueryClient();

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: [queryKeys.vendors],
    queryFn: inventoryApi.getVendors,
    staleTime: queryStaleTimeMap[queryKeys.vendors],
  });

  const options = useMemo(
    () =>
      vendors.map((item) => ({
        value: item.id,
        label: item.name,
      })),
    [vendors],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [queryKeys.vendors] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: VendorFormValues) =>
      inventoryApi.createVendor(payload),
    onSuccess: (created) => {
      invalidate();
      messageApi?.success("Vendor created successfully");
      setCreateOpen(false);
      form.resetFields();
      onChange(created.id);
    },
    onError: (error: unknown) => {
      messageApi?.error(getErrorMessage(error, "Failed to create vendor"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: VendorFormValues }) =>
      inventoryApi.updateVendor(id, payload),
    onSuccess: () => {
      invalidate();
      messageApi?.success("Vendor updated successfully");
      setEditingItem(null);
      form.resetFields();
    },
    onError: (error: unknown) => {
      messageApi?.error(getErrorMessage(error, "Failed to update vendor"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => inventoryApi.deleteVendor(id),
    onSuccess: (_, deletedId) => {
      invalidate();
      messageApi?.success("Vendor deleted successfully");
      if (value === deletedId) {
        onChange(undefined);
      }
    },
    onError: (error: unknown) => {
      messageApi?.error(getErrorMessage(error, "Failed to delete vendor"));
    },
  });

  const toVendorPayload = (values: VendorFormValues): VendorFormValues => {
    return {
      name: values.name.trim(),
      contact: values.contact?.trim() || undefined,
      phone: values.phone?.trim() || undefined,
      email: values.email?.trim() || undefined,
      address: values.address?.trim() || undefined,
    };
  };

  const onManageCreate = (values: VendorFormValues) => {
    createMutation.mutate(toVendorPayload(values));
  };

  const onManageUpdate = (values: VendorFormValues) => {
    if (!editingItem) {
      return;
    }
    updateMutation.mutate({
      id: editingItem.id,
      payload: toVendorPayload(values),
    });
  };

  const formatVendorMeta = (item: VendorOption) => {
    const meta = [item.contact, item.phone, item.email, item.address]
      .filter(Boolean)
      .join(" | ");
    return meta || "No additional info";
  };

  return (
    <>
      <Space.Compact style={{ width: "100%", minWidth: 0 }}>
        <Select
          allowClear={allowClear}
          showSearch
          size={size}
          status={status}
          value={typeof value === "number" ? value : undefined}
          loading={isLoading}
          options={options}
          disabled={disabled}
          placeholder={placeholder || "Select vendor"}
          onChange={(nextValue) => onChange(nextValue)}
          style={{ width: "100%", minWidth: 0 }}
          optionFilterProp="label"
        />
        {showManageButton && (
          <Tooltip title="Manage vendors">
            <Button
              size={size}
              icon={<SettingOutlined />}
              onClick={() => setManageOpen(true)}
              disabled={disabled}
            />
          </Tooltip>
        )}
      </Space.Compact>

      <Modal
        title="Manage Vendors"
        open={manageOpen}
        onCancel={() => {
          setManageOpen(false);
          setEditingItem(null);
        }}
        footer={null}
        width={640}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 12,
          }}
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            Add Vendor
          </Button>
        </div>

        <List
          bordered
          dataSource={vendors}
          locale={{ emptyText: "No vendors found" }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="edit"
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditingItem(item);
                    form.setFieldsValue({
                      name: item.name,
                      contact: item.contact,
                      phone: item.phone,
                      email: item.email,
                      address: item.address,
                    });
                  }}
                />,
                <Button
                  key="delete"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  loading={deleteMutation.isPending}
                  onClick={() => {
                    Modal.confirm({
                      title: "Delete Vendor",
                      content:
                        "Are you sure you want to delete " + item.name + "?",
                      okType: "danger",
                      onOk: () => deleteMutation.mutateAsync(item.id),
                    });
                  }}
                />,
              ]}
            >
              <Space direction="vertical" size={0}>
                <Text>{item.name}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {formatVendorMeta(item)}
                </Text>
              </Space>
            </List.Item>
          )}
        />

        <Modal
          title="Add Vendor"
          open={createOpen}
          onCancel={() => {
            setCreateOpen(false);
            form.resetFields();
          }}
          onOk={() => form.submit()}
          confirmLoading={createMutation.isPending}
          destroyOnHidden
        >
          <Form form={form} layout="vertical" onFinish={onManageCreate}>
            <Form.Item
              name="name"
              label="Vendor Name"
              rules={[
                {
                  required: true,
                  message: "Please enter vendor name",
                },
              ]}
            >
              <Input autoFocus maxLength={100} />
            </Form.Item>

            <Form.Item name="contact" label="Contact Person">
              <Input maxLength={100} placeholder="Enter contact person" />
            </Form.Item>

            <Form.Item name="phone" label="Phone">
              <Input maxLength={30} placeholder="Enter phone number" />
            </Form.Item>

            <Form.Item
              name="email"
              label="Email"
              rules={[{ type: "email", message: "Please enter a valid email" }]}
            >
              <Input maxLength={120} placeholder="Enter email address" />
            </Form.Item>

            <Form.Item name="address" label="Address">
              <Input.TextArea
                rows={3}
                maxLength={300}
                placeholder="Enter address"
              />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="Edit Vendor"
          open={Boolean(editingItem)}
          onCancel={() => {
            setEditingItem(null);
            form.resetFields();
          }}
          onOk={() => form.submit()}
          confirmLoading={updateMutation.isPending}
          destroyOnHidden
        >
          <Form form={form} layout="vertical" onFinish={onManageUpdate}>
            <Form.Item
              name="name"
              label="Vendor Name"
              rules={[
                {
                  required: true,
                  message: "Please enter vendor name",
                },
              ]}
            >
              <Input autoFocus maxLength={100} />
            </Form.Item>

            <Form.Item name="contact" label="Contact Person">
              <Input maxLength={100} placeholder="Enter contact person" />
            </Form.Item>

            <Form.Item name="phone" label="Phone">
              <Input maxLength={30} placeholder="Enter phone number" />
            </Form.Item>

            <Form.Item
              name="email"
              label="Email"
              rules={[{ type: "email", message: "Please enter a valid email" }]}
            >
              <Input maxLength={120} placeholder="Enter email address" />
            </Form.Item>

            <Form.Item name="address" label="Address">
              <Input.TextArea
                rows={3}
                maxLength={300}
                placeholder="Enter address"
              />
            </Form.Item>
          </Form>
        </Modal>
      </Modal>
    </>
  );
}
