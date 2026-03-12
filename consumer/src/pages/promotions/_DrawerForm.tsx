import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useMemo } from "react";
import { promotionApi } from "../../api/promotion-api";
import { queryKeys } from "../../constants/queryKeys";
import { useMessageStore } from "../../stores/messageStore";

const scopeOptions = [
  { label: "Single Product", value: "SINGLE_PRODUCT" },
  { label: "Bundle", value: "BUNDLE" },
  { label: "Brand", value: "BRAND" },
];

const discountTypeOptions = [
  { label: "Percentage", value: "percentage" },
  { label: "Fixed Amount", value: "fixed_amount" },
];

const formatCurrency = (value: number) => `$${Number(value || 0).toFixed(2)}`;

export default function DrawerForm({
  onClose,
  open,
  onSubmitSuccess,
  isEditing,
  editedItem,
}: any) {
  const [form] = Form.useForm();
  const { messageApi } = useMessageStore();
  const queryClient = useQueryClient();

  const { data: optionsData } = useQuery({
    queryKey: [queryKeys.promotions, "options"],
    queryFn: promotionApi.getOptions,
  });

  const createMutation = useMutation({
    mutationFn: promotionApi.createPromotion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.promotions] });
      messageApi?.success("Promotion created successfully");
      form.resetFields();
      onSubmitSuccess();
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to create promotion",
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: any) => promotionApi.updatePromotion(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.promotions] });
      messageApi?.success("Promotion updated successfully");
      form.resetFields();
      onSubmitSuccess();
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to update promotion",
      );
    },
  });

  const selectedScope = Form.useWatch("scope", form);
  const branchSpecific = Form.useWatch("branch_specific", form);
  const limitPerCustomer = Form.useWatch("limit_per_customer", form);
  const watchedDescription = Form.useWatch("description", form);
  const watchedDiscountType = Form.useWatch("discount_type", form);
  const watchedDiscountValue = Form.useWatch("discount_value", form);
  const watchedMinPurchase = Form.useWatch("min_purchase", form);
  const watchedMinQuantity = Form.useWatch("min_quantity", form);
  const watchedUsageLimit = Form.useWatch("usage_limit", form);
  const watchedCapQuantity = Form.useWatch("cap_quantity", form);
  const watchedCapDiscountAmount = Form.useWatch("cap_discount_amount", form);
  const watchedMaxDiscountAmount = Form.useWatch("max_discount_amount", form);
  const watchedMemberOnly = Form.useWatch("member_only", form);
  const watchedAutoApply = Form.useWatch("auto_apply", form);
  const watchedLimitPerCustomer = Form.useWatch("limit_per_customer", form);
  const watchedCustomerUsageLimit = Form.useWatch("customer_usage_limit", form);
  const watchedCustomerUsageDailyReset = Form.useWatch(
    "customer_usage_daily_reset",
    form,
  );
  const watchedBranchSpecific = Form.useWatch("branch_specific", form);
  const watchedBranchIds = Form.useWatch("branch_ids", form);
  const watchedBrandId = Form.useWatch("brand_id", form);
  const watchedVariantId = Form.useWatch("variant_id", form);
  const watchedVariantIds = Form.useWatch("variant_ids", form);
  const watchedStartDate = Form.useWatch("start_date", form);
  const watchedEndDate = Form.useWatch("end_date", form);

  const variantOptions = useMemo(() => {
    return (
      optionsData?.variants?.map((variant) => ({
        label: `${variant.product_name} - ${variant.name}${variant.sku ? ` (${variant.sku})` : ""}`,
        value: variant.id,
      })) || []
    );
  }, [optionsData]);

  const generatedDescription = useMemo(() => {
    const discountValue = Number(watchedDiscountValue || 0);
    const minQuantity = Number(watchedMinQuantity || 1);
    const minPurchase = Number(watchedMinPurchase || 0);
    const usageLimit =
      watchedUsageLimit === null || watchedUsageLimit === undefined
        ? null
        : Number(watchedUsageLimit);
    const capQuantity =
      watchedCapQuantity === null || watchedCapQuantity === undefined
        ? null
        : Number(watchedCapQuantity);
    const capDiscountAmount =
      watchedCapDiscountAmount === null || watchedCapDiscountAmount === undefined
        ? null
        : Number(watchedCapDiscountAmount);
    const maxDiscountAmount =
      watchedMaxDiscountAmount === null || watchedMaxDiscountAmount === undefined
        ? null
        : Number(watchedMaxDiscountAmount);

    const selectedBrandName = optionsData?.brands?.find(
      (brand: any) => brand.id === watchedBrandId,
    )?.name;

    const allVariants = optionsData?.variants || [];
    const singleVariantName = allVariants.find(
      (variant: any) => variant.id === watchedVariantId,
    )?.name;

    const bundleVariantNames = (watchedVariantIds || [])
      .map((id: number) =>
        allVariants.find((variant: any) => variant.id === id)?.name,
      )
      .filter(Boolean);

    const branchNames = (watchedBranchIds || [])
      .map(
        (id: number) =>
          optionsData?.branches?.find((branch: any) => branch.id === id)?.name,
      )
      .filter(Boolean);

    const discountText =
      watchedDiscountType === "percentage"
        ? `${discountValue}% off`
        : `${formatCurrency(discountValue)} off per eligible item`;

    let scopeText = "matching cart items";
    if (selectedScope === "BRAND") {
      scopeText = selectedBrandName
        ? `items from brand ${selectedBrandName}`
        : "items from the selected brand";
    } else if (selectedScope === "SINGLE_PRODUCT") {
      scopeText = singleVariantName
        ? `variant ${singleVariantName}`
        : "the selected variant";
    } else if (selectedScope === "BUNDLE") {
      scopeText = bundleVariantNames.length
        ? `bundle items (${bundleVariantNames.join(", ")})`
        : "the selected bundle variants";
    }

    const lines: string[] = [];
    lines.push(`${discountText} on ${scopeText}.`);

    if (minPurchase > 0) {
      lines.push(`Requires minimum purchase of ${formatCurrency(minPurchase)}.`);
    }

    lines.push(`Requires at least ${minQuantity} matching item(s).`);

    if (capQuantity && capQuantity > 0) {
      lines.push(`Applies to up to ${capQuantity} item(s) per sale.`);
    } else {
      lines.push("Applies to all matching quantities in the sale.");
    }

    if (capDiscountAmount && capDiscountAmount > 0) {
      lines.push(
        `Per-sale promotion discount is capped at ${formatCurrency(capDiscountAmount)}.`,
      );
    }

    if (usageLimit && usageLimit > 0) {
      lines.push(`Can be used up to ${usageLimit} sale(s) in total.`);
    }

    if (maxDiscountAmount && maxDiscountAmount > 0) {
      lines.push(
        `Promotion closes after total distributed discount reaches ${formatCurrency(maxDiscountAmount)}.`,
      );
    }

    if (watchedMemberOnly) {
      lines.push("Only registered customers are eligible.");
    }

    if (watchedLimitPerCustomer) {
      if (watchedCustomerUsageLimit) {
        lines.push(
          `Each customer can use this up to ${watchedCustomerUsageLimit} time(s)${watchedCustomerUsageDailyReset ? " per day" : ""}.`,
        );
      } else {
        lines.push("Per-customer usage limit is enabled.");
      }
    }

    if (watchedBranchSpecific) {
      lines.push(
        branchNames.length
          ? `Available only in branches: ${branchNames.join(", ")}.`
          : "Available only in selected branches.",
      );
    } else {
      lines.push("Available in all branches.");
    }

    if (watchedAutoApply) {
      lines.push("Automatically applies when cart conditions are met.");
    }

    if (watchedStartDate) {
      const startText = dayjs(watchedStartDate).format("YYYY-MM-DD");
      const endText = watchedEndDate
        ? dayjs(watchedEndDate).format("YYYY-MM-DD")
        : "no end date";
      lines.push(`Valid from ${startText} to ${endText}.`);
    }

    return lines.join(" ");
  }, [
    optionsData,
    selectedScope,
    watchedAutoApply,
    watchedBranchIds,
    watchedBranchSpecific,
    watchedCapDiscountAmount,
    watchedCapQuantity,
    watchedCustomerUsageDailyReset,
    watchedCustomerUsageLimit,
    watchedDiscountType,
    watchedDiscountValue,
    watchedBrandId,
    watchedEndDate,
    watchedLimitPerCustomer,
    watchedMaxDiscountAmount,
    watchedMemberOnly,
    watchedMinPurchase,
    watchedMinQuantity,
    watchedStartDate,
    watchedUsageLimit,
    watchedVariantId,
    watchedVariantIds,
  ]);

  useEffect(() => {
    if (generatedDescription && watchedDescription !== generatedDescription) {
      form.setFieldValue("description", generatedDescription);
    }
  }, [form, generatedDescription, watchedDescription]);

  const onFinish = (values: any) => {
    const normalizedVariantIds =
      values.scope === "BRAND"
        ? undefined
        : values.scope === "SINGLE_PRODUCT"
          ? values.variant_id
            ? [values.variant_id]
            : []
          : values.variant_ids || [];

    if ((values.scope === "SINGLE_PRODUCT" || values.scope === "BUNDLE") && normalizedVariantIds.length === 0) {
      messageApi?.error("Please select product variant(s)");
      return;
    }

    if (values.scope === "BRAND" && !values.brand_id) {
      messageApi?.error("Please select a brand");
      return;
    }

    const payload: any = {
      name: values.name,
      description: values.description,
      scope: values.scope,
      discount_type: values.discount_type,
      discount_value: Number(values.discount_value),
      start_date: values.start_date.toISOString(),
      end_date: values.end_date ? values.end_date.toISOString() : undefined,
      is_active: Boolean(values.is_active),
      min_purchase:
        values.min_purchase === null || values.min_purchase === undefined
          ? null
          : Number(values.min_purchase),
      min_quantity:
        values.min_quantity === null || values.min_quantity === undefined
          ? 1
          : Number(values.min_quantity),
      usage_limit:
        values.usage_limit === null || values.usage_limit === undefined
          ? null
          : Number(values.usage_limit),
      cap_quantity:
        values.cap_quantity === null || values.cap_quantity === undefined
          ? null
          : Number(values.cap_quantity),
      cap_discount_amount:
        values.cap_discount_amount === null ||
        values.cap_discount_amount === undefined
          ? null
          : Number(values.cap_discount_amount),
      max_discount_amount:
        values.max_discount_amount === null ||
        values.max_discount_amount === undefined
          ? null
          : Number(values.max_discount_amount),
      member_only: Boolean(values.member_only),
      limit_per_customer: Boolean(values.limit_per_customer),
      customer_usage_limit: values.limit_per_customer
        ? values.customer_usage_limit === null ||
          values.customer_usage_limit === undefined
          ? null
          : Number(values.customer_usage_limit)
        : null,
      customer_usage_daily_reset: values.limit_per_customer
        ? Boolean(values.customer_usage_daily_reset)
        : false,
      auto_apply: Boolean(values.auto_apply),
      branch_specific: Boolean(values.branch_specific),
      branch_ids: values.branch_specific ? values.branch_ids || [] : [],
      brand_id: values.scope === "BRAND" ? values.brand_id : undefined,
      variant_ids: normalizedVariantIds,
    };

    if (isEditing && editedItem) {
      updateMutation.mutate({ id: editedItem.id, payload });
      return;
    }

    createMutation.mutate(payload);
  };

  useEffect(() => {
    if (isEditing && editedItem) {
      form.setFieldsValue({
        name: editedItem.name,
        description: editedItem.description,
        scope: editedItem.scope,
        discount_type: editedItem.discount_type,
        discount_value: editedItem.discount_value,
        start_date: dayjs(editedItem.start_date),
        end_date: editedItem.end_date ? dayjs(editedItem.end_date) : null,
        is_active: editedItem.is_active,
        min_purchase: editedItem.min_purchase ?? null,
        min_quantity: editedItem.min_quantity ?? 1,
        usage_limit: editedItem.usage_limit ?? null,
        cap_quantity: editedItem.cap_quantity ?? null,
        cap_discount_amount: editedItem.cap_discount_amount ?? null,
        max_discount_amount: editedItem.max_discount_amount ?? null,
        member_only: editedItem.member_only,
        limit_per_customer: editedItem.limit_per_customer,
        customer_usage_limit: editedItem.customer_usage_limit ?? null,
        customer_usage_daily_reset: editedItem.customer_usage_daily_reset,
        auto_apply: editedItem.auto_apply,
        branch_specific: editedItem.branch_specific,
        branch_ids: editedItem.branch_ids || [],
        brand_id: editedItem.brand_id,
        variant_id: editedItem.variant_ids?.[0],
        variant_ids: editedItem.variant_ids || [],
      });
    } else {
      form.setFieldsValue({
        scope: "SINGLE_PRODUCT",
        discount_type: "percentage",
        is_active: true,
        min_quantity: 1,
        min_purchase: null,
        usage_limit: null,
        cap_quantity: null,
        cap_discount_amount: null,
        max_discount_amount: null,
        member_only: false,
        limit_per_customer: false,
        customer_usage_limit: null,
        customer_usage_daily_reset: false,
        auto_apply: false,
        branch_specific: false,
      });
    }
  }, [isEditing, editedItem, form]);

  return (
    <Drawer
      title={isEditing ? "Update Promotion" : "Add Promotion"}
      onClose={onClose}
      width={560}
      open={open}
      style={{ maxHeight: "100vh", overflowY: "auto" }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        autoComplete="off"
      >
        <Form.Item
          label="Promotion Name"
          name="name"
          rules={[{ required: true, message: "Name is required" }]}
        >
          <Input placeholder="e.g. Weekend Combo Offer" />
        </Form.Item>

        <Form.Item label="Description (Auto)" name="description">
          <Input.TextArea
            rows={4}
            disabled
            placeholder="Description is generated automatically from the selected promotion rules"
          />
        </Form.Item>

        <Space style={{ width: "100%" }} size={12}>
          <Form.Item
            label="Scope"
            name="scope"
            style={{ flex: 1 }}
            rules={[{ required: true }]}
          >
            <Select options={scopeOptions} />
          </Form.Item>

          <Form.Item
            label="Discount Type"
            name="discount_type"
            style={{ flex: 1 }}
            rules={[{ required: true }]}
          >
            <Select options={discountTypeOptions} />
          </Form.Item>
        </Space>

        <Space style={{ width: "100%" }} size={12}>
          <Form.Item
            label="Discount Value"
            name="discount_value"
            style={{ flex: 1 }}
            rules={[{ required: true, message: "Discount value is required" }]}
          >
            <InputNumber min={0.01} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item label="Min Purchase" name="min_purchase" style={{ flex: 1 }}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Space>

        <Space style={{ width: "100%" }} size={12}>
          <Form.Item
            label="Usage Limit"
            name="usage_limit"
            style={{ flex: 1 }}
          >
            <InputNumber min={1} style={{ width: "100%" }} placeholder="Total times promo can be used" />
          </Form.Item>

          <Form.Item label="Cap Quantity" name="cap_quantity" style={{ flex: 1 }}>
            <InputNumber min={1} style={{ width: "100%" }} placeholder="Per-sale qty cap" />
          </Form.Item>
        </Space>

        <Space style={{ width: "100%" }} size={12}>
          <Form.Item
            label="Closing Discount Amount"
            name="max_discount_amount"
            style={{ flex: 1 }}
          >
            <InputNumber min={0} style={{ width: "100%" }} placeholder="Global close amount" />
          </Form.Item>

          <Form.Item
            label="Cap Discount Amount"
            name="cap_discount_amount"
            style={{ flex: 1 }}
          >
            <InputNumber min={0} style={{ width: "100%" }} placeholder="Per-sale cap" />
          </Form.Item>
        </Space>

        <Space style={{ width: "100%" }} size={12}>
          <Form.Item
            label="Member Promo Only"
            name="member_only"
            valuePropName="checked"
            style={{ flex: 1 }}
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label="Limit Per Customer"
            name="limit_per_customer"
            valuePropName="checked"
            style={{ flex: 1 }}
          >
            <Switch />
          </Form.Item>
        </Space>

        {limitPerCustomer ? (
          <Space style={{ width: "100%" }} size={12}>
            <Form.Item
              label="Customer Usage Limit"
              name="customer_usage_limit"
              style={{ flex: 1 }}
              rules={[{ required: true, message: "Usage limit is required" }]}
            >
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item
              label="Daily Reset"
              name="customer_usage_daily_reset"
              valuePropName="checked"
              style={{ flex: 1 }}
            >
              <Switch />
            </Form.Item>
          </Space>
        ) : null}

        <Space style={{ width: "100%" }} size={12}>
          <Form.Item label="Start Date" name="start_date" style={{ flex: 1 }} rules={[{ required: true }]}> 
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item label="End Date" name="end_date" style={{ flex: 1 }}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
        </Space>

        {selectedScope === "BRAND" ? (
          <Form.Item label="Brand" name="brand_id" rules={[{ required: true, message: "Select a brand" }]}>
            <Select
              showSearch
              options={(optionsData?.brands || []).map((brand) => ({
                label: brand.name,
                value: brand.id,
              }))}
            />
          </Form.Item>
        ) : selectedScope === "SINGLE_PRODUCT" ? (
          <Form.Item
            label="Variant"
            name="variant_id"
            rules={[{ required: true, message: "Select a variant" }]}
          >
            <Select showSearch options={variantOptions} />
          </Form.Item>
        ) : (
          <Form.Item
            label="Bundle Variants"
            name="variant_ids"
            rules={[{ required: true, message: "Select bundle variants" }]}
          >
            <Select mode="multiple" showSearch options={variantOptions} />
          </Form.Item>
        )}

        <Space style={{ width: "100%" }} size={12}>
          <Form.Item label="Min Quantity" name="min_quantity" style={{ flex: 1 }}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item label="Auto Apply" name="auto_apply" valuePropName="checked" style={{ flex: 1 }}>
            <Switch />
          </Form.Item>
        </Space>

        <Space style={{ width: "100%" }} size={12}>
          <Form.Item label="Active" name="is_active" valuePropName="checked" style={{ flex: 1 }}>
            <Switch />
          </Form.Item>

          <Form.Item
            label="Branch Specific"
            name="branch_specific"
            valuePropName="checked"
            style={{ flex: 1 }}
          >
            <Switch />
          </Form.Item>
        </Space>

        {branchSpecific ? (
          <Form.Item
            label="Branches"
            name="branch_ids"
            rules={[{ required: true, message: "Select at least one branch" }]}
          >
            <Select
              mode="multiple"
              showSearch
              options={(optionsData?.branches || []).map((branch) => ({
                label: branch.name,
                value: branch.id,
              }))}
            />
          </Form.Item>
        ) : null}

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={createMutation.isPending || updateMutation.isPending}
          >
            {isEditing ? "Update Promotion" : "Create Promotion"}
          </Button>
        </Form.Item>
      </Form>
    </Drawer>
  );
}
