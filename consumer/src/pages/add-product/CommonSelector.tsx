import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Select, Tooltip, Form, Modal, Input, message } from "antd";
import { useState, useMemo } from "react";
import { productApi } from "../../api/product-api";

interface CommonSelectorProps {
  value?: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
  type: "category" | "brand" | "unit" | "tag";
  mode?: "tags" | "multiple";
}

export default function CommonSelector({
  value,
  onChange,
  disabled,
  type,
  mode,
}: CommonSelectorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch options based on type
  const { data: options = [], isLoading } = useQuery({
    queryKey: ["selector", type],
    queryFn: async () => {
      switch (type) {
        case "category":
          return await productApi.getCategories();
        case "brand":
          return await productApi.getBrands();
        case "unit":
          return await productApi.getUnits();
        case "tag":
          return await productApi.getTags();
        default:
          return [];
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (value: string) => {
      switch (type) {
        case "category":
          return await productApi.createCategory(value);
        case "brand":
          return await productApi.createBrand(value);
        case "unit":
          return await productApi.createUnit(value);
        case "tag":
          return await productApi.createTag(value);
        default:
          throw new Error(`Creating ${type} is not supported`);
      }
    },
    onSuccess: (newItem) => {
      // Invalidate the query to refresh the data
      queryClient.invalidateQueries({ queryKey: ["selector", type] });
      message.success(`${type} created successfully`);
      setIsModalOpen(false);
      form.resetFields();

      // Auto-select the newly created item
      if (onChange && newItem.id) {
        onChange(newItem.id);
      }
    },
    onError: (error) => {
      message.error(
        `Failed to create ${type}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      switch (type) {
        case "category":
          return await productApi.deleteCategory(id);
        case "brand":
          return await productApi.deleteBrand(id);
        case "unit":
          return await productApi.deleteUnit(id);
        case "tag":
          return await productApi.deleteTag(id);
        default:
          throw new Error(`Deleting ${type} is not supported`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["selector", type] });
      message.success(`${type} deleted successfully`);
    },
    onError: (error) => {
      message.error(
        `Failed to delete ${type}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, value }: { id: number; value: string }) => {
      switch (type) {
        case "category":
          return await productApi.updateCategory(id, value);
        case "brand":
          return await productApi.updateBrand(id, value);
        case "unit":
          return await productApi.updateUnit(id, value);
        case "tag":
          return await productApi.updateTag(id, value);
        default:
          throw new Error(`Updating ${type} is not supported`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["selector", type] });
      message.success(`${type} updated successfully`);
      setEditModalOpen(false);
    },
    onError: (error) => {
      message.error(
        `Failed to update ${type}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    },
  });

  const handleAddNew = () => {
    setIsModalOpen(true);
  };

  const handleCreateSubmit = async (values: { name: string }) => {
    createMutation.mutate(values.name);
  };

  // Edit functionality
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentEdit, setCurrentEdit] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const handleEdit = (item: any) => {
    setCurrentEdit({ id: item.id, name: item.name });
    setEditModalOpen(true);
    editForm.setFieldsValue({ name: item.name });
  };

  const [editForm] = Form.useForm();

  const handleEditSubmit = (values: { name: string }) => {
    if (currentEdit) {
      updateMutation.mutate({ id: currentEdit.id, value: values.name });
    }
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  const mergedOptions = useMemo(
    () =>
      options.map((opt) => ({
        label: (
          <div className="flex items-center justify-between">
            <span>{opt.name}</span>
            <span className="space-x-1">
              <Tooltip title="Edit">
                <EditOutlined
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(opt);
                  }}
                />
              </Tooltip>
              <Tooltip title="Delete">
                <DeleteOutlined
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(opt.id);
                  }}
                />
              </Tooltip>
            </span>
          </div>
        ),
        value: opt.id,
      })),
    [options, type]
  );

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium capitalize">Select {type}</span>
        <Tooltip title={`Add new ${type}`}>
          <PlusOutlined onClick={handleAddNew} className="cursor-pointer" />
        </Tooltip>
      </div>
      <Select
        mode={mode}
        showSearch
        placeholder={`Select ${type}`}
        optionFilterProp="label"
        loading={isLoading}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full"
        options={mergedOptions}
        filterOption={(input, option) =>
          (option?.label as any)?.props?.children[0]?.props?.children
            .toLowerCase()
            .includes(input.toLowerCase())
        }
      />

      {/* Create Modal */}
      <Modal
        title={`Create a new ${type}`}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        okText="Create"
        okButtonProps={{ loading: createMutation.isPending }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateSubmit}>
          <Form.Item
            name="name"
            label={`${type} Name`}
            rules={[{ required: true, message: `Please enter ${type} name` }]}
          >
            <Input placeholder={`Enter ${type} name`} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        className="z-50!"
        title={`Edit ${type}`}
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        okText="Update"
        okButtonProps={{ loading: updateMutation.isPending }}
        onOk={() => editForm.submit()}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>
          <Form.Item
            name="name"
            label={`${type} Name`}
            rules={[{ required: true, message: `Please enter ${type} name` }]}
          >
            <Input placeholder={`Enter ${type} name`} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
