import { render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter, Route, Routes, matchRoutes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import RequireAuth from "./components/RequireAuth";
import RequirePermission from "./components/RequirePermission";
import { Permissions } from "./constants/permissions";
import { MENU_ITEMS, visibleMenuItems, type MenuItem } from "./menuItems";
import { routes } from "./routes";
import { useAuthStore } from "./stores/authStore";
import { authUser } from "./test/msw/contracts";

type RouteDef = {
  path?: string;
  index?: boolean;
  element?: ReactElement;
  children?: RouteDef[];
};

/** Finds the permission a route's element is wrapped in by walking the React element tree. */
function permissionOf(node: ReactNode): string | string[] | undefined {
  if (!node || typeof node !== "object" || !("props" in node)) return undefined;
  const element = node as ReactElement<{
    permission?: string;
    children?: ReactNode;
  }>;
  if (element.type === RequirePermission) return element.props.permission;
  const kids = element.props?.children;
  for (const child of Array.isArray(kids) ? kids : [kids]) {
    const found = permissionOf(child);
    if (found) return found;
  }
  return undefined;
}
const hasAuth = (node: ReactNode): boolean => {
  if (!node || typeof node !== "object" || !("props" in node)) return false;
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (element.type === RequireAuth) return true;
  const kids = element.props?.children;
  return (Array.isArray(kids) ? kids : [kids]).some(hasAuth);
};

function flatten(
  defs: RouteDef[],
  parent = "",
  parentAuth = false,
): Array<{
  path: string;
  permission?: string | string[];
  authenticated: boolean;
}> {
  return defs.flatMap((def) => {
    const path = def.index
      ? parent || "/"
      : `${parent}/${def.path ?? ""}`
          .replace(/\/+/g, "/")
          .replace(/(.)\/$/, "$1");
    const authenticated = parentAuth || hasAuth(def.element);
    const own = def.element
      ? [{ path, permission: permissionOf(def.element), authenticated }]
      : [];
    return [
      ...own,
      ...(def.children
        ? flatten(def.children, path === "/" ? "" : path, authenticated)
        : []),
    ];
  });
}
const flat = flatten(routes as RouteDef[]);
const guarded = flat.filter((r) => r.permission);

describe("route permissions", () => {
  it("[CO-ROUTE-001] the permission each route demands is pinned in a reviewed file", async () => {
    const table = Object.fromEntries(
      guarded.map((r) => [r.path, r.permission]),
    );
    await expect(`${JSON.stringify(table, null, 2)}\n`).toMatchFileSnapshot(
      "./__snapshots__/route-permissions.json",
    );
  });

  it("[CO-ROUTE-002] every demanded permission is a real permission", () => {
    const known = new Set(Object.values(Permissions));
    expect(
      guarded
        .filter((r) => ![r.permission!].flat().every((p) => known.has(p)))
        .map((r) => `${r.path}: ${r.permission}`),
    ).toEqual([]);
    expect(guarded.length).toBeGreaterThan(55);
  });

  it("[CO-ROUTE-006] only the public pages are reachable without signing in", () => {
    const open = flat
      .filter((r) => !r.authenticated)
      .map((r) => r.path)
      .sort();
    expect(open).toEqual(["/*", "/404", "/inactive", "/login"].sort());
  });
});

describe("route guards", () => {
  const page = <div>the page</div>;
  const show = (ui: ReactElement, path = "/") =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route path="/login" element={<div>login screen</div>} />
          <Route path="/secret" element={ui} />
        </Routes>
      </MemoryRouter>,
    );

  it("[CO-ROUTE-003] a user without the permission is sent home; with it the page shows", () => {
    for (const permission of new Set(
      guarded.flatMap((r) => [r.permission!].flat()),
    )) {
      useAuthStore.setState({
        user: {
          ...authUser,
          permissions: Object.values(Permissions).filter(
            (p) => p !== permission,
          ),
        },
        isAuthenticated: true,
      });
      const denied = show(
        <RequirePermission permission={permission}>{page}</RequirePermission>,
        "/secret",
      );
      expect({ permission, home: !!screen.queryByText("home") }).toEqual({
        permission,
        home: true,
      });
      expect(screen.queryByText("the page")).toBeNull();
      denied.unmount();
      useAuthStore.setState({
        user: { ...authUser, permissions: [permission] },
      });
      const allowed = show(
        <RequirePermission permission={permission}>{page}</RequirePermission>,
        "/secret",
      );
      expect(screen.getByText("the page")).toBeInTheDocument();
      allowed.unmount();
    }
  });

  it("[CO-ROUTE-004] RequireAuth shows a loader while checking, sends visitors to /login, and lets signed-in users through", () => {
    useAuthStore.setState({ isAuthLoading: true, isAuthenticated: false });
    const loading = show(<RequireAuth>{page}</RequireAuth>, "/secret");
    expect(screen.queryByText("the page")).toBeNull();
    expect(screen.queryByText("login screen")).toBeNull();
    loading.unmount();
    useAuthStore.setState({ isAuthLoading: false, isAuthenticated: false });
    const out = show(<RequireAuth>{page}</RequireAuth>, "/secret");
    expect(screen.getByText("login screen")).toBeInTheDocument();
    out.unmount();
    useAuthStore.setState({ isAuthLoading: false, isAuthenticated: true });
    show(<RequireAuth>{page}</RequireAuth>, "/secret");
    expect(screen.getByText("the page")).toBeInTheDocument();
  });

  it("[CO-ROUTE-005] RequirePermission waits for the user, and without a permission prop lets everyone through", () => {
    useAuthStore.setState({ user: null });
    const waiting = show(
      <RequirePermission permission={Permissions.sales}>
        {page}
      </RequirePermission>,
      "/secret",
    );
    expect(screen.queryByText("the page")).toBeNull();
    waiting.unmount();
    useAuthStore.setState({ user: { ...authUser, permissions: [] } });
    show(<RequirePermission>{page}</RequirePermission>, "/secret");
    expect(screen.getByText("the page")).toBeInTheDocument();
  });
});

describe("menu against routes", () => {
  const leaves = (items: MenuItem[]): MenuItem[] =>
    items.flatMap((item) => (item.children ? leaves(item.children) : [item]));
  const routeFor = (key: string) => {
    const match = matchRoutes(routes as never, key);
    return match && match[match.length - 1].route.path !== "*" ? match : null;
  };

  it("[CO-MENU-003] every menu entry opens a real page", () => {
    const missing = leaves(MENU_ITEMS)
      .map((item) => item.key)
      .filter((key) => !routeFor(key));
    expect(missing).toEqual([]);
  });

  it("[CO-MENU-001] the permissions that show a menu entry are the ones its page demands", () => {
    const byPath = new Map(flat.map((r) => [r.path, r.permission]));
    const mismatches = leaves(MENU_ITEMS)
      .filter((item) => item.permissions?.length)
      .flatMap((item) => {
        const required = byPath.get(item.key);
        if (!required) {
          return [
            `${item.key}: the page demands no permission but the menu hides it behind ${item.permissions}`,
          ];
        }
        return [required].flat().every((p) => item.permissions!.includes(p))
          ? []
          : [
              `${item.key}: the menu shows it for ${item.permissions} but the page demands ${required}`,
            ];
      });
    expect(mismatches).toEqual([]);
  });

  it("[CO-MENU-002] what each kind of user sees in the menu", () => {
    const labels = (permissions: string[]) =>
      visibleMenuItems(MENU_ITEMS, permissions).flatMap((item) => [
        item.key,
        ...(item.children?.map((child) => child.key) ?? []),
      ]);
    expect(labels([])).toEqual(["/"]);
    const salesOnly = labels([Permissions.sales]);
    expect(salesOnly).toEqual(
      expect.arrayContaining([
        "/sales-menu",
        "/sales/new",
        "/returns",
        "/promotions",
      ]),
    );
    expect(salesOnly).not.toContain("/inventory");
    expect(labels(Object.values(Permissions)).length).toBeGreaterThan(45);
  });

  it("[CO-MENU-004] a parent with no visible child disappears", () => {
    const keys = visibleMenuItems(MENU_ITEMS, [Permissions.support]).map(
      (item) => item.key,
    );
    expect(keys).toEqual(["/", "/support"]);
  });
});
