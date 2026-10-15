import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { getErrorMessage } from "../utils/api-error";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Form, Input, Modal, Select, Space, Tooltip } from "antd";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { inventoryApi } from "../api/inventory-api";
import { useConfirmDelete } from "../hooks/useConfirmDelete";
import { useMessageStore } from "../stores/messageStore";
import { queryKeys, queryStaleTimeMap } from "../constants/queryKeys";

interface VendorSelectorProps {
  value?: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
  size?: "large" | "small" | "middle";
}

export default function VendorSelector({
  value,
  onChange,
  disabled,
  size,
}: VendorSelectorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const inputRef = useRef<React.ElementRef<typeof Input>>(null);

  // Edit functionality
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentEdit, setCurrentEdit] = useState<{
    id: number;
    name: string;
    contact?: string;
    phone?: string;
    email?: string;
    address?: string;
  } | null>(null);
  const [editForm] = Form.useForm();

  const { messageApi } = useMessageStore();

  // Fetch vendors
  const { data: vendors = [], isLoading } = useQuery({
    queryKey: [queryKeys.vendors],
    queryFn: () => inventoryApi.getVendors(),
    staleTime: queryStaleTimeMap[queryKeys.vendors],
  });

  // Create mutation (you'll need to add this to your inventory API)
  const createMutation = useMutation({
    mutationFn: async (vendorData: {
      name: string;
      contact?: string;
      phone?: string;
      email?: string;
      address?: string;
    }) => {
      // You'll need to implement this in your inventory API
      return await inventoryApi.createVendor(vendorData);
    },
    onSuccess: (newVendor) => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.vendors] });
      messageApi?.success("Vendor created successfully");
      setIsModalOpen(false);
      form.resetFields();

      // Auto-select the newly created vendor
      if (onChange && newVendor.id) {
        onChange(newVendor.id);
      }
    },
    onError: (error) => {
      messageApi?.error(getErrorMessage(error, "Failed to create vendor"));
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      vendorData,
    }: {
      id: number;
      vendorData: {
        name: string;
        contact?: string;
        phone?: string;
        email?: string;
        address?: string;
      };
    }) => {
      return await inventoryApi.updateVendor(id, vendorData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.vendors] });
      messageApi?.success("Vendor updated successfully");
      setEditModalOpen(false);
      setCurrentEdit(null);
      editForm.resetFields();
    },
    onError: (error) => {
      messageApi?.error(getErrorMessage(error, "Failed to update vendor"));
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await inventoryApi.deleteVendor(id);
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.vendors] });

      // Remove deleted vendor from selection if it's selected
      if (onChange && value === deletedId) {
        onChange(undefined as any);
      }

      messageApi?.success("Vendor deleted successfully");
    },
    onError: (error) => {
      messageApi?.error(getErrorMessage(error, "Failed to delete vendor"));
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

  const handleCreateSubmit = async (values: {
    name: string;
    contact?: string;
    phone?: string;
    email?: string;
    address?: string;
  }) => {
    createMutation.mutate(values);
  };

  const handleEdit = (vendor: any) => {
    setCurrentEdit(vendor);
    setEditModalOpen(true);
    editForm.setFieldsValue({
      name: vendor.name,
      contact: vendor.contact,
      phone: vendor.phone,
      email: vendor.email,
      address: vendor.address,
    });
  };

  const handleEditSubmit = (values: {
    name: string;
    contact?: string;
    phone?: string;
    email?: string;
    address?: string;
  }) => {
    if (currentEdit) {
      console.log(values);

      updateMutation.mutate({ id: currentEdit.id, vendorData: values });
    }
  };

  const deleteIdRef = useRef<number | null>(null);

  const { showDeleteConfirm } = useConfirmDelete({
    title: "Delete Vendor",
    content:
      "Are you sure you want to delete this vendor? This action cannot be undone.",
    onConfirm: async () => {
      const idToDelete = deleteIdRef.current;
      if (idToDelete !== null) {
        await deleteMutation.mutateAsync(idToDelete);
      }
    },
  });

  const handleDelete = (id: number) => {
    deleteIdRef.current = id;
    showDeleteConfirm();
  };

  const mergedOptions = useMemo(() => {
    return vendors.map((vendor) => ({
      label: (
        <div className="flex items-center justify-between group">
          <div>
            <div style={{ fontWeight: 500 }}>{vendor.name}</div>
            {vendor.contact && (
              <div style={{ fontSize: "12px", color: "#666" }}>
                Contact: {vendor.contact}
              </div>
            )}
          </div>
          <Space className="opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip title="Edit">
              <EditOutlined
                className="text-blue-500 cursor-pointer hover:text-blue-700"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(vendor);
                }}
              />
            </Tooltip>
            <Tooltip title="Delete">
              <DeleteOutlined
                className="text-red-500 cursor-pointer hover:text-red-700"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(vendor.id);
                }}
              />
            </Tooltip>
          </Space>
        </div>
      ),
      value: vendor.id,
      originalData: vendor,
    }));
  }, [vendors]);

  return (
    <>
      <Select
        size={size}
        value={value}
        onChange={onChange}
        placeholder="Select supplier/vendor"
        loading={isLoading}
        disabled={disabled}
        className="w-full"
        allowClear
        showSearch
        optionFilterProp="children"
        dropdownStyle={{ zIndex: 1050 }}
        listHeight={250}
        optionLabelProp="children"
        labelRender={(selectedValue) => {
          const vendor = vendors.find((v) => v.id === selectedValue.value);
          return vendor ? vendor.name : "";
        }}
        filterOption={(input, option) => {
          const vendor = option?.originalData;
          if (!vendor) return false;

          const searchText = input.toLowerCase();
          return (
            vendor.name.toLowerCase().includes(searchText) ||
            (vendor.contact
              ? vendor.contact.toLowerCase().includes(searchText)
              : false) ||
            (vendor.phone
              ? vendor.phone.toLowerCase().includes(searchText)
              : false) ||
            (vendor.email
              ? vendor.email.toLowerCase().includes(searchText)
              : false)
          );
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
                Add new vendor
              </Button>
            </div>
          </>
        )}
        options={mergedOptions}
      />

      {/* Add New Modal */}
      <Modal
        title="Add New Vendor"
        open={isModalOpen}
        onOk={() => form.submit()}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        confirmLoading={createMutation.isPending}
        okText="Create"
        zIndex={1060}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateSubmit}>
          <Form.Item
            name="name"
            label="Vendor Name"
            rules={[
              { required: true, message: "Please enter vendor name" },
              { min: 2, message: "Vendor name must be at least 2 characters" },
            ]}
          >
            <Input
              ref={inputRef}
              placeholder="Enter vendor name"
              maxLength={100}
            />
          </Form.Item>

          <Form.Item name="contact" label="Contact Person">
            <Input placeholder="Enter contact person name" maxLength={100} />
          </Form.Item>

          <Form.Item name="phone" label="Phone Number">
            <Input placeholder="Enter phone number" maxLength={20} />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[{ type: "email", message: "Please enter a valid email" }]}
          >
            <Input placeholder="Enter email address" maxLength={100} />
          </Form.Item>

          <Form.Item name="address" label="Address">
            <Input.TextArea
              placeholder="Enter address"
              maxLength={255}
              rows={3}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="Edit Vendor"
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
        width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>
          <Form.Item
            name="name"
            label="Vendor Name"
            rules={[
              { required: true, message: "Please enter vendor name" },
              { min: 2, message: "Vendor name must be at least 2 characters" },
            ]}
          >
            <Input placeholder="Enter vendor name" maxLength={100} />
          </Form.Item>

          <Form.Item name="contact" label="Contact Person">
            <Input placeholder="Enter contact person name" maxLength={100} />
          </Form.Item>

          <Form.Item name="phone" label="Phone Number">
            <Input placeholder="Enter phone number" maxLength={20} />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[{ type: "email", message: "Please enter a valid email" }]}
          >
            <Input placeholder="Enter email address" maxLength={100} />
          </Form.Item>

          <Form.Item name="address" label="Address">
            <Input.TextArea
              placeholder="Enter address"
              maxLength={255}
              rows={3}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
