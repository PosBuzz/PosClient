import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { inventoryApi } from "../../api/inventory-api";
import {
  ReceiptPdfSetting,
  ReceiptPresetType,
  receiptSettingsApi,
} from "../../api/receipt-settings-api";
import CenterLoader from "../../components/CenterLoader";
import PageTitle from "../../components/PageTitle";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { useMessageStore } from "../../stores/messageStore";
import { setPageTitle } from "../../utils/setPageTitle";

const { Text } = Typography;

// ─── Local Storage Key ───────────────────────────────────────────────
const AUTO_PRINT_THERMAL_KEY = "autoPrintThermal";

function getAutoPrintThermal(): boolean {
  try {
    return localStorage.getItem(AUTO_PRINT_THERMAL_KEY) === "true";
  } catch {
    return false;
  }
}

function setAutoPrintThermal(value: boolean): void {
  try {
    localStorage.setItem(AUTO_PRINT_THERMAL_KEY, String(value));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

// ─── Type Options ────────────────────────────────────────────────────
const TYPE_OPTIONS: {
  label: string;
  value: ReceiptPresetType;
  color: string;
}[] = [
  { label: "Receipt", value: "receipt", color: "blue" },
  { label: "Quotation", value: "quotation", color: "green" },
  { label: "Return", value: "return", color: "orange" },
];

export default function ReceiptSettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { messageApi } = useMessageStore();

  const [selectedType, setSelectedType] =
    useState<ReceiptPresetType>("receipt");
  const [selectedBranch, setSelectedBranch] = useState<number | undefined>();
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [copyTargetSetting, setCopyTargetSetting] =
    useState<ReceiptPdfSetting | null>(null);
  const [copyTargetBranch, setCopyTargetBranch] = useState<
    number | undefined
  >();
  const previewUrlRef = useRef<string>("");

  // ─── Auto Print Thermal state (localStorage-backed) ──────────────
  const [autoPrintThermal, setAutoPrintThermalState] = useState<boolean>(
    getAutoPrintThermal,
  );

  const handleAutoPrintThermalChange = useCallback(
    (checked: boolean) => {
      setAutoPrintThermal(checked);
      setAutoPrintThermalState(checked);
      messageApi?.success(
        checked
          ? "Auto print thermal receipt enabled"
          : "Auto print thermal receipt disabled",
      );
    },
    [messageApi],
  );

  // Queries
  const { data: settings = [], isLoading } = useQuery({
    queryKey: [queryKeys.receiptSettings, selectedType],
    queryFn: () => receiptSettingsApi.listByType(selectedType),
    staleTime: queryStaleTimeMap[queryKeys.receiptSettings],
  });

  const { data: branches = [] } = useQuery({
    queryKey: [queryKeys.branches],
    queryFn: () => inventoryApi.getBranches(),
    staleTime: queryStaleTimeMap[queryKeys.branches],
  });

  // Filter settings by branch on client side
  const filteredSettings = selectedBranch
    ? settings.filter(
        (s) => s.branch_id === selectedBranch || s.branch_id === null,
      )
    : settings;

  // Mutations
  const activateMutation = useMutation({
    mutationFn: receiptSettingsApi.activate,
    onSuccess: () => {
      messageApi?.success("Setting activated successfully");
      queryClient.invalidateQueries({
        queryKey: [queryKeys.receiptSettings],
      });
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to activate setting",
      );
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: receiptSettingsApi.deactivate,
    onSuccess: () => {
      messageApi?.success(
        "Setting deactivated. Branch will use consumer default.",
      );
      queryClient.invalidateQueries({
        queryKey: [queryKeys.receiptSettings],
      });
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to deactivate setting",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: receiptSettingsApi.remove,
    onSuccess: () => {
      messageApi?.success("Setting deleted successfully");
      queryClient.invalidateQueries({
        queryKey: [queryKeys.receiptSettings],
      });
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to delete setting",
      );
    },
  });

  const copyMutation = useMutation({
    mutationFn: ({ id, branchId }: { id: number; branchId: number }) =>
      receiptSettingsApi.copyToBranch(id, branchId),
    onSuccess: () => {
      messageApi?.success("Setting copied to branch successfully");
      queryClient.invalidateQueries({
        queryKey: [queryKeys.receiptSettings],
      });
      setCopyModalVisible(false);
      setCopyTargetSetting(null);
      setCopyTargetBranch(undefined);
    },
    onError: (error: any) => {
      messageApi?.error(
        error.response?.data?.message || "Failed to copy setting",
      );
    },
  });

  // Preview handler
  const handlePreview = useCallback(
    async (setting: ReceiptPdfSetting) => {
      setPreviewLoading(true);
      setPreviewVisible(true);
      try {
        const blob = await receiptSettingsApi.generatePreview({
          settings: setting.settings,
          type: setting.type,
          branchId: setting.branch_id,
        });
        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current);
        }
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
      } catch {
        messageApi?.error("Failed to generate preview");
        setPreviewVisible(false);
      } finally {
        setPreviewLoading(false);
      }
    },
    [messageApi],
  );

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  // Close preview
  const handleClosePreview = () => {
    setPreviewVisible(false);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
    setPreviewUrl("");
  };

  // Copy to branch
  const handleCopyClick = (setting: ReceiptPdfSetting) => {
    setCopyTargetSetting(setting);
    setCopyTargetBranch(undefined);
    setCopyModalVisible(true);
  };

  const handleCopyConfirm = () => {
    if (!copyTargetSetting || !copyTargetBranch) return;
    copyMutation.mutate({
      id: copyTargetSetting.id,
      branchId: copyTargetBranch,
    });
  };

  const columns: ColumnsType<ReceiptPdfSetting> = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (name: string, record) => (
        <div>
          <Text strong style={{ fontSize: 14 }}>
            {name}
          </Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.type.charAt(0).toUpperCase() + record.type.slice(1)}
          </Text>
        </div>
      ),
    },
    {
      title: "Scope",
      key: "scope",
      width: 180,
      render: (_, record) => (
        <div>
          {record.branch_id === null ? (
            <Tag color="purple">Consumer Default</Tag>
          ) : (
            <Tag color="blue">
              {record.branch?.name || `Branch #${record.branch_id}`}
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: "Active",
      key: "is_active",
      width: 100,
      align: "center",
      render: (_, record) => (
        <Switch
          checked={record.is_active}
          loading={
            (activateMutation.isPending &&
              activateMutation.variables === record.id) ||
            (deactivateMutation.isPending &&
              deactivateMutation.variables === record.id)
          }
          onChange={(checked) => {
            if (checked) {
              activateMutation.mutate(record.id);
            } else {
              deactivateMutation.mutate(record.id);
            }
          }}
          disabled={record.branch_id === null && record.is_active}
        />
      ),
    },
    {
      title: "Created By",
      key: "createdBy",
      width: 160,
      render: (_, record) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {record.createdBy?.name || "System"}
        </Text>
      ),
    },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created_at",
      width: 130,
      render: (date: string) => dayjs(date).format("MMM DD, YYYY"),
    },
    {
      title: "Actions",
      key: "actions",
      fixed: "right",
      align: "right",
      width: 200,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Preview PDF">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handlePreview(record)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              type="primary"
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/printer-settings/edit/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="Copy to Branch">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleCopyClick(record)}
            />
          </Tooltip>
          {!(record.branch_id === null && record.is_active) && (
            <Tooltip title="Delete">
              <Popconfirm
                title="Delete Setting"
                description="Are you sure you want to delete this setting?"
                onConfirm={() => deleteMutation.mutate(record.id)}
                okText="Delete"
                cancelText="Cancel"
                okType="danger"
              >
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  danger
                  loading={
                    deleteMutation.isPending &&
                    deleteMutation.variables === record.id
                  }
                />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  if (isLoading) return <CenterLoader />;

  return (
    <>
      {setPageTitle("Receipt PDF Settings")}
      <PageTitle
        title="Receipt PDF Settings"
        breadcrumbs={[
          { title: "Dashboard", href: "/" },
          { title: "Settings" },
          { title: "Receipt PDF" },
        ]}
        rightSection={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/printer-settings/add")}
          >
            Create Setting
          </Button>
        }
      />

      {/* Controls Card */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col>
            <Space>
              {TYPE_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type={selectedType === opt.value ? "primary" : "default"}
                  icon={<FileTextOutlined />}
                  onClick={() => setSelectedType(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </Space>
          </Col>
          <Col flex="auto" />
          <Col>
            <Space>
              <PrinterOutlined style={{ color: "#666", fontSize: 16 }} />
              <Text style={{ color: "#666" }}>Auto Print Thermal</Text>
              <Switch
                checked={autoPrintThermal}
                onChange={handleAutoPrintThermalChange}
                checkedChildren="ON"
                unCheckedChildren="OFF"
              />
            </Space>
          </Col>
          <Col>
            <Select
              placeholder="All Branches"
              style={{ width: 200 }}
              value={selectedBranch}
              onChange={setSelectedBranch}
              allowClear
            >
              {branches.map((b) => (
                <Select.Option key={b.id} value={b.id}>
                  {b.name}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Button
              icon={<ReloadOutlined />}
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: [queryKeys.receiptSettings],
                })
              }
            >
              Refresh
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Summary */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: "bold",
                  color: "#1890ff",
                }}
              >
                {filteredSettings.length}
              </div>
              <div style={{ color: "#666" }}>Total Settings</div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: "bold",
                  color: "#52c41a",
                }}
              >
                {filteredSettings.filter((s) => s.is_active).length}
              </div>
              <div style={{ color: "#666" }}>Active</div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: "bold",
                  color: "#722ed1",
                }}
              >
                {filteredSettings.filter((s) => s.branch_id === null).length}
              </div>
              <div style={{ color: "#666" }}>Consumer Defaults</div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: "bold",
                  color: "#fa8c16",
                }}
              >
                {filteredSettings.filter((s) => s.branch_id !== null).length}
              </div>
              <div style={{ color: "#666" }}>Branch Overrides</div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredSettings}
          rowKey="id"
          pagination={false}
          scroll={{ x: 900 }}
          size="middle"
          rowClassName={(record) =>
            record.is_active ? "ant-table-row-active" : ""
          }
        />
      </Card>

      {/* Preview Drawer */}
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
        styles={{ body: { padding: 0, height: "100vh" } }}
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
                Using fake sample data with this receipt setting
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

      {/* Copy to Branch Modal */}
      <Modal
        title="Copy Setting to Branch"
        open={copyModalVisible}
        onCancel={() => {
          setCopyModalVisible(false);
          setCopyTargetSetting(null);
          setCopyTargetBranch(undefined);
        }}
        onOk={handleCopyConfirm}
        okText="Copy"
        okButtonProps={{
          disabled: !copyTargetBranch,
          loading: copyMutation.isPending,
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>
            Copy <Text strong>{copyTargetSetting?.name}</Text> to which branch?
          </Text>
        </div>
        <Select
          placeholder="Select target branch"
          style={{ width: "100%" }}
          value={copyTargetBranch}
          onChange={setCopyTargetBranch}
          showSearch
          optionFilterProp="label"
        >
          {branches
            .filter((b) => b.id !== copyTargetSetting?.branch_id)
            .map((b) => (
              <Select.Option key={b.id} value={b.id} label={b.name}>
                {b.name}
              </Select.Option>
            ))}
        </Select>
        {copyTargetBranch && (
          <div style={{ marginTop: 12 }}>
            <Tag color="orange">
              The copied setting will be created as inactive. Activate it from
              the list after creation.
            </Tag>
          </div>
        )}
      </Modal>
    </>
  );
}
