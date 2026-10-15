// Mirrors consumer/src/test/msw/handlers.ts — keep in sync
import { http } from "msw";
import { endpoints } from "../../api/endpoints";
import { API, ok } from "./api";
import { fixtures } from "./contracts";
import { responseContract } from "../contracts/load";
export const defaultHandlers = [
  http.get(`${API}${endpoints.csrfToken}`, () => ok(fixtures.csrf)),
  http.get(`${API}${endpoints.getMe}`, () => ok(fixtures.authAdmin)),
  http.get(`${API}${endpoints.consumer}`, () =>
    ok(responseContract("admin-consumers")),
  ),
  http.get(`${API}${endpoints.plan}`, () =>
    ok(responseContract("admin-plans")),
  ),
];
