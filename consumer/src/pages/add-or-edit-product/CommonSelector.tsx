import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Form, Input, Modal, Select, Tooltip } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { productApi } from "../../api/product-api";
import { useMessageStore } from "../../stores/messageStore";
import { useConfirmDelete } from "../../hooks/useConfirmDelete";

interface CommonSelectorProps {
  value?: number | number[];
  onChange?: (value: number | number[]) => void;
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
  const inputRef = useRef<React.ElementRef<typeof Input>>(null);
  const editInputRef = useRef<React.ElementRef<typeof Input>>(null);

  // Edit functionality
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentEdit, setCurrentEdit] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const { messageApi } = useMessageStore();

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
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      messageApi?.success(`${type} created successfully`);
      setIsModalOpen(false);
      form.resetFields();

      // Auto-select the newly created item
      if (onChange && newItem.id) {
        if (mode === "tags" || mode === "multiple") {
          // For multiple selection, merge with existing values
          const newValues = Array.isArray(value)
            ? [...value, newItem.id]
            : [newItem.id];
          onChange(newValues);
        } else {
          // For single selection
          onChange(newItem.id);
        }
      }
    },
    onError: (error) => {
      messageApi?.error(
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
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["selector", type] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["brands"] });

      // Remove deleted item from selection if it's selected
      if (onChange && value) {
        if (Array.isArray(value)) {
          onChange(value.filter((id) => id !== deletedId));
        } else if (value === deletedId) {
          onChange(undefined as any);
        }
      }
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
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      messageApi?.success(`${type} updated successfully`);
      setEditModalOpen(false);
    },
    onError: (error) => {
      messageApi?.error(
        `Failed to update ${type}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    },
  });

  const handleAddNew = () => {
    setIsModalOpen(true);
  };

  // Focus on input when modal opens
  useEffect(() => {
    if (isModalOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isModalOpen]);

  // Focus on edit input when edit modal opens
  useEffect(() => {
    if (editModalOpen && editInputRef.current) {
      setTimeout(() => {
        editInputRef.current?.focus();
      }, 100);
    }
  }, [editModalOpen]);

  const handleCreateSubmit = async (values: { name: string }) => {
    createMutation.mutate(values.name);
  };

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

  // Create a ref to hold the ID since state might not be updated in time for the callback
  const deleteIdRef = useRef<number | null>(null);

  const { showDeleteConfirm } = useConfirmDelete({
    title: `Delete ${type}`,
    content: `Are you sure you want to delete this ${type}? This action cannot be undone.`,
    onConfirm: async () => {
      const idToDelete = deleteIdRef.current;
      if (idToDelete !== null) {
        await deleteMutation.mutateAsync(idToDelete);
      }
    },
  });

  const handleDelete = (id: number) => {
    deleteIdRef.current = id; // Store the ID in a ref for reliable access
    showDeleteConfirm();
  };

  // Create option labels for dropdown and selection
  const mergedOptions = useMemo(() => {
    // Map for dropdown options (with edit/delete buttons)
    return options.map((opt) => ({
      // Full option with buttons for dropdown
      label: (
        <div className="flex items-center justify-between w-full">
          <span>{opt.name}</span>
          <span className="flex items-center space-x-2 ml-2">
            <Tooltip title="Edit">
              <EditOutlined
                className="text-blue-500 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(opt);
                }}
              />
            </Tooltip>
            <Tooltip title="Delete">
              <DeleteOutlined
                className="text-red-500 cursor-pointer"
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
      // This is used for tag rendering in multi-select mode
      tagRender: () => (
        <span className="ant-select-selection-item">
          <span>{opt.name}</span>
        </span>
      ),
    }));
  }, [options, value]);

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
        maxTagCount="responsive"
        dropdownStyle={{ zIndex: 1050 }}
        listHeight={250}
        optionLabelProp="children"
        labelRender={(selectedValue) => {
          const option = options.find((opt) => opt.id === selectedValue.value);
          return option ? option.name : "";
        }}
        filterOption={(input, option) => {
          const label = option?.label as any;
          const text = label?.props?.children[0]?.props?.children || "";
          return text.toString().toLowerCase().includes(input.toLowerCase());
        }}
        getPopupContainer={(triggerNode) =>
          triggerNode.parentNode as HTMLElement
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
        zIndex={1060}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateSubmit}>
          <Form.Item
            name="name"
            label={`${type} Name`}
            rules={[{ required: true, message: `Please enter ${type} name` }]}
          >
            <Input ref={inputRef} placeholder={`Enter ${type} name`} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title={`Edit ${type}`}
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        okText="Update"
        okButtonProps={{ loading: updateMutation.isPending }}
        onOk={() => editForm.submit()}
        zIndex={1060}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>
          <Form.Item
            name="name"
            label={`${type} Name`}
            rules={[{ required: true, message: `Please enter ${type} name` }]}
          >
            <Input ref={editInputRef} placeholder={`Enter ${type} name`} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
