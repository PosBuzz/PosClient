import { DownloadOutlined } from "@ant-design/icons";
import { Button, Dropdown } from "antd";
import saveAs from "file-saver";
import { useState } from "react";
import { ExportEntity, ExportFormat, exportApi } from "../api/export-api";
import { useMessageStore } from "../stores/messageStore";
import { getErrorMessage } from "../utils/api-error";

/** Export the list as PDF. (Excel export is switched off for now.) */
export default function ExportButton({ entity }: { entity: ExportEntity }) {
  const { messageApi } = useMessageStore();
  const [loading, setLoading] = useState(false);

  const download = async (format: ExportFormat) => {
    setLoading(true);
    try {
      const blob = await exportApi.download(entity, format);
      saveAs(blob, `${entity}.${format}`);
    } catch (error) {
      messageApi?.error(getErrorMessage(error, "Failed to export the list"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dropdown
      menu={{
        items: [
          // Excel export is switched off for now; uncomment to offer it again.
          // { key: "xlsx", label: "Export as Excel" },
          { key: "pdf", label: "Export as PDF" },
        ],
        onClick: ({ key }) => download(key as ExportFormat),
      }}
    >
      <Button icon={<DownloadOutlined />} loading={loading}>
        Export
      </Button>
    </Dropdown>
  );
}
