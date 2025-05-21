import React, { useState, useEffect, useRef } from "react";
import { Button, Tooltip, Modal, Rate, Input } from "antd";
import {
  RobotOutlined,
  LoadingOutlined,
  LikeOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "../api/ai-api";
import { useMessageStore } from "../stores/messageStore";

const { TextArea } = Input;

interface AiDescriptionGeneratorProps {
  productName: string;
  currentDescription: string;
  onDescriptionGenerated: (description: string) => void;
}

const AiDescriptionGenerator: React.FC<AiDescriptionGeneratorProps> = ({
  productName,
  currentDescription,
  onDescriptionGenerated,
}) => {
  const [generatedDescription, setGeneratedDescription] = useState("");
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [isFeedbackModalVisible, setIsFeedbackModalVisible] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(
    null
  );
  const lastGenerationTimeRef = useRef<number | null>(null);
  const lastProductNameRef = useRef<string | null>(null);
  const loadingTextAnimationRef = useRef<string>("");
  const loadingAnimationTimer = useRef<NodeJS.Timeout | null>(null);
  const { messageApi } = useMessageStore();

  // Loading message states
  const loadingMessages = [
    "Analyzing product...",
    "Generating description...",
    "Fine-tuning content...",
    "Almost ready...",
  ];
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  // Generate description mutation
  const generateMutation = useMutation({
    mutationFn: (forceRefresh: boolean) => {
      setGenerationStartTime(Date.now());
      lastGenerationTimeRef.current = Date.now();
      lastProductNameRef.current = productName;
      return aiApi.generateDescription({
        product: productName,
        force_refresh: forceRefresh,
      });
    },
    onSuccess: (response) => {
      // Stop any loading animation
      if (loadingAnimationTimer.current) {
        clearInterval(loadingAnimationTimer.current);
      }
      setGeneratedDescription(response.description);
      setCurrentTextIndex(0);
    },
    onError: (error) => {
      // Stop any loading animation
      if (loadingAnimationTimer.current) {
        clearInterval(loadingAnimationTimer.current);
      }
      console.error("Failed to generate description:", error);
      messageApi?.error("Failed to generate description");
    },
  });

  // Submit feedback mutation
  const feedbackMutation = useMutation({
    mutationFn: () =>
      aiApi.submitFeedback({
        product: productName,
        description: generatedDescription,
        rating: feedbackRating,
        comment: feedbackComment,
        user_edited_description: currentDescription,
      }),
    onSuccess: () => {
      messageApi?.success("Thank you for your feedback!");
      setIsFeedbackModalVisible(false);
      setFeedbackComment("");
      setFeedbackRating(0);
    },
    onError: () => {
      messageApi?.error("Failed to submit feedback");
    },
  });

  // Text streaming effect
  useEffect(() => {
    if (
      !generatedDescription ||
      currentTextIndex >= generatedDescription.length ||
      generateMutation.isPending
    )
      return;

    // Improved randomizer for more natural typing effect
    const randomDelay = Math.floor(Math.random() * 20) + 10; // 10-30ms delay
    const timer = setTimeout(() => {
      const newDisplayedText = generatedDescription.substring(
        0,
        currentTextIndex + 1
      );
      setCurrentTextIndex((prevIndex) => prevIndex + 1);

      // Update the form field in real-time as text is "typed"
      onDescriptionGenerated(newDisplayedText);
    }, randomDelay);

    return () => clearTimeout(timer);
  }, [
    currentTextIndex,
    generatedDescription,
    generateMutation.isPending,
    onDescriptionGenerated,
  ]);

  // Rotate through loading messages
  useEffect(() => {
    if (!generateMutation.isPending) return;

    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) =>
        prev < loadingMessages.length - 1 ? prev + 1 : prev
      );
    }, 2000);

    return () => clearInterval(interval);
  }, [generateMutation.isPending]);

  // Show streaming text in form when generation takes more than 5 seconds
  useEffect(() => {
    if (!generateMutation.isPending || !generationStartTime) {
      if (loadingAnimationTimer.current) {
        clearInterval(loadingAnimationTimer.current);
      }
      return;
    }

    // Start checking for elapsed time
    const checkTimeElapsed = setInterval(() => {
      if (Date.now() - generationStartTime > 5000) {
        // If we've already started the animation, avoid setting up again
        if (loadingAnimationTimer.current) return;

        // If 5+ seconds have passed, start the animated loading text
        startLoadingTextAnimation();
      }
    }, 1000);

    return () => clearInterval(checkTimeElapsed);
  }, [
    generateMutation.isPending,
    generationStartTime,
    loadingMessages,
  ]);

  // Function to animate the loading text
  const startLoadingTextAnimation = () => {
    let dots = "";
    let currentMsgIdx = loadingMessageIndex;

    // Clear any existing animation
    if (loadingAnimationTimer.current) {
      clearInterval(loadingAnimationTimer.current);
    }

    // Start animation timer
    loadingAnimationTimer.current = setInterval(() => {
      // Update dots animation
      dots = dots.length < 3 ? dots + "." : "";

      // Every 6 cycles (approximately 1.5 seconds), check if we should update the message
      if (dots === "") {
        currentMsgIdx = loadingMessageIndex;
      }

      // Update the loading text with animated dots
      const animatedText = `${loadingMessages[currentMsgIdx]}${dots}`;
      loadingTextAnimationRef.current = animatedText;

      // Update the form field with the animated text
      onDescriptionGenerated(animatedText);
    }, 250);
  };

  const handleGenerateDescription = () => {
    if (!productName) {
      messageApi?.warning("Please enter a product name first");
      return;
    }

    // Reset any previous animation
    if (loadingAnimationTimer.current) {
      clearInterval(loadingAnimationTimer.current);
      loadingAnimationTimer.current = null;
    }

    // Check if we're within 1.5 minutes of the last generation AND product name hasn't changed
    const now = Date.now();
    const forceRefresh: boolean =
      lastGenerationTimeRef.current !== null &&
      now - lastGenerationTimeRef.current < 90000 && // 1.5 minutes = 90000ms
      lastProductNameRef.current === productName; // Check if product name is the same

    setLoadingMessageIndex(0);
    generateMutation.mutate(forceRefresh);
  };

  const handleSubmitFeedback = () => {
    feedbackMutation.mutate();
  };

  return (
    <>
      <div className="flex gap-2">
        {/* AI Generate Button */}
        <Tooltip
          title={
            generateMutation.isPending
              ? "Generating..."
              : "Generate AI description"
          }
        >
          <Button
            icon={
              generateMutation.isPending ? (
                <LoadingOutlined />
              ) : lastGenerationTimeRef.current &&
                Date.now() - lastGenerationTimeRef.current < 90000 &&
                lastProductNameRef.current === productName ? (
                <SyncOutlined />
              ) : (
                <RobotOutlined />
              )
            }
            onClick={handleGenerateDescription}
            type="text"
            size="small"
            disabled={!productName || generateMutation.isPending}
          >
            {generateMutation.isPending
              ? loadingMessages[loadingMessageIndex]
              : ""}
          </Button>
        </Tooltip>

        {/* Feedback Button - only visible after generation */}
        {generatedDescription && !generateMutation.isPending && (
          <Tooltip title="Provide feedback">
            <Button
              icon={<LikeOutlined />}
              onClick={() => setIsFeedbackModalVisible(true)}
              type="text"
              size="small"
            />
          </Tooltip>
        )}
      </div>

      {/* Feedback Modal */}
      <Modal
        title="Description Feedback"
        open={isFeedbackModalVisible}
        onCancel={() => setIsFeedbackModalVisible(false)}
        onOk={handleSubmitFeedback}
        confirmLoading={feedbackMutation.isPending}
        okText="Submit Feedback"
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2">How would you rate this description?</p>
            <Rate value={feedbackRating} onChange={setFeedbackRating} />
          </div>

          <div>
            <p className="mb-2">Comments (optional):</p>
            <TextArea
              rows={4}
              placeholder="Tell us what you think about the generated description"
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </>
  );
};

export default AiDescriptionGenerator;
