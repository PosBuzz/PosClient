import {
  LoadingOutlined,
  RobotOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import { Button, Tooltip } from "antd";
import { useRef } from "react";
import { aiApi } from "../../../api/ai-api";
import { useMessageStore } from "../../../stores/messageStore";
import { getErrorMessage } from "../../../utils/api-error";

// Small action button that generates description text from AI for the current product name.

interface AiDescriptionGeneratorProps {
  productName: string;
  onDescriptionGenerated: (description: string) => void;
}

export default function AiDescriptionGenerator({
  productName,
  onDescriptionGenerated,
}: AiDescriptionGeneratorProps) {
  const { messageApi } = useMessageStore();
  // Used to detect repeated requests for the same product in a short time window.
  const lastGenerationTimeRef = useRef<number | null>(null);
  const lastProductNameRef = useRef<string | null>(null);

  const generateMutation = useMutation({
    // Uses `force_refresh` for quick repeated clicks on same product name.
    mutationFn: (forceRefresh: boolean) => {
      lastGenerationTimeRef.current = Date.now();
      lastProductNameRef.current = productName;
      return aiApi.generateDescription({
        product: productName,
        force_refresh: forceRefresh,
      });
    },
    onSuccess: (response) => {
      onDescriptionGenerated(response.description || "");
      messageApi?.success("Description generated");
    },
    onError: (error) => {
      messageApi?.error(
        getErrorMessage(error, "Failed to generate description"),
      );
    },
  });

  const handleGenerateDescription = () => {
    // Guard against empty product name before calling AI endpoint.
    if (!productName.trim()) {
      messageApi?.warning("Please enter a product name first");
      return;
    }

    const now = Date.now();
    const shouldForceRefresh =
      lastGenerationTimeRef.current !== null &&
      now - lastGenerationTimeRef.current < 90000 &&
      lastProductNameRef.current === productName;

    generateMutation.mutate(shouldForceRefresh);
  };

  const showRefreshIcon =
    // UI hint that next click will request a refresh for recent generation.
    lastGenerationTimeRef.current !== null &&
    Date.now() - lastGenerationTimeRef.current < 90000 &&
    lastProductNameRef.current === productName;

  return (
    <Tooltip
      title={
        generateMutation.isPending
          ? "Generating description..."
          : "Generate AI description"
      }
    >
      <Button
        type="text"
        size="small"
        onClick={handleGenerateDescription}
        disabled={!productName.trim() || generateMutation.isPending}
        icon={
          generateMutation.isPending ? (
            <LoadingOutlined />
          ) : showRefreshIcon ? (
            <SyncOutlined />
          ) : (
            <RobotOutlined />
          )
        }
      />
    </Tooltip>
  );
}
