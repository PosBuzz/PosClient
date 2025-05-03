import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileExcelOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Button,
  Col,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
} from "antd";
import dayjs from "dayjs";
import { debounce } from "lodash";
import { useCallback, useEffect, useState } from "react";
import { deleteApi, post } from "../../api/crud-api";
import {
  API_CRUD_FIND_WHERE,
  endpoints,
  getUrlForModel,
} from "../../api/endpoints";
import { useMessageStore } from "../../stores/messageStore";
import { AdminPermission } from "../../constants/adminPermissions";
import axiosInstance from "../../api/axiosInstance";
import { saveAs } from "file-saver";
const { Option } = Select;

export default function _TableGrid({
  model,
  trigger,
  onClickEdit,
  planOptions = [],
  hasPermission,
  ...props
}) {
  const [searchText, setSearchText] = useState("");
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const { messageApi } = useMessageStore();

  const [debouncedSearchText, setDebouncedSearchText] = useState(searchText);

  // Debounced API call function using lodash's debounce
  const debouncedSearch = useCallback(
    debounce((nextValue) => setDebouncedSearchText(nextValue), 500),
    []
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
    queryKey: [KEY, debouncedSearchText, selectedStatus, selectedPlan],
    queryFn: () =>
      post(`${API_CRUD_FIND_WHERE}?model=${model}`, {
        where: {
          ...(debouncedSearchText
            ? {
                OR: [
                  {
                    company_name: {
                      contains: debouncedSearchText,
                      mode: "insensitive",
                    },
                  },
                  {
                    email: {
                      contains: debouncedSearchText,
                      mode: "insensitive",
                    },
                  },
                  {
                    secondary_email: {
                      contains: debouncedSearchText,
                      mode: "insensitive",
                    },
                  },
                  {
                    phone: {
                      contains: debouncedSearchText,
                      mode: "insensitive",
                    },
                  },
                  {
                    subdomain: {
                      contains: debouncedSearchText,
                      mode: "insensitive",
                    },
                  },
                  {
                    business_category: {
                      contains: debouncedSearchText,
                      mode: "insensitive",
                    },
                  },
                ],
              }
            : {}),
          ...(selectedStatus
            ? {
                billing_logs:
                  selectedStatus === "active"
                    ? {
                        some: {
                          billing_date: {
                            gte: dayjs().subtract(1, "month").toISOString(),
                            lte: dayjs().toISOString(),
                          },
                        },
                      }
                    : {
                        none: {
                          billing_date: {
                            gte: dayjs().subtract(1, "month").toISOString(),
                            lte: dayjs().toISOString(),
                          },
                        },
                      },
              }
            : {}),
          ...(selectedPlan ? { plan_id: selectedPlan } : {}),
        },
        include: {
          users: {
            select: {
              name: true,
              role: true,
            },
          },
          plan: true,
          billing_logs: true,
        },
      }),
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
      const response = await fetch(url, {
        method: "GET",
        headers: {
          // Add any authentication headers if needed
          // 'Authorization': `Bearer ${token}`,
        },
      });

      // Check if the request was successful
      if (!response.ok) {
        // Handle error based on status code
        if (response.status === 404) {
          throw new Error(`Consumer with ID ${consumer_id} not found`);
        }
        throw new Error(`Failed to download PDF: ${response.statusText}`);
      }

      // Get the blob from the response
      const blob = await response.blob();

      // Create a URL for the blob
      const downloadUrl = window.URL.createObjectURL(blob);

      // Get the filename from the Content-Disposition header if available
      let filename = "Billing-History.pdf";
      const contentDisposition = response.headers["content-disposition"];
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create a temporary anchor element and trigger the download
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // Clean up
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      console.log(
        `Billing history PDF for consumer ${consumer_id} downloaded successfully`
      );
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
        }
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

  useEffect(() => {
    if (trigger) {
      refetch();
    }
  }, [trigger]);

  const deleteMutation = useMutation({
    mutationFn: async (id: any) => await deleteApi(getUrlForModel(model, id)),
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
          (user: any) => user.role?.name === "Admin"
        );
        return adminUser ? adminUser.name : "-";
      },
      key: "user_name",
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
      title: "Status",
      render: (record: any) => {
        const isActive = record.billing_logs?.some((log: any) =>
          dayjs(log.billing_date).isBetween(
            dayjs().subtract(1, "month"),
            dayjs(),
            null,
            "[]"
          )
        );

        return (
          <Tag color={isActive ? "success" : "error"}>
            {isActive ? "Active" : "Inactive"}
          </Tag>
        );
      },
      key: "status",
    },
    {
      title: "Actions",
      key: "actions",
      render: (record: any) => {
        return (
          <Space>
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
            {hasPermission(AdminPermission.modify_consumers) && (
              <Button onClick={() => onClickEdit(record)} type="link">
                <EditOutlined />
              </Button>
            )}
            {hasPermission(AdminPermission.delete_consumers) && (
              <Popconfirm
                title="Delete this item?"
                description="This action cannot be undone"
                onConfirm={() => handleDeleteClient(record.id)}
                okText="Yes"
                cancelText="No"
              >
                <Button danger type="link">
                  <DeleteOutlined />
                </Button>
              </Popconfirm>
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
