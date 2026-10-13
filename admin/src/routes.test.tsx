import { Suspense, type ReactElement } from "react";
import { screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { routes } from "./routes";
import RequireAuth from "./components/RequireAuth";
import RequirePermission from "./components/RequirePermission";
import { renderWithProviders } from "./test/render";

it("[AD-ROUTE-001] the app root requires auth and business pages retain permission gates", () => {
  const root = routes.find((route) => route.path === "/")!;
  expect(root.element.type).toBe(RequireAuth);
  const permissions = root
    .children!.filter((route) => !route.index)
    .map((route) => {
      const element = route.element as ReactElement<{ permission: string }>;
      expect(element.type).toBe(RequirePermission);
      return [route.path, element.props.permission];
    });
  expect(permissions).toEqual([
    ["consumers", "show_consumers"],
    ["plans", "plans"],
    ["billings", "billing"],
    ["portfolio", "portfolio"],
    ["support", "support"],
    ["roles", "users"],
    ["users", "users"],
    ["backup&restore", "backup&restore"],
    ["account&security", "profile"],
  ]);
});

it("[AD-ROUTE-002] /test is a public external lead form (characterization: confirm intent)", async () => {
  const route = routes.find((route) => route.path === "/test")!;
  expect(route.element.type).not.toBe(RequireAuth);
  renderWithProviders(
    <Suspense fallback={<span>Loading test page</span>}>
      {route.element}
    </Suspense>,
    { user: null, route: "/test" },
  );
  const frame = await screen.findByTitle("Service Lead Form");
  expect(frame.tagName).toBe("IFRAME");
});
