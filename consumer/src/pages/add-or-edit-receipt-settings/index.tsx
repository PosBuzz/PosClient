// src/pages/settings/ReceiptSettingsFormPage.tsx

import { EyeOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Form,
  FormInstance,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Slider,
  Space,
  Switch,
  Typography,
} from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { inventoryApi } from "../../api/inventory-api";
import {
  ReceiptPresetType,
  receiptSettingsApi,
} from "../../api/receipt-settings-api";
import CenterLoader from "../../components/CenterLoader";
import PageTitle from "../../components/PageTitle";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { useMessageStore } from "../../stores/messageStore";
import { setPageTitle } from "../../utils/setPageTitle";

const { Text } = Typography;
const { TextArea } = Input;

const PAGE_SIZE_OPTIONS = [
  { label: "A4 (210 × 297 mm)", value: "A4" },
  { label: "A5 (148 × 210 mm)", value: "A5" },
  { label: "A6 (105 × 148 mm) — labels/stickers", value: "A6" },
  { label: "Letter (8.5 × 11 in)", value: "LETTER" },
  { label: "Legal (8.5 × 14 in)", value: "LEGAL" },
];

function deepMerge(target: any, source: any): any {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      source[key] !== undefined &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key])
    ) {
      out[key] = deepMerge(target[key] ?? {}, source[key]);
    } else if (source[key] !== undefined) {
      out[key] = source[key];
    }
  }
  return out;
}

const SECTION_CHILDREN_MAP: Record<string, string[][]> = {
  header: [["settings", "header", "showLogo"]],
  storeInfo: [
    ["settings", "storeInfo", "showStoreName"],
    ["settings", "storeInfo", "showBranchName"],
    ["settings", "storeInfo", "showAddress"],
    ["settings", "storeInfo", "showPhone"],
    ["settings", "storeInfo", "showEmail"],
    ["settings", "storeInfo", "showVatRegistration"],
  ],
  orderInfo: [
    ["settings", "orderInfo", "showSaleNumber"],
    ["settings", "orderInfo", "showDate"],
    ["settings", "orderInfo", "showSaleType"],
    ["settings", "orderInfo", "showPriceType"],
    ["settings", "orderInfo", "showCashier"],
    ["settings", "orderInfo", "showServedBy"],
  ],
  customerInfo: [
    ["settings", "customerInfo", "showName"],
    ["settings", "customerInfo", "showPhone"],
    ["settings", "customerInfo", "showEmail"],
    ["settings", "customerInfo", "showAddress"],
    ["settings", "customerInfo", "showRewardPoints"],
  ],
  items: [
    ["settings", "items", "showVariantName"],
    ["settings", "items", "showSku"],
    ["settings", "items", "showQuantity"],
    ["settings", "items", "showUnitPrice"],
    ["settings", "items", "showDiscount"],
    ["settings", "items", "showTax"],
    ["settings", "items", "showLineTotal"],
  ],
  totals: [
    ["settings", "totals", "showSubtotal"],
    ["settings", "totals", "showDiscount"],
    ["settings", "totals", "showShipping"],
    ["settings", "totals", "showTax"],
  ],
  payment: [
    ["settings", "payment", "showBreakdown"],
    ["settings", "payment", "showReceivedAmount"],
    ["settings", "payment", "showChangeAmount"],
    ["settings", "payment", "showDueAmount"],
    ["settings", "payment", "showPaymentDate"],
    ["settings", "payment", "showReference"],
  ],
};

function handleMasterToggleSync(form: FormInstance, changedValues: any) {
  if (!changedValues?.settings) return;
  const settings = changedValues.settings;

  for (const [sectionKey, sectionValue] of Object.entries(settings)) {
    if (sectionValue && typeof sectionValue === "object") {
      const sv = sectionValue as Record<string, any>;
      if ("show" in sv) {
        const checked = sv.show;
        const children = SECTION_CHILDREN_MAP[sectionKey];
        if (children) {
          setTimeout(() => {
            children.forEach((childName) => {
              form.setFieldValue(childName, checked);
            });
          }, 0);
        }
      }
    }
  }
}

function SectionToggle({ label, name }: { label: string; name: string[] }) {
  return (
    <div
      style={{
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Form.Item name={name} valuePropName="checked" noStyle>
        <Switch checkedChildren="On" unCheckedChildren="Off" />
      </Form.Item>
      <Text strong>{label}</Text>
    </div>
  );
}

function ToggleItem({
  label,
  name,
  disabled,
}: {
  label: string;
  name: string[];
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 8,
      }}
    >
      <Form.Item name={name} valuePropName="checked" noStyle>
        <Switch size="small" disabled={disabled} />
      </Form.Item>
      <Text type={disabled ? "secondary" : undefined} style={{ fontSize: 13 }}>
        {label}
      </Text>
    </div>
  );
}

export default function ReceiptSettingsFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const queryClient = useQueryClient();
  const { messageApi } = useMessageStore();

  const [form] = Form.useForm();
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewUrlRef = useRef<string>("");

  const storeInfoShow = Form.useWatch(["settings", "storeInfo", "show"], form);
  const headerShow = Form.useWatch(["settings", "header", "show"], form);
  const orderInfoShow = Form.useWatch(["settings", "orderInfo", "show"], form);
  const customerInfoShow = Form.useWatch(
    ["settings", "customerInfo", "show"],
    form,
  );
  const itemsShow = Form.useWatch(["settings", "items", "show"], form);
  const totalsShow = Form.useWatch(["settings", "totals", "show"], form);
  const paymentShow = Form.useWatch(["settings", "payment", "show"], form);
  const paymentBreakdown = Form.useWatch(
    ["settings", "payment", "showBreakdown"],
    form,
  );
  const settingsType = Form.useWatch(["type"], form) as
    | ReceiptPresetType
    | undefined;

  const { data: branches = [] } = useQuery({
    queryKey: [queryKeys.branches],
    queryFn: () => inventoryApi.getBranches(),
    staleTime: queryStaleTimeMap[queryKeys.branches],
  });

  const { data: existingSetting, isLoading: settingLoading } = useQuery({
    queryKey: [queryKeys.receiptSettings, id],
    queryFn: () => receiptSettingsApi.getById(parseInt(id!)),
    enabled: isEdit && !!id,
    staleTime: queryStaleTimeMap[queryKeys.receiptSettings],
  });

  const { data: presetDefaultsForEdit } = useQuery({
    queryKey: [queryKeys.receiptSettingDefaults, existingSetting?.type],
    queryFn: () => receiptSettingsApi.getDefaults(existingSetting!.type),
    enabled: isEdit && !!existingSetting?.type,
    staleTime: Infinity,
  });

  const { data: presetDefaultsForCreate } = useQuery({
    queryKey: [queryKeys.receiptSettingDefaults, settingsType],
    queryFn: () => receiptSettingsApi.getDefaults(settingsType!),
    enabled: !!settingsType && !isEdit,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!isEdit && presetDefaultsForCreate && settingsType) {
      form.setFieldValue("settings", presetDefaultsForCreate);
    }
  }, [presetDefaultsForCreate, settingsType, isEdit, form]);

  useEffect(() => {
    if (existingSetting) {
      const mergedSettings = presetDefaultsForEdit
        ? deepMerge(presetDefaultsForEdit, existingSetting.settings)
        : existingSetting.settings;

      form.setFieldsValue({
        name: existingSetting.name,
        type: existingSetting.type,
        branchId: existingSetting.branch_id,
        settings: mergedSettings,
      });
    }
  }, [existingSetting, presetDefaultsForEdit, form]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const createMutation = useMutation({
    mutationFn: receiptSettingsApi.create,
    onSuccess: () => {
      messageApi?.success("Setting created successfully");
      queryClient.invalidateQueries({ queryKey: [queryKeys.receiptSettings] });
      navigate("/printer-settings");
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to create setting",
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      receiptSettingsApi.update(id, data),
    onSuccess: () => {
      messageApi?.success("Setting updated successfully");
      queryClient.invalidateQueries({ queryKey: [queryKeys.receiptSettings] });
      navigate("/printer-settings");
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to update setting",
      );
    },
  });

  const handlePreview = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setPreviewLoading(true);
      setPreviewVisible(true);

      const blob = await receiptSettingsApi.generatePreview({
        settings: values.settings,
        type: values.type,
        branchId: values.branchId ?? null,
      });

      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreviewUrl(url);
    } catch (error: any) {
      if (error.errorFields) {
        messageApi?.error("Please fix form errors before previewing");
        setPreviewVisible(false);
      } else {
        messageApi?.error("Failed to generate preview");
        setPreviewVisible(false);
      }
    } finally {
      setPreviewLoading(false);
    }
  }, [form, messageApi]);

  const handleClosePreview = () => {
    setPreviewVisible(false);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
    setPreviewUrl("");
  };

  const handleLoadDefaults = () => {
    if (!settingsType) {
      messageApi?.warning("Please select a type first");
      return;
    }
    if (presetDefaultsForCreate) {
      form.setFieldValue("settings", presetDefaultsForCreate);
      messageApi?.success("Preset defaults loaded");
    }
  };

  const handleSubmit = async (values: any) => {
    const payload = {
      name: values.name,
      type: values.type,
      branchId: values.branchId ?? null,
      settings: values.settings,
      isActive: false,
    };

    if (isEdit && id) {
      updateMutation.mutate({
        id: parseInt(id),
        data: { name: values.name, settings: values.settings },
      });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (isEdit && settingLoading) return <CenterLoader />;

  const submitLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      {setPageTitle(isEdit ? "Edit Receipt Setting" : "Create Receipt Setting")}
      <PageTitle
        title={isEdit ? "Edit Receipt Setting" : "Create Receipt Setting"}
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Settings", href: "/printer-settings" },
          { title: "Receipt PDF" },
          { title: isEdit ? "Edit" : "Create" },
        ]}
        rightSection={
          <Space>
            {!isEdit && (
              <Button icon={<ReloadOutlined />} onClick={handleLoadDefaults}>
                Load Preset Defaults
              </Button>
            )}
            <Button icon={<EyeOutlined />} onClick={handlePreview}>
              Preview
            </Button>
          </Space>
        }
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
        onValuesChange={(changedValues) =>
          handleMasterToggleSync(form, changedValues)
        }
        initialValues={{ type: "receipt", branchId: null, settings: {} }}
      >
        {/* Basic Info */}
        <Card title="Basic Information" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 8]}>
            <Col xs={24} sm={8}>
              <Form.Item
                name="name"
                label="Setting Name"
                rules={[{ required: true, message: "Please enter a name" }]}
              >
                <Input placeholder="e.g., Default Receipt, Branch Custom" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                name="type"
                label="Type"
                rules={[{ required: true, message: "Please select a type" }]}
              >
                <Select disabled={isEdit}>
                  <Select.Option value="receipt">Receipt</Select.Option>
                  <Select.Option value="quotation">Quotation</Select.Option>
                  <Select.Option value="return">Return Receipt</Select.Option>
                  <Select.Option value="chalan">Delivery Chalan</Select.Option>
                  <Select.Option value="money_receipt">
                    Money Receipt
                  </Select.Option>
                  <Select.Option value="delivery_slip">
                    Delivery Slip / Sticker
                  </Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="branchId" label="Branch Scope">
                <Select
                  disabled={isEdit}
                  placeholder="Consumer Default (all branches)"
                  allowClear
                >
                  <Select.Option value={null as any}>
                    Consumer Default (all branches)
                  </Select.Option>
                  {branches.map((b) => (
                    <Select.Option key={b.id} value={b.id}>
                      {b.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          {!isEdit && (
            <Alert
              message="Consumer-level settings apply to all branches unless overridden by a branch-specific setting. Only one setting can be active per scope per type."
              type="info"
              showIcon
              style={{ marginTop: 8 }}
            />
          )}
        </Card>

        {/* Settings Sections */}
        <Collapse
          defaultActiveKey={[
            "page",
            "header",
            "storeInfo",
            "orderInfo",
            "customerInfo",
            "items",
            "totals",
            "payment",
            "notes",
            "footer",
            "fonts",
          ]}
          style={{ marginBottom: 16 }}
        >
          {/* Page & Layout */}
          <Collapse.Panel header="Page & Layout" key="page">
            <Row gutter={[16, 8]}>
              <Col xs={24} sm={8}>
                <Form.Item
                  name={["settings", "page", "size"]}
                  label="Page Size"
                >
                  <Select>
                    {PAGE_SIZE_OPTIONS.map((opt) => (
                      <Select.Option key={opt.value} value={opt.value}>
                        {opt.label}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              {/* Currency Settings Added Here */}
              <Col xs={24} sm={8}>
                <Form.Item
                  name={["settings", "currencySymbol"]}
                  label="Currency Symbol"
                >
                  <Select>
                    <Select.Option value="৳">৳</Select.Option>
                    <Select.Option value="$">$</Select.Option>
                    <Select.Option value="€">€</Select.Option>
                    <Select.Option value="£">£</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  name={["settings", "currencyPosition"]}
                  label="Currency Position"
                >
                  <Select>
                    <Select.Option value="before">
                      Before Amount (৳100)
                    </Select.Option>
                    <Select.Option value="after">
                      After Amount (100৳)
                    </Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Text
              type="secondary"
              style={{ display: "block", marginBottom: 12 }}
            >
              Margins (points)
            </Text>
            <Row gutter={[16, 8]}>
              <Col xs={12} sm={6}>
                <Form.Item
                  name={["settings", "page", "margins", "top"]}
                  label="Top"
                >
                  <InputNumber min={0} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col xs={12} sm={6}>
                <Form.Item
                  name={["settings", "page", "margins", "right"]}
                  label="Right"
                >
                  <InputNumber min={0} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col xs={12} sm={6}>
                <Form.Item
                  name={["settings", "page", "margins", "bottom"]}
                  label="Bottom"
                >
                  <InputNumber min={0} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col xs={12} sm={6}>
                <Form.Item
                  name={["settings", "page", "margins", "left"]}
                  label="Left"
                >
                  <InputNumber min={0} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
            </Row>
          </Collapse.Panel>

          {/* Header */}
          <Collapse.Panel header="Header" key="header">
            <SectionToggle
              label="Show Header"
              name={["settings", "header", "show"]}
            />
            <Row gutter={[16, 12]}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name={["settings", "header", "text"]}
                  label="Header Text"
                >
                  <Input placeholder="RECEIPT" disabled={!headerShow} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={6}>
                <Form.Item
                  name={["settings", "header", "layout"]}
                  label="Layout"
                >
                  <Select disabled={!headerShow}>
                    <Select.Option value="center">Center</Select.Option>
                    <Select.Option value="logo-left">Logo Left</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={[16, 8]} style={{ marginTop: 8 }}>
              <Col>
                <ToggleItem
                  label="Show Logo"
                  name={["settings", "header", "showLogo"]}
                  disabled={!headerShow}
                />
              </Col>
            </Row>
            {headerShow && (
              <Row gutter={[16, 8]} style={{ marginTop: 12 }}>
                <Col xs={12} sm={6}>
                  <Form.Item
                    name={["settings", "header", "logoMaxWidth"]}
                    label="Logo Max Width"
                  >
                    <InputNumber min={20} max={500} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6}>
                  <Form.Item
                    name={["settings", "header", "logoMaxHeight"]}
                    label="Logo Max Height"
                  >
                    <InputNumber min={20} max={300} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
              </Row>
            )}
          </Collapse.Panel>

          {/* Store Info */}
          <Collapse.Panel header="Store Information" key="storeInfo">
            <SectionToggle
              label="Show Store Info"
              name={["settings", "storeInfo", "show"]}
            />
            <Row gutter={[16, 12]} style={{ marginTop: 8 }}>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Store Name"
                  name={["settings", "storeInfo", "showStoreName"]}
                  disabled={!storeInfoShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Branch Name"
                  name={["settings", "storeInfo", "showBranchName"]}
                  disabled={!storeInfoShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Address"
                  name={["settings", "storeInfo", "showAddress"]}
                  disabled={!storeInfoShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Phone"
                  name={["settings", "storeInfo", "showPhone"]}
                  disabled={!storeInfoShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Email"
                  name={["settings", "storeInfo", "showEmail"]}
                  disabled={!storeInfoShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="VAT Registration"
                  name={["settings", "storeInfo", "showVatRegistration"]}
                  disabled={!storeInfoShow}
                />
              </Col>
            </Row>
          </Collapse.Panel>

          {/* Order Info */}
          <Collapse.Panel header="Order Information" key="orderInfo">
            <SectionToggle
              label="Show Order Info"
              name={["settings", "orderInfo", "show"]}
            />
            <Row gutter={[16, 12]} style={{ marginTop: 8 }}>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Sale Number"
                  name={["settings", "orderInfo", "showSaleNumber"]}
                  disabled={!orderInfoShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Date"
                  name={["settings", "orderInfo", "showDate"]}
                  disabled={!orderInfoShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Sale Type"
                  name={["settings", "orderInfo", "showSaleType"]}
                  disabled={!orderInfoShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Price Type"
                  name={["settings", "orderInfo", "showPriceType"]}
                  disabled={!orderInfoShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Cashier"
                  name={["settings", "orderInfo", "showCashier"]}
                  disabled={!orderInfoShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Served By"
                  name={["settings", "orderInfo", "showServedBy"]}
                  disabled={!orderInfoShow}
                />
              </Col>
            </Row>
          </Collapse.Panel>

          {/* Customer Info */}
          <Collapse.Panel header="Customer Information" key="customerInfo">
            <SectionToggle
              label="Show Customer Info"
              name={["settings", "customerInfo", "show"]}
            />
            <Row gutter={[16, 12]} style={{ marginTop: 8 }}>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Name"
                  name={["settings", "customerInfo", "showName"]}
                  disabled={!customerInfoShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Phone"
                  name={["settings", "customerInfo", "showPhone"]}
                  disabled={!customerInfoShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Email"
                  name={["settings", "customerInfo", "showEmail"]}
                  disabled={!customerInfoShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Address"
                  name={["settings", "customerInfo", "showAddress"]}
                  disabled={!customerInfoShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Reward Points"
                  name={["settings", "customerInfo", "showRewardPoints"]}
                  disabled={!customerInfoShow}
                />
              </Col>
            </Row>
          </Collapse.Panel>

          {/* Items Table */}
          <Collapse.Panel header="Items Table" key="items">
            <SectionToggle
              label="Show Items Table"
              name={["settings", "items", "show"]}
            />
            <Row gutter={[16, 12]} style={{ marginTop: 8 }}>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Product Name / Variant"
                  name={["settings", "items", "showVariantName"]}
                  disabled={!itemsShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="SKU"
                  name={["settings", "items", "showSku"]}
                  disabled={!itemsShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Quantity"
                  name={["settings", "items", "showQuantity"]}
                  disabled={!itemsShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Unit Price"
                  name={["settings", "items", "showUnitPrice"]}
                  disabled={!itemsShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Discount"
                  name={["settings", "items", "showDiscount"]}
                  disabled={!itemsShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Tax"
                  name={["settings", "items", "showTax"]}
                  disabled={!itemsShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Line Total"
                  name={["settings", "items", "showLineTotal"]}
                  disabled={!itemsShow}
                />
              </Col>
            </Row>
            {itemsShow && (
              <Row gutter={[16, 8]} style={{ marginTop: 16 }}>
                <Col xs={24} sm={8}>
                  <Form.Item
                    name={["settings", "items", "discountDisplay"]}
                    label="Discount Display"
                  >
                    <Select>
                      <Select.Option value="total">Total Only</Select.Option>
                      <Select.Option value="breakdown">
                        Breakdown (Special, Promo, Avg)
                      </Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item
                    name={["settings", "items", "taxDisplay"]}
                    label="Tax Display"
                  >
                    <Select>
                      <Select.Option value="total">Total Only</Select.Option>
                      <Select.Option value="breakdown">
                        Breakdown (Rate & Method)
                      </Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            )}
          </Collapse.Panel>

          {/* Totals */}
          <Collapse.Panel header="Totals" key="totals">
            <SectionToggle
              label="Show Totals"
              name={["settings", "totals", "show"]}
            />
            <Row gutter={[16, 8]} style={{ marginTop: 8 }}>
              <Col xs={24} sm={8}>
                <Form.Item
                  name={["settings", "totals", "titleAlign"]}
                  label="Totals Position"
                >
                  <Select disabled={!totalsShow}>
                    <Select.Option value="left">Regular</Select.Option>
                    <Select.Option value="right">Right aligned</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={[16, 12]} style={{ marginTop: 8 }}>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Subtotal"
                  name={["settings", "totals", "showSubtotal"]}
                  disabled={!totalsShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Discount"
                  name={["settings", "totals", "showDiscount"]}
                  disabled={!totalsShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Shipping"
                  name={["settings", "totals", "showShipping"]}
                  disabled={!totalsShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Tax"
                  name={["settings", "totals", "showTax"]}
                  disabled={!totalsShow}
                />
              </Col>
            </Row>
          </Collapse.Panel>

          {/* Payment */}
          <Collapse.Panel header="Payment" key="payment">
            <SectionToggle
              label="Show Payment Info"
              name={["settings", "payment", "show"]}
            />
            <Row gutter={[16, 8]} style={{ marginTop: 8 }}>
              <Col xs={24} sm={8}>
                <Form.Item
                  name={["settings", "payment", "titleAlign"]}
                  label="Payment Position"
                >
                  <Select disabled={!paymentShow}>
                    <Select.Option value="left">Regular</Select.Option>
                    <Select.Option value="right">Right aligned</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={[16, 12]} style={{ marginTop: 8 }}>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Payment Breakdown"
                  name={["settings", "payment", "showBreakdown"]}
                  disabled={!paymentShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Received Amount"
                  name={["settings", "payment", "showReceivedAmount"]}
                  disabled={!paymentShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Change"
                  name={["settings", "payment", "showChangeAmount"]}
                  disabled={!paymentShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Due Amount"
                  name={["settings", "payment", "showDueAmount"]}
                  disabled={!paymentShow}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Payment Date"
                  name={["settings", "payment", "showPaymentDate"]}
                  disabled={!paymentShow || !paymentBreakdown}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Reference / Txn ID"
                  name={["settings", "payment", "showReference"]}
                  disabled={!paymentShow || !paymentBreakdown}
                />
              </Col>
            </Row>
            {paymentShow && !paymentBreakdown && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Payment date and reference are printed per payment line, so they
                need "Payment Breakdown" turned on.
              </Text>
            )}
          </Collapse.Panel>

          {/* Notes */}
          <Collapse.Panel header="Notes" key="notes">
            <SectionToggle
              label="Show Notes"
              name={["settings", "notes", "show"]}
            />
          </Collapse.Panel>

          {/* Footer */}
          <Collapse.Panel header="Footer" key="footer">
            <Row gutter={[16, 12]}>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Barcode"
                  name={["settings", "footer", "showBarcode"]}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Terms & Conditions"
                  name={["settings", "footer", "showTerms"]}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Thank You Message"
                  name={["settings", "footer", "showThankYou"]}
                />
              </Col>
              <Col xs={12} sm={8}>
                <ToggleItem
                  label="Print Date"
                  name={["settings", "footer", "showPrintDate"]}
                />
              </Col>
            </Row>
            {/* Footer Terms Text Added Here */}
            <Row gutter={[16, 12]} style={{ marginTop: 16 }}>
              <Col xs={24}>
                <Form.Item
                  name={["settings", "footer", "termsText"]}
                  label="Terms & Conditions Text"
                >
                  <TextArea
                    rows={3}
                    placeholder="e.g., All sales are final. Items must be returned within 7 days..."
                  />
                </Form.Item>
              </Col>
            </Row>
          </Collapse.Panel>

          {/* Font Sizes */}
          <Collapse.Panel header="Font Sizes" key="fonts">
            <Row gutter={[24, 16]}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name={["settings", "fontSizes", "title"]}
                  label="Title"
                >
                  <Slider
                    min={14}
                    max={32}
                    step={1}
                    marks={{ 14: "14", 20: "20", 32: "32" }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name={["settings", "fontSizes", "subtitle"]}
                  label="Subtitle"
                >
                  <Slider
                    min={10}
                    max={24}
                    step={1}
                    marks={{ 10: "10", 16: "16", 24: "24" }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name={["settings", "fontSizes", "heading"]}
                  label="Heading"
                >
                  <Slider
                    min={8}
                    max={20}
                    step={1}
                    marks={{ 8: "8", 13: "13", 20: "20" }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name={["settings", "fontSizes", "body"]}
                  label="Body"
                >
                  <Slider
                    min={6}
                    max={16}
                    step={1}
                    marks={{ 6: "6", 10: "10", 16: "16" }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name={["settings", "fontSizes", "small"]}
                  label="Small"
                >
                  <Slider
                    min={4}
                    max={12}
                    step={1}
                    marks={{ 4: "4", 8: "8", 12: "12" }}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Collapse.Panel>
        </Collapse>

        {/* Action Buttons */}
        <Card>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Space>
              <Button icon={<EyeOutlined />} onClick={handlePreview}>
                Preview Before Saving
              </Button>
            </Space>
            <Space>
              <Button onClick={() => navigate("/printer-settings")}>
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitLoading}
                icon={<SaveOutlined />}
              >
                {isEdit ? "Update Setting" : "Create Setting"}
              </Button>
            </Space>
          </div>
        </Card>
      </Form>

      {/* Preview Modal */}
      <Modal
        title="Sample Receipt Preview"
        open={previewVisible}
        onCancel={handleClosePreview}
        width={800}
        footer={[
          <Button key="close" onClick={handleClosePreview}>
            Close
          </Button>,
          previewUrl && (
            <Button
              key="download"
              type="primary"
              href={previewUrl}
              download="sample-receipt-preview.pdf"
            >
              Download PDF
            </Button>
          ),
        ]}
        styles={{ body: { padding: 0, height: "80vh" } }}
      >
        {previewLoading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
            }}
          >
            <Space direction="vertical" align="center">
              <Text>Generating sample preview...</Text>
              <Text type="secondary">
                Using fake sample data with your current settings
              </Text>
            </Space>
          </div>
        ) : previewUrl ? (
          <iframe
            src={previewUrl}
            style={{ width: "100%", height: "100%", border: "none" }}
            title="Sample PDF Preview"
          />
        ) : null}
      </Modal>
    </>
  );
}
