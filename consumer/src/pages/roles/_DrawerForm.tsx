/* eslint-disable */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Collapse,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import { useEffect, useMemo } from "react";
import { get, patch, post } from "../../api/crud-api";
import { endpoints } from "../../api/endpoints";
import { useMessageStore } from "../../stores/messageStore";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { Permissions } from "../../constants/permissions";
import { getErrorMessage } from "../../utils/api-error";

const { Text } = Typography;

const permissionGuide = {
  [Permissions.profile]: {
    title: "Profile",
    summary:
      "Lets users access their own profile and password/security actions.",
    gives: ["Personal profile", "Change password"],
  },
  [Permissions.companyProfile]: {
    title: "Company Profile",
    summary: "Lets users view and update company/business profile information.",
    gives: ["Company profile settings"],
  },
  [Permissions.users]: {
    title: "Users & Roles",
    summary:
      "Lets users manage staff accounts and roles. This is an admin-level permission.",
    gives: ["Users page", "Roles page", "Create and update roles"],
  },
  [Permissions.branches]: {
    title: "Branches",
    summary: "Lets users manage branches and branch-related setup.",
    gives: ["Branch list", "Add/edit branches", "Branch details"],
  },
  [Permissions.add_product]: {
    title: "Add Product",
    summary: "Lets users create products and supporting product setup records.",
    gives: [
      "Add product",
      "Barcode printing",
      "Categories, brands, tags, and units setup",
    ],
  },
  [Permissions.view_product]: {
    title: "View Product",
    summary:
      "Lets users view product catalog, product details, and product sales stats.",
    gives: ["Product list", "Product details", "Variant sales stats"],
  },
  [Permissions.edit_product]: {
    title: "Edit Product",
    summary: "Lets users update product records and product setup data.",
    gives: ["Edit products", "Categories, brands, tags, and units setup"],
  },
  [Permissions.delete_product]: {
    title: "Delete Product",
    summary: "Lets users delete products and deletable product setup records.",
    gives: ["Delete product", "Delete selected brands/units where allowed"],
  },
  [Permissions.product_audit]: {
    title: "Product Audit",
    summary: "Lets users review product audit/history records.",
    gives: ["Product audit page"],
  },
  [Permissions.inventory_batches]: {
    title: "Inventory",
    summary:
      "Lets users manage stock batches, stock reports, vendors from inventory, and purchase payments.",
    gives: [
      "Add/view inventory",
      "Stock by variant",
      "Low/expiring stock",
      "Purchase payments",
    ],
  },
  [Permissions.inventory_transfer]: {
    title: "Inventory Transfer",
    summary: "Lets users move inventory between branches or locations.",
    gives: ["Add transfer", "View transfer records"],
  },
  [Permissions.inventory_adjustment]: {
    title: "Inventory Adjustment",
    summary:
      "Lets users adjust stock counts for correction, loss, or reconciliation.",
    gives: ["Add adjustment", "View adjustment records"],
  },
  [Permissions.vendors]: {
    title: "Vendors",
    summary: "Lets users create and manage vendor/supplier records.",
    gives: ["Vendor list", "Add/edit vendors"],
  },
  [Permissions.sales]: {
    title: "Sales",
    summary:
      "Lets users run the POS sales workflow and related sales operations.",
    gives: [
      "New/view sales",
      "Returns",
      "Due payments",
      "Promotions",
      "Sales targets and stats",
    ],
  },
  [Permissions.quotations]: {
    title: "Quotations",
    summary: "Lets users create, view, update, and convert quotations.",
    gives: ["New quotation", "View quotations", "Quotation actions"],
  },
  [Permissions.customers]: {
    title: "Customers",
    summary:
      "Lets users manage customers, reward points, and customer reward data.",
    gives: ["Customers page", "Reward points"],
  },
  [Permissions.receipt_settings]: {
    title: "Receipt & Printer Settings",
    summary:
      "Lets users configure receipt templates and printer/PDF receipt settings.",
    gives: ["Printer settings", "Receipt settings"],
  },
  [Permissions.business_insights]: {
    title: "Business Insights",
    summary:
      "Lets users see how the business is doing: sales figures, targets, costs and reports.",
    gives: [
      "Dashboard figures and charts",
      "Products > Sales Stats",
      "Sales > Sales Target and User Sales Stats",
      "Operational Costs",
      "Business Report",
    ],
  },
  [Permissions.support]: {
    title: "Support",
    summary:
      "Lets users raise support tickets with PosBuzz and follow the conversation.",
    gives: ["Support page", "Create tickets", "Reply to and close tickets"],
  },
};

export const formatPermissionLabel = (permission: string) =>
  permissionGuide[permission]?.title ||
  permission
    ?.replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());

// @ts-ignore
export default function DrawerForm({
  onClose,
  open,
  onSubmitSuccess,
  isEditing,
  editedItem,
  // ...props
}) {
  const [form] = Form.useForm();
  const { messageApi } = useMessageStore();
  const queryClient = useQueryClient();

  const createData = useMutation({
    mutationFn: async (data) => await post(endpoints.role, data),
    onSuccess: (_response) => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.roles] });
      messageApi?.success("Saved Successfully");
      form.resetFields();
      onSubmitSuccess();
    },
    onError: (error) => {
      messageApi?.error(getErrorMessage(error, "Something went wrong"));
    },
  });

  const updateData = useMutation({
    mutationFn: async (data: any) =>
      await patch(endpoints.updateRole(data.id), data),
    onSuccess: (_response) => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.roles] });
      messageApi?.success("Updated Successfully");
      form.resetFields();
      onSubmitSuccess(true);
    },
    onError: (error) => {
      messageApi?.error(getErrorMessage(error, "Something went wrong"));
    },
  });

  const { data: permissionOptions } = useQuery({
    queryKey: [queryKeys.planPermissions],
    queryFn: () => get(endpoints.planPermissions),
    staleTime: queryStaleTimeMap[queryKeys.planPermissions],
  });

  const permissionGuideItems = useMemo(() => {
    return (permissionOptions || []).map((option: any) => {
      const permission = option.label;
      const guide = permissionGuide[permission];

      return {
        key: permission,
        label: (
          <Space wrap size={6}>
            <Text strong>{formatPermissionLabel(permission)}</Text>
            <Tag>{permission}</Tag>
          </Space>
        ),
        children: (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Text>
              {guide?.summary ||
                "Controls access to this permission's related pages and actions."}
            </Text>
            {guide?.gives?.length ? (
              <Space wrap size={[6, 6]}>
                {guide.gives.map((item) => (
                  <Tag color="blue" key={item}>
                    {item}
                  </Tag>
                ))}
              </Space>
            ) : null}
          </Space>
        ),
      };
    });
  }, [permissionOptions]);

  const selectOptions = useMemo(() => {
    return (permissionOptions || []).map((option: any) => ({
      ...option,
      displayLabel: formatPermissionLabel(option.label),
      description:
        permissionGuide[option.label]?.summary ||
        "Controls access to this permission's related pages and actions.",
      searchText: [
        option.label,
        formatPermissionLabel(option.label),
        permissionGuide[option.label]?.summary,
      ]
        .filter(Boolean)
        .join(" "),
    }));
  }, [permissionOptions]);

  const onFinish = async (formValues: any) => {
    const payload = {
      name: formValues.name,
      permission_ids: formValues.permission_ids,
    };

    if (isEditing && editedItem) {
      return updateData.mutate({
        ...payload,
        id: editedItem.id,
      });
    }

    // @ts-ignore
    createData.mutate(payload);
  };

  const onFinishFailed = (errorInfo: any) => {
    console.log("Failed:", errorInfo);
  };

  useEffect(() => {
    if (!open) return;
    if (isEditing && editedItem) {
      form.setFieldsValue({
        name: editedItem.name,
        permission_ids: editedItem.permissions?.map(
          (p: any) => p.permission_id,
        ),
      });
    } else {
      form.resetFields();
    }
  }, [open, isEditing, editedItem, form]);

  return (
    <>
      <Drawer
        title={isEditing ? "Update Role" : "Add Role"}
        onClose={onClose}
        width={760}
        open={open}
        style={{ maxHeight: "100vh", overflowY: "auto" }} // Adjusting drawer max height
      >
        <Form
          form={form}
          name="basic"
          labelCol={{ span: 8 }} // Adjust column width for better alignment
          wrapperCol={{ span: 16 }}
          labelAlign="right" // Right-align the labels
          onFinish={onFinish}
          onFinishFailed={onFinishFailed}
          autoComplete="off"
        >
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: "This field is required" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Permissions"
            name="permission_ids"
            rules={[
              {
                required: true,
                message: "This field is required",
              },
            ]}
          >
            <Select
              size="middle"
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="searchText"
              filterSort={(
                optionA: { displayLabel?: string },
                optionB: { displayLabel?: string },
              ) =>
                (optionA?.displayLabel ?? "")
                  .toLowerCase()
                  .localeCompare((optionB?.displayLabel ?? "").toLowerCase())
              }
              optionLabelProp="displayLabel"
              options={selectOptions}
              optionRender={(option) => {
                const optionData = option.data as any;

                return (
                  <Space direction="vertical" size={0}>
                    <Text strong>{optionData.displayLabel}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {optionData.description}
                    </Text>
                  </Space>
                );
              }}
            />
          </Form.Item>

          <Form.Item label="Permission Guide">
            {permissionGuideItems.length ? (
              <Collapse
                key={`permission-guide-${permissionGuideItems.length}`}
                size="small"
                items={permissionGuideItems}
                defaultActiveKey={permissionGuideItems
                  .slice(0, 2)
                  .map((item) => item.key)}
              />
            ) : (
              <Text type="secondary">
                Permission guide will appear after permissions load.
              </Text>
            )}
          </Form.Item>

          <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={updateData.isPending || createData.isPending}
            >
              Save
            </Button>
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}
