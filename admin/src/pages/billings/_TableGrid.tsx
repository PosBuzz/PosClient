/* eslint-disable */

import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
} from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import { Button, Popconfirm, Space, Table } from "antd";
import dayjs from "dayjs";
import saveAs from "file-saver";
import axiosInstance from "../../api/axiosInstance";
import { deleteApi } from "../../api/http";
import { endpoints } from "../../api/endpoints";
import { useMessageStore } from "../../stores/messageStore";
import { getErrorMessage } from "../../utils/api-error";

export default function _TableGrid({
  model: _model,
  onClickEdit,
  isLoading,
  isError,
  fetchData,
  refetch,
}) {
  const { messageApi } = useMessageStore();

  const deleteMutation = useMutation({
    mutationFn: async (id: any) =>
      await deleteApi(`${endpoints.billing}/${id}`),
    onSuccess: () => {
      messageApi?.success("Deleted Successfully");
      refetch();
    },
    onError: (error) => {
      messageApi?.error(getErrorMessage(error, "Something went wrong"));
    },
  });

  const handleDeleteClient = (id: any) => {
    deleteMutation.mutate(id);
  };

  const getInvoice = async (billing_id: any, openInNewTab: boolean) => {
    try {
      // Form the URL
      const url = `${endpoints.downloadBillingInvoice}/${billing_id}`;

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
      let filename = "Billing-Invoice.pdf";
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

  const columns = [
    {
      title: "Name",
      dataIndex: ["consumer", "company_name"],
      key: "name",
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
    },
    {
      title: "Billing date",
      dataIndex: "billing_date",
      render: (billing_date) => dayjs(billing_date).format("DD-MM-YYYY"),
      key: "billing_date",
    },
    {
      title: "Billing From",
      dataIndex: "billing_from",
      render: (billing_from) => dayjs(billing_from).format("DD-MM-YYYY"),
      key: "billing_from",
    },
    {
      title: "Billing Till",
      dataIndex: "billing_till",
      render: (billing_till) => dayjs(billing_till).format("DD-MM-YYYY"),
      key: "billing_till",
    },
    {
      title: "Reference",
      dataIndex: "reference",
      key: "reference",
      render: (reference: string | null) => reference || "-",
    },
    {
      title: "Actions",
      key: "actions",
      render: (record: any) => (
        <Space>
          <Button onClick={() => getInvoice(record.id, true)} type="link">
            <DownloadOutlined />
          </Button>
          <Button onClick={() => onClickEdit(record)} type={"link"}>
            <EditOutlined />
          </Button>
          <Popconfirm
            title="Delete this item?"
            description="This action cannot be undone"
            onConfirm={() => handleDeleteClient(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button danger type={"link"}>
              <DeleteOutlined />
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (isError) {
    return <p>Failed to load data</p>;
  }

  return (
    <>
      <Table
        rowKey="id"
        scroll={{
          x: true,
        }}
        loading={isLoading}
        columns={columns}
        dataSource={fetchData}
      />
    </>
  );
}
