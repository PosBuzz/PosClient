import { useEffect, useRef } from "react";

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
  const barcodeBufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);
  const onBarcodeScannedRef = useRef(onBarcodeScanned);
  const onSubmitRef = useRef(onSubmit);

  useEffect(() => {
    onBarcodeScannedRef.current = onBarcodeScanned;
  }, [onBarcodeScanned]);

  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  useEffect(() => {
    barcodeBufferRef.current = "";
    lastKeyTimeRef.current = 0;
  }, [selectedBranch]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyPress = (event: KeyboardEvent) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;
      const activeElement = document.activeElement as HTMLElement;

      if (timeDiff > 100) {
        barcodeBufferRef.current = "";
      }

      lastKeyTimeRef.current = currentTime;

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
        if (barcodeBufferRef.current.length > 0) {
          event.preventDefault();
          event.stopPropagation();
          void onBarcodeScannedRef.current(barcodeBufferRef.current);
          barcodeBufferRef.current = "";
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        onSubmitRef.current();
        return;
      }

      if (event.key.length === 1 && /[a-zA-Z0-9\-_]/.test(event.key)) {
        const isVeryFastTyping = timeDiff < 30;
        const hasExistingBuffer = barcodeBufferRef.current.length > 0;
        const isLikelyBarcodeScanner = isVeryFastTyping || hasExistingBuffer;

        if (isLikelyBarcodeScanner) {
          event.preventDefault();
          event.stopPropagation();
          barcodeBufferRef.current += event.key;

          if (activeElement && activeElement.blur) {
            activeElement.blur();
          }
          return;
        }

        barcodeBufferRef.current += event.key;
      }
    };

    document.addEventListener("keydown", handleKeyPress, true);

    return () => {
      document.removeEventListener("keydown", handleKeyPress, true);
    };
  }, [enabled]);
};
