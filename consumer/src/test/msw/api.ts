import { HttpResponse, type DefaultBodyType } from "msw";
export const API = "http://api.test/api/v1";
export const ok = (body: DefaultBodyType) => HttpResponse.json(body);
export const fail = (status: number, message: string) =>
  HttpResponse.json({ statusCode: status, message }, { status });
