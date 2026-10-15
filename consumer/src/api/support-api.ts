import { get, patch, post } from "./crud-api";
import { endpoints } from "./endpoints";

export type SupportTicketStatus =
  "OPEN" | "IN_PROGRESS" | "WAITING_ON_CUSTOMER" | "RESOLVED" | "CLOSED";

export type SupportTicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type SupportTicketCategory =
  "BILLING" | "TECHNICAL" | "FEATURE_REQUEST" | "ACCOUNT" | "OTHER";

export interface SupportTicketMessage {
  id: number;
  body: string;
  author_type: "CONSUMER" | "SUPER_ADMIN";
  created_at: string;
  consumer_user?: { id: number; name: string } | null;
  super_admin?: { id: number; name: string } | null;
}

export interface SupportTicket {
  id: number;
  subject: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  last_reply_at: string;
  closed_at?: string | null;
  created_at: string;
  created_by?: { id: number; name: string };
  assigned_to?: { id: number; name: string } | null;
  messages?: SupportTicketMessage[];
  _count?: { messages: number };
}

export interface SupportTicketInput {
  subject: string;
  category: SupportTicketCategory;
  priority?: SupportTicketPriority;
  message: string;
}

export const supportApi = {
  list: (params: { status?: SupportTicketStatus; search?: string }) =>
    get(endpoints.supportTickets, params) as Promise<SupportTicket[]>,
  detail: (id: number) =>
    get(endpoints.supportTicket(id)) as Promise<SupportTicket>,
  create: (data: SupportTicketInput) =>
    post(endpoints.supportTickets, data) as Promise<SupportTicket>,
  reply: (id: number, body: string) =>
    post(endpoints.supportTicketMessages(id), {
      body,
    }) as Promise<SupportTicket>,
  close: (id: number) =>
    patch(endpoints.closeSupportTicket(id), {}) as Promise<SupportTicket>,
  reopen: (id: number) =>
    patch(endpoints.reopenSupportTicket(id), {}) as Promise<SupportTicket>,
};
