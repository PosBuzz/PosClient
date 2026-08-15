import { DownloadOutlined, UploadOutlined } from "@ant-design/icons";
import { Button, Space, Upload } from "antd";
import { useState } from "react";
import axiosInstance from "../../api/axiosInstance";
import { endpoints } from "../../api/endpoints";
import PageTitle from "../../components/PageTitle"; // Assuming this is still being used
import { useMessageStore } from "../../stores/messageStore";
import { setPageTitle } from "../../utils/setPageTitle";
import { saveAs } from "file-saver";

const title = "Database Management";

function BackupRestorePage() {
  const [loading, setLoading] = useState<boolean>(false);
  const [restoreLoading, setRestoreLoading] = useState<boolean>(false);
  const { messageApi } = useMessageStore();

  const handleBackup = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get(endpoints.backup, {
        responseType: "blob", // Ensure the response is treated as a binary blob
      });

      // Use saveAs to download the file
      const fileName = `backup_${Date.now()}.sql`;
      saveAs(new Blob([response.data]), fileName);

      messageApi?.success("Full database backup completed successfully");
    } catch (error) {
      console.error("Backup failed:", error);
      messageApi?.error("Database backup failed");
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
      await axiosInstance.post(endpoints.restore, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      messageApi?.success("Database restored successfully");
    } catch (error) {
      console.error("Restore failed:", error);
      messageApi?.error("Database restore failed");
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
      {setPageTitle(title)}
      <PageTitle
        title={"Database Management"}
        breadcrumbs={[
          {
            title: "Dashboard",
            href: "/",
          },
          {
            title,
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
