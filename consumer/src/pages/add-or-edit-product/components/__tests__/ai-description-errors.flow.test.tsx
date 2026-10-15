import { screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../../api/endpoints";
import { fail } from "../../../../test/msw/api";
import { captureRequests } from "../../../../test/msw/capture";
import { renderWithProviders } from "../../../../test/render";
import AiDescriptionGenerator from "../AiDescriptionGenerator";

it("[CO-ERR-032] a failing AI service shows a readable fallback and re-enables the button", async () => {
  const onGenerated = vi.fn();
  const request = captureRequests("post", endpoints.generateDescription, () =>
    fail(500, "Internal server error"),
  );
  const { user } = renderWithProviders(
    <AiDescriptionGenerator
      productName="Rice"
      onDescriptionGenerated={onGenerated}
    />,
  );
  await user.click(screen.getByRole("button"));
  expect(
    await screen.findByText("Failed to generate description"),
  ).toBeInTheDocument();
  expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument();
  expect(request.calls).toHaveLength(1);
  expect(onGenerated).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole("button")).toBeEnabled());
});
