import { Button, DatePicker, Modal, Select, Table } from "antd";
import { screen, waitFor } from "@testing-library/react";
import { useParams } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import axiosInstance from "../api/axiosInstance";
import { endpoints } from "../api/endpoints";
import { useAuthStore } from "../stores/authStore";
import { useMessageStore } from "../stores/messageStore";
import { useModalStore } from "../stores/modalStore";
import { renderWithProviders } from "./render";
import { fixtures } from "./msw/contracts";

describe("consumer harness", { concurrent: false }, () => {
  it("[CO-HARN-001] real antd controls render and interact without console errors", async () => {
    const error = vi.spyOn(console, "error");
    const { user } = renderWithProviders(
      <>
        <Button>Action</Button>
        <Select
          aria-label="Choice"
          options={[{ value: "one", label: "One" }]}
        />
        <Modal open title="Harness modal">
          Modal content
        </Modal>
        <Table
          columns={[{ title: "Name", dataIndex: "name" }]}
          dataSource={[{ key: "1", name: "Test row" }]}
        />
        <DatePicker aria-label="Date" />
      </>,
    );
    await waitFor(() =>
      expect(screen.getByText("Modal content")).toBeVisible(),
    );
    expect(screen.getByText("Test row")).toBeVisible();
    await user.click(screen.getByRole("combobox", { name: "Choice" }));
    await user.click(await screen.findByText("One"));
    await user.click(screen.getByRole("textbox", { name: "Date" }));
    await screen.findByRole("button", { name: /next month/i });
    expect(error).not.toHaveBeenCalled();
  });
  it("[CO-HARN-002] unplanned HTTP requests fail and MSW reports them", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      axiosInstance.get(`${endpoints.getMe}/unplanned`),
    ).rejects.toThrow();
    expect(error).toHaveBeenCalledWith(expect.stringContaining("[MSW]"));
  });
  it("[CO-HARN-003] mutates auth, query and browser storage for reset verification", () => {
    const { queryClient } = renderWithProviders(<span>State A</span>, {
      permissions: ["sales"],
    });
    queryClient.setQueryData(["state-a"], 123);
    useAuthStore.getState().setCsrfToken("changed");
    localStorage.setItem("a", "changed");
    sessionStorage.setItem("a", "changed");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
  it("[CO-HARN-003] next test starts with clean auth, query and storage", () => {
    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      isAuthenticated: false,
      isAuthLoading: true,
      csrfToken: null,
    });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    const { queryClient } = renderWithProviders(<span>State B</span>, {
      user: null,
    });
    expect(queryClient.getQueryData(["state-a"])).toBeUndefined();
  });
  it("[CO-HARN-004] test API URL overrides local environment", () =>
    expect(import.meta.env.VITE_API_BASE_URL).toBe("http://api.test/api/v1"));
  it("[CO-HARN-005] default handlers match auth, CSRF and subdomain endpoint contracts", async () => {
    expect((await axiosInstance.get(endpoints.csrfToken)).data).toEqual(
      fixtures.csrf,
    );
    expect((await axiosInstance.get(endpoints.getMe)).data).toEqual(
      fixtures.authClient,
    );
    expect((await axiosInstance.get(endpoints.validateSubdomain)).data).toEqual(
      fixtures.subdomain,
    );
  });
  it("[CO-HARN-006] provider order exposes route parameters, permissions and UI services", async () => {
    function RouteProbe() {
      const { id } = useParams();
      return <span>Sale {id}</span>;
    }
    const { queryClient } = renderWithProviders(<RouteProbe />, {
      route: "/sales/view/42",
      path: "/sales/view/:id",
      user: { name: "Reviewer" },
      permissions: ["sales"],
    });
    expect(screen.getByText("Sale 42")).toBeVisible();
    expect(useAuthStore.getState().user).toMatchObject({
      name: "Reviewer",
      permissions: ["sales"],
    });
    await waitFor(() => {
      expect(useMessageStore.getState().messageApi).not.toBeNull();
      expect(useModalStore.getState().modal).not.toBeNull();
    });
    expect(queryClient.getDefaultOptions()).toMatchObject({
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    });
  });
});
