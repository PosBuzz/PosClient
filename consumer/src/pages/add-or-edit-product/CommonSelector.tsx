import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Form, Input, Modal, Select, Space, Tooltip } from "antd";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { productApi } from "../../api/product-api";
import { useConfirmDelete } from "../../hooks/useConfirmDelete";
import { useMessageStore } from "../../stores/messageStore";

interface CommonSelectorProps {
  value?: number | number[];
  onChange?: (value: number | number[]) => void;
  isForm?: boolean;
  disabled?: boolean;
  required?: boolean;
  type: "category" | "brand" | "unit" | "tag";
  mode?: "tags" | "multiple";
  label: string;
  size?: "large" | "small" | "middle";
}

export default function CommonSelector({
  value,
  onChange,
  disabled,
  type,
  mode,
  label,
  size,
  required,
  isForm,
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
  const [editForm] = Form.useForm();

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
      queryClient.invalidateQueries({ queryKey: ["units"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });

      messageApi?.success(`${label} created successfully`);
      setIsModalOpen(false);
      form.resetFields();

      // Auto-select the newly created item
      if (onChange && newItem.id) {
        if (mode === "tags" || mode === "multiple") {
          const newValues = Array.isArray(value)
            ? [...value, newItem.id]
            : [newItem.id];
          onChange(newValues);
        } else {
          onChange(newItem.id);
        }
      }
    },
    onError: (error) => {
      messageApi?.error(
        `Failed to create ${label.toLowerCase()}: ${
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
      queryClient.invalidateQueries({ queryKey: ["units"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });

      // Remove deleted item from selection if it's selected
      if (onChange && value) {
        if (Array.isArray(value)) {
          onChange(value.filter((id) => id !== deletedId));
        } else if (value === deletedId) {
          onChange(undefined as any);
        }
      }

      messageApi?.success(`${label} deleted successfully`);
    },
    onError: (error) => {
      messageApi?.error(
        `Failed to delete ${label.toLowerCase()}: ${
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
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });

      messageApi?.success(`${label} updated successfully`);
      setEditModalOpen(false);
      setCurrentEdit(null);
      editForm.resetFields();
    },
    onError: (error) => {
      messageApi?.error(
        `Failed to update ${label.toLowerCase()}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    },
  });

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

  const handleEditSubmit = (values: { name: string }) => {
    if (currentEdit) {
      updateMutation.mutate({ id: currentEdit.id, value: values.name });
    }
  };

  // Create a ref to hold the ID since state might not be updated in time for the callback
  const deleteIdRef = useRef<number | null>(null);

  const { showDeleteConfirm } = useConfirmDelete({
    title: `Delete ${label}`,
    content: `Are you sure you want to delete this ${label.toLowerCase()}? This action cannot be undone.`,
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

  // Convert values for tags mode (numbers to strings) to fix the warning
  const convertedValue = useMemo(() => {
    if (mode === "tags" || mode === "multiple") {
      return Array.isArray(value)
        ? value.map((v) => String(v))
        : value !== undefined
        ? [String(value)]
        : [];
    }
    return value;
  }, [value, mode]);

  const handleChange = (newValue: any) => {
    if (mode === "tags" || mode === "multiple") {
      // Convert string values back to numbers
      const numberValues = Array.isArray(newValue)
        ? newValue.map((v: string) => parseInt(v, 10)).filter((v) => !isNaN(v))
        : [];
      onChange?.(numberValues);
    } else {
      onChange?.(newValue);
    }
  };

  // Create option labels for dropdown
  const mergedOptions = useMemo(() => {
    return options.map((opt) => ({
      label: (
        <div className="flex items-center justify-between group">
          <span>{opt.name}</span>
          <Space className="opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip title="Edit">
              <EditOutlined
                className="text-blue-500 cursor-pointer hover:text-blue-700"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(opt);
                }}
              />
            </Tooltip>
            <Tooltip title="Delete">
              <DeleteOutlined
                className="text-red-500 cursor-pointer hover:text-red-700"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(opt.id);
                }}
              />
            </Tooltip>
          </Space>
        </div>
      ),
      // Convert to string for tags mode to fix the warning
      value: mode === "tags" || mode === "multiple" ? String(opt.id) : opt.id,
      originalData: opt,
    }));
  }, [options, mode]);

  return (
    <>
      {isForm ? (
        <Form.Item label={label} required={required}>
          <Select
            size={size}
            mode={mode}
            value={convertedValue}
            onChange={handleChange}
            placeholder={`Select ${label.toLowerCase()}`}
            loading={isLoading}
            disabled={disabled}
            className="w-full"
            allowClear
            showSearch
            optionFilterProp="children"
            maxTagCount="responsive"
            dropdownStyle={{ zIndex: 1050 }}
            listHeight={250}
            optionLabelProp="children"
            labelRender={(selectedValue) => {
              const optionId =
                mode === "tags" || mode === "multiple"
                  ? parseInt(String(selectedValue.value), 10)
                  : selectedValue.value;
              const option = options.find((opt) => opt.id === optionId);
              return option ? option.name : "";
            }}
            filterOption={(input, option) => {
              const label = option?.label as any;
              const text = label?.props?.children[0]?.props?.children || "";
              return text
                .toString()
                .toLowerCase()
                .includes(input.toLowerCase());
            }}
            getPopupContainer={(triggerNode) =>
              triggerNode.parentNode as HTMLElement
            }
            dropdownRender={(menu) => (
              <>
                {menu}
                <div className="border-t border-gray-200 p-2">
                  <Button
                    type="text"
                    icon={<PlusOutlined />}
                    onClick={() => setIsModalOpen(true)}
                    className="w-full text-left"
                  >
                    Add new {label.toLowerCase()}
                  </Button>
                </div>
              </>
            )}
            options={mergedOptions}
          />
        </Form.Item>
      ) : (
        <div>
          {" "}
          <label className="mb-3 block text-sm font-medium">{label}</label>
          <Select
            size={size}
            mode={mode}
            value={convertedValue}
            onChange={handleChange}
            placeholder={`Select ${label.toLowerCase()}`}
            loading={isLoading}
            disabled={disabled}
            className="w-full"
            allowClear
            showSearch
            optionFilterProp="children"
            maxTagCount="responsive"
            dropdownStyle={{ zIndex: 1050 }}
            listHeight={250}
            optionLabelProp="children"
            labelRender={(selectedValue) => {
              const optionId =
                mode === "tags" || mode === "multiple"
                  ? parseInt(String(selectedValue.value), 10)
                  : selectedValue.value;
              const option = options.find((opt) => opt.id === optionId);
              return option ? option.name : "";
            }}
            filterOption={(input, option) => {
              const label = option?.label as any;
              const text = label?.props?.children[0]?.props?.children || "";
              return text
                .toString()
                .toLowerCase()
                .includes(input.toLowerCase());
            }}
            getPopupContainer={(triggerNode) =>
              triggerNode.parentNode as HTMLElement
            }
            dropdownRender={(menu) => (
              <>
                {menu}
                <div className="border-t border-gray-200 p-2">
                  <Button
                    type="text"
                    icon={<PlusOutlined />}
                    onClick={() => setIsModalOpen(true)}
                    className="w-full text-left"
                  >
                    Add new {label.toLowerCase()}
                  </Button>
                </div>
              </>
            )}
            options={mergedOptions}
          />
        </div>
      )}

      {/* Add New Modal */}
      <Modal
        title={`Add New ${label}`}
        open={isModalOpen}
        onOk={() => form.submit()}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        confirmLoading={createMutation.isPending}
        okText="Create"
        zIndex={1060}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateSubmit}>
          <Form.Item
            name="name"
            label={`${label} Name`}
            rules={[
              {
                required: true,
                message: `Please enter ${label.toLowerCase()} name`,
              },
              {
                min: 2,
                message: `${label} name must be at least 2 characters`,
              },
            ]}
          >
            <Input
              ref={inputRef}
              placeholder={`Enter ${label.toLowerCase()} name`}
              onPressEnter={() => form.submit()}
              maxLength={50}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title={`Edit ${label}`}
        open={editModalOpen}
        onOk={() => editForm.submit()}
        onCancel={() => {
          setEditModalOpen(false);
          setCurrentEdit(null);
          editForm.resetFields();
        }}
        confirmLoading={updateMutation.isPending}
        okText="Update"
        zIndex={1060}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>
          <Form.Item
            name="name"
            label={`${label} Name`}
            rules={[
              {
                required: true,
                message: `Please enter ${label.toLowerCase()} name`,
              },
              {
                min: 2,
                message: `${label} name must be at least 2 characters`,
              },
            ]}
          >
            <Input
              ref={editInputRef}
              placeholder={`Enter ${label.toLowerCase()} name`}
              onPressEnter={() => editForm.submit()}
              maxLength={50}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
