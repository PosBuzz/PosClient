// Mirrors consumer/src/utils/api-error.ts — keep in sync
import { isAxiosError } from "axios";

// The one place that decides what an error toast says. The server's message is
// written for users (see docs/testing/phase-X4-error-messages.md), so show it;
// fall back to the caller's text only when there is nothing better.

const DEFAULT_FALLBACK = "Something went wrong. Please try again.";

const STATUS_MESSAGES: Record<number, string> = {
  401: "Your session has expired. Please log in again.",
  403: "You don't have permission to do this.",
  404: "That item could not be found. It may have been deleted.",
  413: "The file is too large to upload.",
  429: "Too many attempts. Please wait a minute and try again.",
};

// Framework defaults that say nothing useful to a shop owner
const GENERIC_SERVER_MESSAGES: Record<string, number> = {
  "Forbidden resource": 403,
  Unauthorized: 401,
  "Internal server error": 500,
};

const toText = (message: unknown): string | null => {
  if (typeof message === "string") return message.trim() || null;
  if (Array.isArray(message)) {
    const parts = message.filter(
      (part): part is string => typeof part === "string" && !!part.trim(),
    );
    return parts.length ? parts.join("; ") : null;
  }
  return null;
};

export function getErrorMessage(
  error: unknown,
  fallback: string = DEFAULT_FALLBACK,
): string {
  if (!isAxiosError(error)) return fallback;

  if (!error.response) {
    return error.code === "ECONNABORTED"
      ? "The request timed out. Please try again."
      : "Can't reach the server. Check your connection and try again.";
  }

  const { status, data } = error.response;
  // Download endpoints respond with a Blob even on errors; its text can't be
  // read synchronously, so use the caller's wording
  const serverMessage =
    data && typeof data === "object" && !(data instanceof Blob)
      ? toText((data as { message?: unknown }).message)
      : null;

  if (serverMessage && !(serverMessage in GENERIC_SERVER_MESSAGES)) {
    return serverMessage;
  }
  if (status >= 500) return fallback;
  return STATUS_MESSAGES[status] ?? fallback;
}
