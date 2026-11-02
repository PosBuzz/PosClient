import { screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import POS from "../index";

beforeEach(() => {
  server.use(
    http.get(`${API}${endpoints.getCustomers}`, () => ok({ data: [] })),
    http.get(`${API}${endpoints.user}`, () => ok({ data: [] })),
    http.get(`${API}${endpoints.getProductsForSale}`, () => ok([])),
    http.get(`${API}${endpoints.activePromotions}`, () => ok([])),
  );
});

describe("POS theme pill", () => {
  it("[CO-FLOW-POS-023] the Dark and Light pill switches the app theme and remembers it", async () => {
    localStorage.setItem("isDarkMode", "false");
    const { user } = renderWithProviders(<POS />, {
      route: "/pos",
      path: "/pos",
    });
    const dark = await screen.findByRole("button", { name: /Dark/ });
    const light = screen.getByRole("button", { name: /Light/ });
    expect(light).toHaveAttribute("aria-pressed", "true");

    await user.click(dark);
    await waitFor(() => expect(dark).toHaveAttribute("aria-pressed", "true"));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("themeSettings")).toBe("dark");
    expect(localStorage.getItem("isDarkMode")).toBe("true");

    await user.click(light);
    await waitFor(() => expect(light).toHaveAttribute("aria-pressed", "true"));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("isDarkMode")).toBe("false");
  });
});
