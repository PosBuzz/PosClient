import {
  Alert,
  Button,
  Checkbox,
  Descriptions,
  Input,
  List,
  Modal,
  Radio,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import axiosInstance from "../../api/axiosInstance";
import { endpoints } from "../../api/endpoints";
import { useMessageStore } from "../../stores/messageStore";
import { getErrorMessage } from "../../utils/api-error";

const { Text, Paragraph } = Typography;

const sectionOptions = [
  {
    value: "PRODUCTS",
    label: "Products",
    description:
      "Catalog, units, categories, brands, tags, variants and attributes. Stock and sales are not included.",
  },
  {
    value: "INVENTORY",
    label: "Inventory",
    description:
      "Current stock batches and quantities. Requires Products and Branches to be selected.",
  },
  {
    value: "CUSTOMERS",
    label: "Customers",
    description:
      "Customer profiles only. Sales and rewards history are not included.",
  },
  {
    value: "VENDORS",
    label: "Vendors",
    description: "Vendor contact profiles. Purchase stock is not included.",
  },
  {
    value: "BRANCHES",
    label: "Branches",
    description:
      "Branch details. The destination account keeps its existing main branch.",
  },
];

type Props = {
  source: any;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
};

export default function ImportDataModal({
  source,
  open,
  onClose,
  onImported,
}: Props) {
  const { messageApi } = useMessageStore();
  const [targetId, setTargetId] = useState<number | undefined>();
  const [sections, setSections] = useState<string[]>(["PRODUCTS"]);
  const [duplicateStrategy, setDuplicateStrategy] = useState("SKIP");
  const [confirmation, setConfirmation] = useState("");
  const [preview, setPreview] = useState<any>(null);

  const consumersQuery = useQuery({
    queryKey: ["consumer-import-targets"],
    queryFn: async () => {
      const response = await axiosInstance.get(endpoints.consumer);
      return response.data;
    },
    enabled: open,
  });

  const historyQuery = useQuery({
    queryKey: ["consumer-data-import-history"],
    queryFn: async () => {
      const response = await axiosInstance.get(
        `${endpoints.consumerDataImports}?limit=20`,
      );
      return response.data;
    },
    enabled: open,
  });

  const targets = useMemo(
    () =>
      (consumersQuery.data || []).filter(
        (consumer: any) => consumer.id !== source?.id && !consumer.deleted_at,
      ),
    [consumersQuery.data, source?.id],
  );
  const target = targets.find((consumer: any) => consumer.id === targetId);
  const relatedHistory = (historyQuery.data || []).filter(
    (item: any) =>
      item.source_consumer_id === source?.id ||
      item.target_consumer_id === source?.id,
  );

  useEffect(() => {
    setPreview(null);
    setConfirmation("");
  }, [targetId, sections, duplicateStrategy]);

  const previewMutation = useMutation({
    mutationFn: async () => {
      const response = await axiosInstance.post(
        endpoints.consumerDataImportPreview,
        {
          source_consumer_id: source.id,
          target_consumer_id: targetId,
          sections,
        },
      );
      return response.data;
    },
    onSuccess: setPreview,
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const response = await axiosInstance.post(endpoints.consumerDataImports, {
        source_consumer_id: source.id,
        target_consumer_id: targetId,
        sections,
        duplicate_strategy: duplicateStrategy,
        confirm_target_subdomain: confirmation,
      });
      return response.data;
    },
    onSuccess: (result) => {
      const totals = Object.values(result.summary || {}).reduce(
        (
          acc: { created: number; updated: number; skipped: number },
          row: any,
        ) => ({
          created: acc.created + (row.created || 0),
          updated: acc.updated + (row.updated || 0),
          skipped: acc.skipped + (row.skipped || 0),
        }),
        { created: 0, updated: 0, skipped: 0 },
      );
      messageApi?.success(
        `Import completed: ${totals.created} created, ${totals.updated} updated, ${totals.skipped} skipped`,
      );
      onImported();
      onClose();
    },
  });

  const error = previewMutation.error || importMutation.error;
  const errorMessage = error
    ? getErrorMessage(error, "The import could not be completed.")
    : null;
  const canImport =
    preview && confirmation === target?.subdomain && !importMutation.isPending;

  return (
    <Modal
      open={open}
      width={760}
      title={`Import data from ${source?.company_name}`}
      okText="Import now"
      okButtonProps={{
        disabled: !canImport,
        loading: importMutation.isPending,
      }}
      onOk={() => importMutation.mutate()}
      onCancel={onClose}
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 20 }}
        message="One-way, repeatable snapshot"
        description="The source account is never changed. You can run this again later; previously imported records are recognized and reused."
      />

      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <div>
          <Text strong>Destination account</Text>
          <Select
            showSearch
            style={{ width: "100%", marginTop: 8 }}
            placeholder="Select the account that will receive the data"
            loading={consumersQuery.isLoading}
            value={targetId}
            onChange={setTargetId}
            optionFilterProp="label"
            options={targets.map((consumer: any) => ({
              value: consumer.id,
              label: `${consumer.company_name} (${consumer.subdomain})`,
            }))}
          />
        </div>

        <div>
          <Text strong>Information to import</Text>
          <Checkbox.Group
            value={sections}
            onChange={(values) => {
              const nextSections = values as string[];
              if (nextSections.includes("INVENTORY")) {
                setSections([
                  ...new Set([...nextSections, "PRODUCTS", "BRANCHES"]),
                ]);
              } else {
                setSections(nextSections);
              }
            }}
            style={{ display: "grid", gap: 12, marginTop: 10 }}
          >
            {sectionOptions.map((option) => (
              <Checkbox key={option.value} value={option.value}>
                <Text strong>{option.label}</Text>
                <br />
                <Text type="secondary">{option.description}</Text>
              </Checkbox>
            ))}
          </Checkbox.Group>
        </div>

        <div>
          <Text strong>When a matching record already exists</Text>
          <Radio.Group
            value={duplicateStrategy}
            onChange={(event) => setDuplicateStrategy(event.target.value)}
            style={{ display: "grid", gap: 8, marginTop: 10 }}
          >
            <Radio value="SKIP">
              Keep destination data (add only missing records)
            </Radio>
            <Radio value="UPDATE">
              Update destination matches with source values
            </Radio>
          </Radio.Group>
        </div>

        {duplicateStrategy === "UPDATE" && (
          <Alert
            type="warning"
            showIcon
            message="Matching destination records may be changed"
            description="Relationships remain attached to the destination records, but their imported fields will be replaced with the current source values."
          />
        )}

        <Button
          onClick={() => previewMutation.mutate()}
          loading={previewMutation.isPending}
          disabled={!targetId || sections.length === 0}
        >
          Preview import
        </Button>

        {preview && (
          <>
            <Descriptions bordered size="small" column={2}>
              {Object.entries(preview.counts || {}).map(([name, value]) => (
                <Descriptions.Item key={name} label={name.replace(/_/g, " ")}>
                  <Tag color="blue">{String(value)}</Tag>
                </Descriptions.Item>
              ))}
            </Descriptions>

            <div>
              <Paragraph style={{ marginBottom: 8 }}>
                To confirm the destination, type{" "}
                <Text code>{target?.subdomain}</Text>:
              </Paragraph>
              <Input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder={target?.subdomain}
                status={
                  confirmation && confirmation !== target?.subdomain
                    ? "error"
                    : undefined
                }
              />
            </div>
          </>
        )}

        {errorMessage && (
          <Alert
            type="error"
            showIcon
            message="Import could not continue"
            description={errorMessage}
          />
        )}

        <div>
          <Text strong>Recent imports involving this account</Text>
          <List
            size="small"
            loading={historyQuery.isLoading}
            locale={{ emptyText: "No import attempts yet" }}
            dataSource={relatedHistory}
            renderItem={(item: any) => (
              <List.Item>
                <Space direction="vertical" size={0} style={{ width: "100%" }}>
                  <Space wrap>
                    <Text>
                      {item.source?.company_name} → {item.target?.company_name}
                    </Text>
                    <Tag
                      color={
                        item.status === "COMPLETED"
                          ? "success"
                          : item.status === "FAILED"
                            ? "error"
                            : "processing"
                      }
                    >
                      {item.status}
                    </Tag>
                  </Space>
                  <Text type="secondary">
                    {(item.sections || []).join(", ")} ·{" "}
                    {new Date(item.created_at).toLocaleString()}
                  </Text>
                </Space>
              </List.Item>
            )}
          />
        </div>
      </Space>
    </Modal>
  );
}
