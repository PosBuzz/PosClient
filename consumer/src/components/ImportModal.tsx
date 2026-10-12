import {
  CheckCircleOutlined,
  DownloadOutlined,
  InboxOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import saveAs from "file-saver";
import { useCallback, useEffect, useState } from "react";
import {
  IMPORT_LABELS,
  ImportEntity,
  ImportResult,
  ImportRowError,
  importApi,
} from "../api/import-api";
import { useMessageStore } from "../stores/messageStore";
import { getErrorMessage } from "../utils/api-error";

const { Text, Paragraph } = Typography;
const { Dragger } = Upload;

/** Server-supplied message when there is one, otherwise the given fallback */
const apiMessage = getErrorMessage;

interface ImportModalProps {
  entity: ImportEntity;
  open: boolean;
  onClose: () => void;
  /** Called after a successful import so the caller can refetch its list */
  onImported?: (result: ImportResult) => void;
}

/**
 * Three-step import: download the template, upload a filled copy, review what
 * validation found. Nothing is written until the file is completely clean, so
 * the same upload is first checked (preview) and only then committed.
 */
export default function ImportModal({
  entity,
  open,
  onClose,
  onImported,
}: ImportModalProps) {
  const { messageApi } = useMessageStore();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const label = IMPORT_LABELS[entity];

  const { data: spec } = useQuery({
    queryKey: ["import-columns", entity],
    queryFn: () => importApi.getColumns(entity),
    enabled: open,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!open) {
      setFile(null);
      setResult(null);
    }
  }, [open]);

  const templateMutation = useMutation({
    mutationFn: () => importApi.downloadTemplate(entity),
    onSuccess: (blob) => {
      saveAs(blob, `${entity}-import-template.xlsx`);
    },
    onError: (error) =>
      messageApi?.error(
        getErrorMessage(error, "Failed to download the template"),
      ),
  });

  const previewMutation = useMutation({
    mutationFn: (upload: File) => importApi.preview(entity, upload),
    onSuccess: setResult,
    onError: (error: unknown) =>
      messageApi?.error(apiMessage(error, "Could not read that file")),
  });

  const importMutation = useMutation({
    mutationFn: (upload: File) => importApi.import(entity, upload),
    onSuccess: (imported) => {
      setResult(imported);
      if (imported.imported) {
        const summary = Object.entries(imported.created)
          .map(([key, count]) => `${count} ${key}`)
          .join(", ");
        messageApi?.success(`Imported ${summary}`);
        onImported?.(imported);
      }
    },
    onError: (error: unknown) =>
      messageApi?.error(apiMessage(error, "Import failed, nothing was saved")),
  });

  const handleFile = useCallback(
    (picked: File) => {
      setFile(picked);
      setResult(null);
      previewMutation.mutate(picked);
    },
    [previewMutation],
  );

  const busy =
    previewMutation.isPending ||
    importMutation.isPending ||
    templateMutation.isPending;

  const hasErrors = !!result?.errors.length;
  const canImport = !!file && !!result && !hasErrors && !result.imported;

  const errorColumns = [
    {
      title: "Row",
      dataIndex: "row",
      key: "row",
      width: 70,
      render: (row: number) => <Tag color="red">{row}</Tag>,
    },
    {
      title: "Column",
      dataIndex: "column",
      key: "column",
      width: 150,
      render: (column: string | null) =>
        column ? <Text code>{column}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: "Problem",
      dataIndex: "message",
      key: "message",
    },
  ];

  return (
    <Modal
      title={`Import ${label} from Excel`}
      open={open}
      onCancel={onClose}
      width={760}
      maskClosable={!busy}
      footer={[
        <Button key="close" onClick={onClose} disabled={busy}>
          {result?.imported ? "Done" : "Cancel"}
        </Button>,
        <Button
          key="import"
          type="primary"
          disabled={!canImport}
          loading={importMutation.isPending}
          onClick={() => file && importMutation.mutate(file)}
        >
          {result && !hasErrors
            ? `Import ${result.validRows} row(s)`
            : "Import"}
        </Button>,
      ]}
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <div>
          <Paragraph style={{ marginBottom: 8 }}>
            Fill in the template and upload it. Every row is checked first —
            nothing is saved unless the whole file is valid.
          </Paragraph>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => templateMutation.mutate()}
            loading={templateMutation.isPending}
          >
            Download {label} template
          </Button>
        </div>

        {spec?.columns?.length ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Required columns:{" "}
            {spec.columns
              .filter((column) => column.required)
              .map((column) => column.header)
              .join(", ")}
          </Text>
        ) : null}

        <Dragger
          accept=".xlsx,.xls,.csv"
          maxCount={1}
          disabled={busy}
          fileList={
            file
              ? ([
                  { uid: "1", name: file.name, status: "done" },
                ] as UploadFile[])
              : []
          }
          beforeUpload={(picked) => {
            handleFile(picked as File);
            return false;
          }}
          onRemove={() => {
            setFile(null);
            setResult(null);
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">
            Click or drag the filled .xlsx file here
          </p>
          <p className="ant-upload-hint">Maximum 5 MB, first sheet is read</p>
        </Dragger>

        {previewMutation.isPending && <Text>Checking the file…</Text>}

        {result?.imported && (
          <Alert
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            message="Import complete"
            description={Object.entries(result.created)
              .map(([key, count]) => `${count} ${key} created`)
              .join(", ")}
          />
        )}

        {result && !result.imported && !hasErrors && (
          <Alert
            type="info"
            showIcon
            message={`${result.validRows} of ${result.totalRows} row(s) ready to import`}
            description="No problems found. Press Import to save them."
          />
        )}

        {hasErrors && (
          <>
            <Alert
              type="error"
              showIcon
              icon={<WarningOutlined />}
              message={`${result!.errors.length} problem(s) found — nothing was imported`}
              description="Fix these rows in your file and upload it again. Row numbers match the rows in Excel."
            />
            <Table<ImportRowError>
              columns={errorColumns}
              dataSource={result!.errors}
              rowKey={(row, index) => `${row.row}-${row.column}-${index}`}
              size="small"
              pagination={result!.errors.length > 10 ? { pageSize: 10 } : false}
              scroll={{ y: 260 }}
            />
          </>
        )}
      </Space>
    </Modal>
  );
}
