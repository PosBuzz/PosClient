import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server";
import { useAuthStore } from "../stores/authStore";
import { useMessageStore } from "../stores/messageStore";
import { useModalStore } from "../stores/modalStore";
import { clearTestQueryClients } from "./query-clients";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
class TestResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    void callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = TestResizeObserver;
const realGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = (element) => realGetComputedStyle(element);
window.scrollTo = () => {};
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  writable: true,
  value: () => null,
});
const initialAuth = useAuthStore.getState();
const initialMessage = useMessageStore.getState();
const initialModal = useModalStore.getState();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  clearTestQueryClients();
  server.resetHandlers();
  useAuthStore.setState(initialAuth, true);
  useMessageStore.setState(initialMessage, true);
  useModalStore.setState(initialModal, true);
  localStorage.clear();
  sessionStorage.clear();
});
afterAll(() => server.close());
