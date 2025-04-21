import { Button, message, Upload, Select, Form, Space, Spin } from "antd";
import { BiPlus } from "react-icons/bi";
import { useState, useEffect } from "react";
import PageTitle from "../../components/PageTitle"; // Assuming this is still being used
import axiosInstance from "../../api/axiosInstance";
import { endpoints } from "../../api/endpoints";
import { UploadOutlined, DownloadOutlined } from "@ant-design/icons";

const { Option } = Select;

function BackupRestorePage() {
  const [form] = Form.useForm();
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [restoreLoading, setRestoreLoading] = useState<boolean>(false);

  const handleBackup = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get(endpoints.backup, {
        responseType: "blob",
      });

      // Create a download link for the backup file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${Date.now()}.sql`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      message.success(
        selectedTables.length > 0
          ? `Backup of selected tables completed successfully`
          : "Full database backup completed successfully"
      );
    } catch (error) {
      console.error("Backup failed:", error);
      message.error("Database backup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (file: File) => {
    setRestoreLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      // Build query parameters for restore
      let url = endpoints.restore;

      if (selectedTables.length > 0) {
        url += `?tables=${selectedTables.join(",")}`;
      }

      await axiosInstance.post(url, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      message.success("Database restored successfully");
    } catch (error) {
      console.error("Restore failed:", error);
      message.error("Database restore failed");
    } finally {
      setRestoreLoading(false);
    }
  };

  const uploadProps = {
    name: "file",
    accept: ".sql",
    showUploadList: false,
    beforeUpload: (file: File) => {
      handleRestore(file);
      return false; // Prevent automatic upload
    },
  };

  return (
    <>
      <PageTitle
        title={"Database Management"}
        breadcrumbs={[
          {
            title: "Dashboard",
            href: "/",
          },
          {
            title: "Database Management",
          },
        ]}
      />

      <Space size="middle">
        <Button
          type="primary"
          onClick={handleBackup}
          icon={<DownloadOutlined />}
          loading={loading}
        >
          Download Backup
        </Button>

        <Upload {...uploadProps}>
          <Button icon={<UploadOutlined />} loading={restoreLoading}>
            Restore Database
          </Button>
        </Upload>
      </Space>
    </>
  );
}

export default BackupRestorePage;
