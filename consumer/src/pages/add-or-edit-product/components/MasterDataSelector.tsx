import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Form,
  Input,
  type InputRef,
  List,
  Modal,
  Select,
  Space,
  Tooltip,
  Typography,
} from "antd";
import { type RefObject, useMemo, useRef, useState } from "react";
import { productApi } from "../../../api/product-api";
import { queryKeys, queryStaleTimeMap } from "../../../constants/queryKeys";
import { useMessageStore } from "../../../stores/messageStore";

// Generic selector with inline CRUD modal for category/brand/unit/tag master data.

const { Text } = Typography;

type MasterDataType = "category" | "brand" | "unit" | "tag";

interface BaseOption {
  id: number;
  name: string;
}

interface MasterDataSelectorProps {
  type: MasterDataType;
  label: string;
  value?: number | number[];
  onChange: (value: number | number[] | undefined) => void;
  mode?: "multiple";
  placeholder?: string;
  size?: "small" | "middle" | "large";
  disabled?: boolean;
  status?: "error" | "warning";
}

const getQueryKeyByType = (type: MasterDataType) => {
  // Maps selector type to React Query cache key.
  switch (type) {
    case "category":
      return queryKeys.categories;
    case "brand":
      return queryKeys.brands;
    case "unit":
      return queryKeys.units;
    case "tag":
      return queryKeys.tags;
  }
};

const fetchByType = async (type: MasterDataType): Promise<BaseOption[]> => {
  // Fetches master-data list based on selector type.
  switch (type) {
    case "category":
      return productApi.getCategories();
    case "brand":
      return productApi.getBrands();
    case "unit":
      return productApi.getUnits();
    case "tag":
      return productApi.getTags();
  }
};

const createByType = async (type: MasterDataType, name: string) => {
  // Creates one master-data record for the active selector type.
  switch (type) {
    case "category":
      return productApi.createCategory(name);
    case "brand":
      return productApi.createBrand(name);
    case "unit":
      return productApi.createUnit(name);
    case "tag":
      return productApi.createTag(name);
  }
};

const updateByType = async (type: MasterDataType, id: number, name: string) => {
  // Updates one master-data record by id.
  switch (type) {
    case "category":
      return productApi.updateCategory(id, name);
    case "brand":
      return productApi.updateBrand(id, name);
    case "unit":
      return productApi.updateUnit(id, name);
    case "tag":
      return productApi.updateTag(id, name);
  }
};

const deleteByType = async (type: MasterDataType, id: number) => {
  // Deletes one master-data record by id.
  switch (type) {
    case "category":
      return productApi.deleteCategory(id);
    case "brand":
      return productApi.deleteBrand(id);
    case "unit":
      return productApi.deleteUnit(id);
    case "tag":
      return productApi.deleteTag(id);
  }
};

export default function MasterDataSelector({
  type,
  label,
  value,
  onChange,
  mode,
  placeholder,
  size = "middle",
  disabled,
  status,
}: MasterDataSelectorProps) {
  // Local UI state for manage/create/edit modals.
  const [manageOpen, setManageOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BaseOption | null>(null);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [form] = Form.useForm<{ name: string }>();
  const createNameInputRef = useRef<InputRef>(null);
  const editNameInputRef = useRef<InputRef>(null);
  const { messageApi } = useMessageStore();
  const queryClient = useQueryClient();
  const shouldCloseTagDropdown = type === "tag" && mode === "multiple";

  const queryKey = getQueryKeyByType(type);

  const { data = [], isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: () => fetchByType(type),
    staleTime: queryStaleTimeMap[queryKey],
  });

  const invalidate = () => {
    // Refresh list after create/update/delete.
    queryClient.invalidateQueries({ queryKey: [queryKey] });
  };

  const createMutation = useMutation({
    mutationFn: (name: string) => createByType(type, name),
    onSuccess: (created) => {
      invalidate();
      messageApi?.success(`${label} created successfully`);
      setCreateOpen(false);
      form.resetFields();

      if (mode === "multiple") {
        const current = Array.isArray(value) ? value : [];
        onChange([...current, created.id]);
      } else {
        onChange(created.id);
      }
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : `Failed to create ${label}`;
      messageApi?.error(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      updateByType(type, id, name),
    onSuccess: () => {
      invalidate();
      messageApi?.success(`${label} updated successfully`);
      setEditingItem(null);
      form.resetFields();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : `Failed to update ${label}`;
      messageApi?.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteByType(type, id),
    onSuccess: (_, deletedId) => {
      invalidate();
      messageApi?.success(`${label} deleted successfully`);

      if (mode === "multiple") {
        const current = Array.isArray(value) ? value : [];
        onChange(current.filter((itemId) => itemId !== deletedId));
      } else if (value === deletedId) {
        onChange(undefined);
      }
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : `Failed to delete ${label}`;
      messageApi?.error(message);
    },
  });

  const selectValue = useMemo<number | number[] | undefined>(() => {
    if (mode === "multiple") {
      return Array.isArray(value) ? value : [];
    }
    return typeof value === "number" ? value : undefined;
  }, [mode, value]);

  const options = useMemo(
    () =>
      data.map((item) => ({
        value: item.id,
        label: item.name,
      })),
    [data],
  );

  const onManageCreate = (values: { name: string }) => {
    // Normalizes and submits create form value.
    createMutation.mutate(values.name.trim());
  };

  const onManageUpdate = (values: { name: string }) => {
    // Prevents submit when nothing is selected for editing.
    if (!editingItem) {
      return;
    }
    updateMutation.mutate({ id: editingItem.id, name: values.name.trim() });
  };

  const focusInputAfterModalOpen = (inputRef: RefObject<InputRef | null>) => {
    requestAnimationFrame(() => {
      inputRef.current?.focus({ cursor: "end" });
    });
  };

  return (
    <>
      <Space.Compact style={{ width: "100%" }}>
        <Select
          mode={mode}
          allowClear
          showSearch
          open={shouldCloseTagDropdown ? tagDropdownOpen : undefined}
          size={size}
          status={status}
          value={selectValue}
          loading={isLoading}
          options={options}
          disabled={disabled}
          placeholder={placeholder || `Select ${label.toLowerCase()}`}
          onChange={(nextValue) => onChange(nextValue)}
          onOpenChange={(open) => {
            if (shouldCloseTagDropdown) {
              setTagDropdownOpen(open);
            }
          }}
          onSelect={() => {
            if (shouldCloseTagDropdown) {
              setTagDropdownOpen(false);
            }
          }}
          style={{ width: "100%" }}
          optionFilterProp="label"
          maxTagCount="responsive"
        />
        <Tooltip title={`Manage ${label.toLowerCase()}`}>
          <Button
            size={size}
            icon={<SettingOutlined />}
            onClick={() => setManageOpen(true)}
            disabled={disabled}
          />
        </Tooltip>
      </Space.Compact>

      <Modal
        title={`Manage ${label}`}
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
            Add {label}
          </Button>
        </div>

        <List
          bordered
          dataSource={data}
          locale={{ emptyText: `No ${label.toLowerCase()} found` }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="edit"
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditingItem(item);
                    form.setFieldsValue({ name: item.name });
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
                      title: `Delete ${label}`,
                      content: `Are you sure you want to delete '${item.name}'?`,
                      okType: "danger",
                      onOk: () => deleteMutation.mutateAsync(item.id),
                    });
                  }}
                />,
              ]}
            >
              <Text>{item.name}</Text>
            </List.Item>
          )}
        />

        <Modal
          title={`Add ${label}`}
          open={createOpen}
          afterOpenChange={(open) => {
            if (open) {
              focusInputAfterModalOpen(createNameInputRef);
            }
          }}
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
              label={`${label} Name`}
              rules={[
                {
                  required: true,
                  message: `Please enter ${label.toLowerCase()} name`,
                },
              ]}
            >
              <Input ref={createNameInputRef} maxLength={100} />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title={`Edit ${label}`}
          open={Boolean(editingItem)}
          afterOpenChange={(open) => {
            if (open) {
              focusInputAfterModalOpen(editNameInputRef);
            }
          }}
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
              label={`${label} Name`}
              rules={[
                {
                  required: true,
                  message: `Please enter ${label.toLowerCase()} name`,
                },
              ]}
            >
              <Input ref={editNameInputRef} maxLength={100} />
            </Form.Item>
          </Form>
        </Modal>
      </Modal>
    </>
  );
}
