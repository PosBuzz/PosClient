import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { getErrorMessage } from "./api-error";

const failure = (status: number, data: unknown) =>
  new AxiosError("failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data,
    statusText: "",
    headers: {},
    config: {} as never,
  });

describe("getErrorMessage", () => {
  it("[CO-ERR-001] shows the server's message string", () => {
    expect(
      getErrorMessage(
        failure(400, { message: "Insufficient stock for variant 7." }),
        "Failed",
      ),
    ).toBe("Insufficient stock for variant 7.");
  });

  it("[CO-ERR-002] joins an array of messages with semicolons", () => {
    expect(
      getErrorMessage(
        failure(400, {
          message: ["Quantity is required", "Price is required"],
        }),
        "Failed",
      ),
    ).toBe("Quantity is required; Price is required");
  });

  it("[CO-ERR-003] explains a network failure without a response", () => {
    const error = new AxiosError("Network Error", "ERR_NETWORK");
    expect(getErrorMessage(error, "Failed")).toBe(
      "Can't reach the server. Check your connection and try again.",
    );
  });

  it("[CO-ERR-004] explains a timeout", () => {
    const error = new AxiosError("timeout", "ECONNABORTED");
    expect(getErrorMessage(error, "Failed")).toBe(
      "The request timed out. Please try again.",
    );
  });

  it("[CO-ERR-005] uses the caller's fallback for a 5xx without a message", () => {
    expect(getErrorMessage(failure(500, {}), "Failed to create sale")).toBe(
      "Failed to create sale",
    );
    expect(
      getErrorMessage(
        failure(500, { message: "Internal server error" }),
        "Failed to create sale",
      ),
    ).toBe("Failed to create sale");
  });

  it("[CO-ERR-006] translates Nest's generic 403 into a friendly message", () => {
    expect(
      getErrorMessage(
        failure(403, { message: "Forbidden resource" }),
        "Failed",
      ),
    ).toBe("You don't have permission to do this.");
  });

  it("[CO-ERR-007] falls back for non-Axios errors and blob bodies", () => {
    expect(getErrorMessage(new Error("boom"), "Failed")).toBe("Failed");
    expect(getErrorMessage(failure(400, new Blob(["x"])), "Failed")).toBe(
      "Failed",
    );
  });

  it("[CO-ERR-008] never returns an empty string or [object Object]", () => {
    for (const data of [
      { message: "" },
      { message: {} },
      { message: [] },
      null,
      undefined,
    ]) {
      const text = getErrorMessage(failure(400, data), "Failed");
      expect(text).not.toBe("");
      expect(text).not.toContain("[object Object]");
    }
  });
});
