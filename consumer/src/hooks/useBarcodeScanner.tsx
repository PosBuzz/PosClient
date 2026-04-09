import { useEffect, useState } from "react";

interface UseBarcodeScannerArgs {
  selectedBranch: number | null;
  onBarcodeScanned: (barcode: string) => void | Promise<void>;
  onSubmit: () => void;
  enabled?: boolean;
}

// Listens for rapid keyboard inputs to detect physical barcode scanners, buffers the characters while ignoring active input fields, and triggers the scanned callback or form submission on Enter.
export const useBarcodeScanner = ({
  selectedBranch,
  onBarcodeScanned,
  onSubmit,
  enabled = true,
}: UseBarcodeScannerArgs) => {
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const [lastKeyTime, setLastKeyTime] = useState(0);

  useEffect(() => {
    setBarcodeBuffer("");
    setLastKeyTime(0);
  }, [selectedBranch]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyPress = (event: KeyboardEvent) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;
      const activeElement = document.activeElement as HTMLElement;

      if (timeDiff > 100) {
        setBarcodeBuffer("");
      }

      setLastKeyTime(currentTime);

      const isTypingInInput =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.role === "textbox" ||
          activeElement.classList.contains(
            "ant-select-selection-search-input",
          ) ||
          activeElement.classList.contains("ant-input") ||
          activeElement.classList.contains("ant-input-number-input") ||
          activeElement.closest(".ant-select-dropdown") ||
          activeElement.closest(".ant-input") ||
          activeElement.closest(".ant-input-number") ||
          activeElement.getAttribute("contenteditable") === "true");

      if (isTypingInInput) {
        return;
      }

      if (event.key === "Enter") {
        if (barcodeBuffer.length > 0) {
          event.preventDefault();
          event.stopPropagation();
          void onBarcodeScanned(barcodeBuffer);
          setBarcodeBuffer("");
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        onSubmit();
        return;
      }

      if (event.key.length === 1 && /[a-zA-Z0-9\-_]/.test(event.key)) {
        const isVeryFastTyping = timeDiff < 30;
        const hasExistingBuffer = barcodeBuffer.length > 0;
        const isLikelyBarcodeScanner = isVeryFastTyping || hasExistingBuffer;

        if (isLikelyBarcodeScanner) {
          event.preventDefault();
          event.stopPropagation();
          setBarcodeBuffer((prev) => prev + event.key);

          if (activeElement && activeElement.blur) {
            activeElement.blur();
          }
          return;
        }

        setBarcodeBuffer((prev) => prev + event.key);
      }
    };

    document.addEventListener("keydown", handleKeyPress, true);

    return () => {
      document.removeEventListener("keydown", handleKeyPress, true);
    };
  }, [
    enabled,
    lastKeyTime,
    barcodeBuffer,
    selectedBranch,
    onBarcodeScanned,
    onSubmit,
  ]);
};
