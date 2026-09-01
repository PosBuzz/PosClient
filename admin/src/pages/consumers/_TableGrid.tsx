import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileExcelOutlined,
  SearchOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Col,
  Input,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
} from "antd";
import dayjs from "dayjs";
import { saveAs } from "file-saver";
import debounce from "lodash/debounce";
import { useCallback, useEffect, useState } from "react";
import axiosInstance from "../../api/axiosInstance";
import { deleteApi, get, post } from "../../api/http";
import { endpoints } from "../../api/endpoints";
import { AdminPermission } from "../../constants/adminPermissions";
import { useMessageStore } from "../../stores/messageStore";
const { Option } = Select;

export default function TableGrid({
  model,
  onClickEdit,
  planOptions = [],
  hasPermission,
}) {
  const [searchText, setSearchText] = useState("");
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const { messageApi } = useMessageStore();

  // "active" hides soft-deleted tenants (the default listing); "deleted" shows
  // only them, where they can be restored or permanently purged.
  const [view, setView] = useState<"active" | "deleted">("active");
  const showingDeleted = view === "deleted";

  // Permanent delete requires typing the subdomain back, so a misclick on the
  // wrong row cannot destroy a tenant.
  const [purgeTarget, setPurgeTarget] = useState<any>(null);
  const [purgeConfirm, setPurgeConfirm] = useState("");

  const [debouncedSearchText, setDebouncedSearchText] = useState(searchText);

  // Debounced API call function using lodash's debounce
  const debouncedSearch = useCallback(
    debounce((nextValue) => setDebouncedSearchText(nextValue), 500),
    [],
  );

  useEffect(() => {
    debouncedSearch(searchText);
    return () => {
      debouncedSearch.cancel(); // Cleanup on unmount
    };
  }, [searchText, debouncedSearch]);

  const KEY = `all-${model}`;

  const {
    isLoading,
    isError,
    data: fetchData,
    refetch,
  } = useQuery({
    queryKey: [KEY, debouncedSearchText, selectedStatus, selectedPlan, view],
    queryFn: () =>
      get(
        `${endpoints.consumer}?${new URLSearchParams({
          ...(debouncedSearchText ? { search: debouncedSearchText } : {}),
          ...(selectedStatus ? { status: String(selectedStatus) } : {}),
          ...(selectedPlan ? { plan_id: String(selectedPlan) } : {}),
          ...(showingDeleted ? { deleted: "true" } : {}),
        } as Record<string, string>)}`,
      ),
  });

  const getBillingHistory = async (consumer_id: any, openInNewTab: boolean) => {
    try {
      // Form the URL
      const url = `${endpoints.downloadBillingHistoryPDF}/${consumer_id}`;

      if (openInNewTab) {
        // Open in a new tab - this won't trigger a download but will open the PDF in the browser
        window.open(url, "_blank");
        return;
      }

      // Initiate download
      const response = await axiosInstance.get(url, {
        responseType: "blob",
      });

      // Get the filename from the Content-Disposition header if available
      let filename = "Billing-History.pdf";
      const contentDisposition = response.headers["content-disposition"];
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      saveAs(response.data, filename);
    } catch (error) {
      console.error("Error downloading billing history PDF:", error);
      throw error;
    }
  };

  const downloadBillingHistoryExcel = async (consumer_id: number) => {
    try {
      const response = await axiosInstance.get(
        `${endpoints.downloadBillingHistoryExcel}/${consumer_id}`, // or your actual route
        {
          responseType: "blob", // Important for binary file
        },
      );

      let filename = `billing-history-${consumer_id}.xlsx`;
      const contentDisposition = response.headers["content-disposition"];
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      saveAs(response.data, filename);
    } catch (error) {
      console.error("Failed to download Excel file", error);
      alert("Failed to download file. Please try again.");
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: any) =>
      await deleteApi(`${endpoints.consumer}/${id}`),
    onSuccess: () => {
      messageApi?.success("Deleted Successfully");
      refetch();
    },
    onError: () => {
      messageApi?.error("Something went wrong");
    },
  });

  const handleDeleteClient = (id: any) => {
    deleteMutation.mutate(id);
  };

  const restoreMutation = useMutation({
    mutationFn: async (id: any) =>
      await post(`${endpoints.consumer}/${id}/restore`, {}),
    onSuccess: () => {
      messageApi?.success("Consumer restored");
      refetch();
    },
    onError: () => {
      messageApi?.error("Failed to restore consumer");
    },
  });

  const purgeMutation = useMutation({
    mutationFn: async ({ id, subdomain }: any) =>
      await axiosInstance.delete(`${endpoints.consumer}/${id}/purge`, {
        data: { confirm_subdomain: subdomain },
      }),
    onSuccess: () => {
      messageApi?.success("Consumer permanently deleted");
      setPurgeTarget(null);
      setPurgeConfirm("");
      refetch();
    },
    onError: (e: any) => {
      messageApi?.error(
        e?.response?.data?.message || "Failed to permanently delete consumer",
      );
    },
  });

  const columns = [
    {
      title: "Company Name",
      dataIndex: "company_name",
      key: "company_name",
    },
    {
      title: "Owner Name",
      render: (record: any) => {
        const adminUser = record.users?.find(
          (user: any) => user.role?.name === "Admin",
        );
        return adminUser ? adminUser.name : "-";
      },
      key: "user_name",
    },
    {
      title: "Products",
      key: "product_usage",
      render: (record: any) => {
        const used = record._count?.Product ?? 0;
        const max = record.plan?.max_products ?? null;

        if (max === null) {
          return <span>{used} / &infin;</span>;
        }

        return (
          <Tag
            color={used >= max ? "red" : used >= max * 0.8 ? "orange" : "blue"}
          >
            {used} / {max}
          </Tag>
        );
      },
    },
    {
      title: "Business Category",
      dataIndex: "business_category",
      key: "business_category",
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "Secondary Email",
      dataIndex: "secondary_email",
      key: "secondary_email",
    },
    {
      title: "Phone",
      dataIndex: "phone",
      key: "phone",
    },
    {
      title: "Address",
      dataIndex: "address",
      key: "address",
    },
    {
      title: "Subdomain",
      dataIndex: "subdomain",
      key: "subdomain",
    },
    {
      title: "Plan",
      render: (record: any) => record.plan?.name || "-",
      key: "plan",
    },
    {
      title: "Max Branches",
      dataIndex: "max_branch",
      key: "max_branch",
    },
    {
      title: "Billing Status",
      render: (record: any) => {
        const isActive = Boolean(record.has_active_billing);
        const activeUntil = record.billing_active_until;
        const latestBillingTill = record.latest_billing_till;

        return (
          <Space direction="vertical" size={0}>
            <Tag color={isActive ? "success" : "error"}>
              {isActive ? "Active" : "Inactive"}
            </Tag>
            <span style={{ color: "#888", fontSize: 12 }}>
              {isActive && activeUntil
                ? `Active until ${dayjs(activeUntil).format("DD MMM YYYY")}`
                : latestBillingTill
                  ? `Last covered until ${dayjs(latestBillingTill).format("DD MMM YYYY")}`
                  : "No billing period"}
            </span>
          </Space>
        );
      },
      key: "status",
    },
    ...(showingDeleted
      ? [
          {
            title: "Deleted",
            key: "deleted_at",
            render: (record: any) => (
              <Space direction="vertical" size={0}>
                <span>
                  {record.deleted_at
                    ? dayjs(record.deleted_at).format("DD MMM YYYY, HH:mm")
                    : "-"}
                </span>
                {record.delete_reason && (
                  <span style={{ color: "#888", fontSize: 12 }}>
                    {record.delete_reason}
                  </span>
                )}
              </Space>
            ),
          },
        ]
      : []),
    {
      title: "Actions",
      key: "actions",
      render: (record: any) => {
        return (
          <Space>
            {hasPermission(AdminPermission.modify_consumers) && (
              <>
                {" "}
                <Button
                  onClick={() => downloadBillingHistoryExcel(record.id)}
                  type="link"
                >
                  <FileExcelOutlined />
                </Button>
                <Button
                  onClick={() => getBillingHistory(record.id, true)}
                  type="link"
                >
                  <DownloadOutlined />
                </Button>
              </>
            )}
            {hasPermission(AdminPermission.modify_consumers) && (
              <Button onClick={() => onClickEdit(record)} type="link">
                <EditOutlined />
              </Button>
            )}
            {hasPermission(AdminPermission.delete_consumers) &&
              !showingDeleted && (
                <Popconfirm
                  title="Delete this consumer?"
                  description="It will be hidden and can be restored later."
                  onConfirm={() => handleDeleteClient(record.id)}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button danger type="link">
                    <DeleteOutlined />
                  </Button>
                </Popconfirm>
              )}

            {hasPermission(AdminPermission.delete_consumers) &&
              showingDeleted && (
                <>
                  <Popconfirm
                    title="Restore this consumer?"
                    description="The tenant will be able to log in again."
                    onConfirm={() => restoreMutation.mutate(record.id)}
                    okText="Restore"
                    cancelText="Cancel"
                  >
                    <Button type="link" loading={restoreMutation.isPending}>
                      <UndoOutlined /> Restore
                    </Button>
                  </Popconfirm>

                  <Button
                    danger
                    type="link"
                    onClick={() => {
                      setPurgeTarget(record);
                      setPurgeConfirm("");
                    }}
                  >
                    <DeleteOutlined /> Delete forever
                  </Button>
                </>
              )}
          </Space>
        );
      },
    },
  ];

  if (isError) {
    return <p>Failed to load data</p>;
  }

  return (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24}>
          <Segmented
            value={view}
            onChange={(v: any) => setView(v)}
            options={[
              { label: "Active", value: "active" },
              { label: "Deleted", value: "deleted" },
            ]}
          />
        </Col>
      </Row>

      {showingDeleted && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Deleted consumers"
          description="These tenants cannot log in and their subdomains stay reserved. Restore brings them back with all data intact. Delete forever erases the tenant and every record it owns — this cannot be undone."
        />
      )}

      <Modal
        open={!!purgeTarget}
        title="Permanently delete this consumer?"
        okText="Delete forever"
        okButtonProps={{
          danger: true,
          disabled: purgeConfirm !== purgeTarget?.subdomain,
          loading: purgeMutation.isPending,
        }}
        onOk={() =>
          purgeMutation.mutate({
            id: purgeTarget.id,
            subdomain: purgeTarget.subdomain,
          })
        }
        onCancel={() => {
          setPurgeTarget(null);
          setPurgeConfirm("");
        }}
      >
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="This cannot be undone"
          description={`Every record owned by ${purgeTarget?.company_name} will be erased, including products, sales, customers, payroll and audit history.`}
        />
        <p>
          Type <strong>{purgeTarget?.subdomain}</strong> to confirm:
        </p>
        <Input
          value={purgeConfirm}
          onChange={(e) => setPurgeConfirm(e.target.value)}
          placeholder={purgeTarget?.subdomain}
        />
      </Modal>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12} lg={8}>
          <Input
            allowClear
            placeholder="Search name, email, secondary email, phone, business category or subdomain"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </Col>

        <Col xs={24} md={6} lg={6}>
          <Select
            allowClear
            placeholder="Filter by Status"
            style={{ width: "100%" }}
            value={selectedStatus}
            onChange={(value) => setSelectedStatus(value)}
          >
            <Option value="active">Active</Option>
            <Option value="inactive">Inactive</Option>
          </Select>
        </Col>

        <Col xs={24} md={6} lg={6}>
          <Select
            allowClear
            placeholder="Filter by Plan"
            style={{ width: "100%" }}
            value={selectedPlan}
            onChange={(value) => setSelectedPlan(value)}
            options={planOptions}
          />
        </Col>
      </Row>

      <Table
        rowKey="id"
        scroll={{ x: true }}
        loading={isLoading}
        columns={columns}
        dataSource={fetchData}
      />
    </>
  );
}
