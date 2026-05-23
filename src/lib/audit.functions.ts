import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export interface AuditRow {
  id: string;
  table_name: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  record_id: string | null;
  user_id: string | null;
  user_email: string | null;
  old_data: Json | null;
  new_data: Json | null;
  created_at: string;
}

export const listAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        tables: z.array(z.string().min(1).max(64)).max(10).optional(),
        operation: z.enum(["INSERT", "UPDATE", "DELETE"]).optional(),
        userId: z.string().uuid().optional(),
        search: z.string().max(120).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.number().min(1).max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    let q = supabaseAdmin
      .from("audit_log" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);

    if (data.tables && data.tables.length > 0) q = q.in("table_name", data.tables);
    if (data.operation) q = q.eq("operation", data.operation);
    if (data.userId) q = q.eq("user_id", data.userId);
    if (data.search) q = q.ilike("record_id", `%${data.search}%`);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as AuditRow[];
  });
