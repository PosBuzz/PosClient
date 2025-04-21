import {
  Button,
  message,
  Upload,
  Select,
  Checkbox,
  Form,
  Space,
  Spin,
} from "antd";
import { BiPlus } from "react-icons/bi";
import { useState, useEffect } from "react";
import PageTitle from "../../components/PageTitle";
import axiosInstance from "../../api/axiosInstance";
import { endpoints } from "../../api/endpoints";
import { UploadOutlined, DownloadOutlined } from "@ant-design/icons";

const { Option } = Select;

function BackupRestorePage() {
  const [form] = Form.useForm();
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const [loading, setLoading] = useState<boolean>(false);
  const [restoreLoading, setRestoreLoading] = useState<boolean>(false);

  useEffect(() => {
    // Fetch available tables when component mounts
    const fetchTables = async () => {
      try {
        const response = await axiosInstance.get(endpoints.tables);
        setTables(response.data);
      } catch (error) {
        console.error("Failed to fetch tables:", error);
        message.error("Failed to load database tables");
      }
    };

    fetchTables();
  }, []);

  const handleBackup = async () => {
    setLoading(true);
    try {
      // Build query string for selected tables
      const tableQuery =
        selectedTables.length > 0 ? `?tables=${selectedTables.join(",")}` : "";

      const response = await axiosInstance.get(
        `${endpoints.backup}${tableQuery}`,
        {
          responseType: "blob", // Important: tells axios to treat the response as binary
        }
      );

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
      const params = [];

      if (restoreMode) {
        params.push(`mode=${restoreMode}`);
      }

      if (selectedTables.length > 0) {
        params.push(`tables=${selectedTables.join(",")}`);
      }

      if (params.length > 0) {
        url += `?${params.join("&")}`;
      }

      await axiosInstance.post(url, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      message.success(
        restoreMode === "replace"
          ? "Database tables replaced successfully"
          : "Database restored successfully"
      );
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
        rightSection={
          <Button type="primary" icon={<BiPlus />}>
            Add New
          </Button>
        }
      />

      <div className="bg-white p-6 rounded shadow">
        <h1 className="text-2xl mb-6">Database Backup and Restore</h1>

        <Form form={form} layout="vertical">
          <Form.Item label="Select Tables (leave empty for all tables)">
            <Select
              mode="multiple"
              placeholder="Select tables to backup/restore"
              value={selectedTables}
              onChange={setSelectedTables}
              style={{ width: "100%" }}
              allowClear
            >
              {tables?.map((table) => (
                <Option key={table} value={table?.raw}>
                  {table?.raw}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Restore Mode">
            <Select
              value={restoreMode}
              onChange={setRestoreMode}
              style={{ width: "100%" }}
            >
              <Option value="merge">Merge (Keep existing data)</Option>
              <Option value="replace">
                Replace (Clear selected tables first)
              </Option>
            </Select>
          </Form.Item>

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
        </Form>
      </div>
    </>
  );
}

export default BackupRestorePage;
