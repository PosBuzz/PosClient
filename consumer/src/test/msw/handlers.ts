import { http } from "msw";
import { endpoints } from "../../api/endpoints";
import { API, ok } from "./api";
import { fixtures } from "./contracts";
export const defaultHandlers = [
  http.get(`${API}${endpoints.csrfToken}`, () => ok(fixtures.csrf)),
  http.get(`${API}${endpoints.getMe}`, () => ok(fixtures.authClient)),
  http.get(`${API}${endpoints.validateSubdomain}`, () =>
    ok(fixtures.subdomain),
  ),
];
