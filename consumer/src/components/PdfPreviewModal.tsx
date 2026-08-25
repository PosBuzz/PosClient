import {
  CloseOutlined,
  DownloadOutlined,
  PrinterOutlined,
} from "@ant-design/icons";
import { Button, Modal, Space, Spin, Typography } from "antd";
import saveAs from "file-saver";
import { useCallback, useEffect, useState } from "react";

import { useMessageStore } from "../stores/messageStore";

const { Text } = Typography;

export interface PdfPreviewState {
  open: boolean;
  loading: boolean;
  blob: Blob | null;
  title: string;
  fileName: string;
}

const emptyState: PdfPreviewState = {
  open: false,
  loading: false,
  blob: null,
  title: "Document",
  fileName: "document.pdf",
};

/**
 * Fetches a PDF and holds it for on-screen preview instead of dropping it in
 * the downloads folder. Downloading stays available from the preview itself.
 */
export const usePdfPreview = () => {
  const { messageApi } = useMessageStore();
  const [state, setState] = useState<PdfPreviewState>(emptyState);

  const preview = useCallback(
    async (
      // A loader may name the file itself — the backend's Content-Disposition
      // is a better name than anything the caller can guess.
      load: () => Promise<Blob | { blob: Blob; fileName: string }>,
      options: { title: string; fileName: string },
    ) => {
      setState({
        open: true,
        loading: true,
        blob: null,
        title: options.title,
        fileName: options.fileName,
      });

      try {
        const loaded = await load();
        const blob = loaded instanceof Blob ? loaded : loaded.blob;
        const fileName =
          loaded instanceof Blob ? options.fileName : loaded.fileName;

        setState((prev) => ({ ...prev, loading: false, blob, fileName }));
      } catch (error) {
        console.error("Error loading PDF:", error);
        messageApi?.error("Failed to load the PDF");
        setState(emptyState);
      }
    },
    [messageApi],
  );

  const close = useCallback(() => setState(emptyState), []);

  return {
    preview,
    previewProps: { ...state, onClose: close },
  };
};

interface PdfPreviewModalProps extends PdfPreviewState {
  onClose: () => void;
}

const PdfPreviewModal = ({
  open,
  loading,
  blob,
  title,
  fileName,
  onClose,
}: PdfPreviewModalProps) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  // The object URL is owned by this component: it is rebuilt whenever a new
  // document arrives and revoked on close, so previews do not leak memory.
  useEffect(() => {
    if (!blob) {
      setObjectUrl(null);
      return;
    }

    const url = URL.createObjectURL(blob);
    setObjectUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [blob]);

  const handlePrint = () => {
    if (!objectUrl) return;

    const frame = document.getElementById(
      "pdf-preview-frame",
    ) as HTMLIFrameElement | null;

    // Blob URLs are same-origin, so the embedded viewer can be driven directly.
    // Some browsers still refuse; opening the document is the honest fallback.
    try {
      frame?.contentWindow?.focus();
      frame?.contentWindow?.print();
    } catch {
      window.open(objectUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleDownload = () => {
    if (!blob) return;
    saveAs(blob, fileName);
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      width="min(920px, 96vw)"
      style={{ top: 24 }}
      styles={{ body: { padding: 0, background: "#525659" } }}
      destroyOnHidden
      footer={
        <Space>
          <Text type="secondary" style={{ marginRight: 8 }}>
            A4 · {fileName}
          </Text>
          <Button icon={<CloseOutlined />} onClick={onClose}>
            Close
          </Button>
          <Button
            icon={<PrinterOutlined />}
            onClick={handlePrint}
            disabled={!objectUrl}
          >
            Print
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleDownload}
            disabled={!blob}
          >
            Download
          </Button>
        </Space>
      }
    >
      <div
        style={{
          height: "min(78vh, 1123px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "auto",
          padding: 12,
        }}
      >
        {loading || !objectUrl ? (
          <Spin size="large" />
        ) : (
          <iframe
            id="pdf-preview-frame"
            title={title}
            src={`${objectUrl}#view=FitH`}
            style={{
              // A4 proportions (210 × 297mm), so the preview reads as the page
              // that comes out of the printer rather than a generic viewer
              aspectRatio: "210 / 297",
              height: "100%",
              maxWidth: "100%",
              border: "none",
              background: "#fff",
              boxShadow: "0 2px 12px rgba(0, 0, 0, 0.35)",
            }}
          />
        )}
      </div>
    </Modal>
  );
};

export default PdfPreviewModal;
