import { screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/render";
import Page from "../index";

it("[AD-SMOKE-test] renders the public lead-form iframe without console errors", () => {
  const errors = vi.spyOn(console, "error");
  renderWithProviders(<Page />, { user: null });
  expect(screen.getByTitle("Service Lead Form")).toBeVisible();
  expect(errors).not.toHaveBeenCalled();
});
