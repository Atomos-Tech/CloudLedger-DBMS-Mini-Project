import { z } from "zod";

export const createInstanceSchema = z.object({
  client_id: z.number().int().positive(),
  tier_id: z.number().int().positive(),
  dc_id: z.number().int().positive(),
});

export const updateInstanceStatusSchema = z.object({
  current_status: z.enum(["Running", "Stopped", "Terminated"]),
});

export const generateInvoiceSchema = z.object({
  client_id: z.number().int().positive(),
  billing_month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
});

export const ticketSearchSchema = z.object({
  query: z.string().min(3).max(500),
  limit: z.number().int().min(1).max(20).optional().default(5),
});

export const createTicketSchema = z.object({
  client_id: z.number().int().positive(),
  subject: z.string().min(3).max(200),
  body: z.string().min(3).max(5000),
});

export const updateClientSchema = z.object({
  account_status: z.enum(["Active", "Suspended", "Closed"]).optional(),
  billing_address: z.string().max(255).nullable().optional(),
});

export const updateInvoiceStatusSchema = z.object({
  payment_status: z.enum(["Pending", "Paid", "Overdue"]),
});

