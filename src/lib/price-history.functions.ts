import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

export interface PriceChange {
  tabela: string;
  de: number | null;
  para: number | null;
}

export interface PriceHistoryRow {
  id: string;
  codigo: string;
  descricao: string;
  operation: string;
  user_email: string | null;
  created_at: string;
  changes: PriceChange[];
}

type AuditRecord = {
  id: string;
  record_id: string | null;
  operation: string;
  user_email: string | null;
  created_at: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
};

function precosOf(d: Record<string, unknown> | null): Record<string, number | null> {
  const p = (d?.["precos"] ?? {}) as Record<string, unknown>;
  const out: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(p)) out[k] = v == null ? null : Number(v);
  return out;
}

export const listPriceHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        codigo: z.string().max(40).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.number().min(1).max(1000).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    let q = supabaseAdmin
      .from("audit_log" as never)
      .select("id,record_id,operation,user_email,created_at,old_data,new_data")
      .eq("table_name", "products")
      .in("operation", ["INSERT", "UPDATE"])
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 300);

    if (data.codigo) q = q.ilike("record_id", `%${data.codigo}%`);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const result: PriceHistoryRow[] = [];
    for (const r of (rows ?? []) as unknown as AuditRecord[]) {
      const oldP = precosOf(r.old_data);
      const newP = precosOf(r.new_data);
      const keys = Array.from(new Set([...Object.keys(oldP), ...Object.keys(newP)]));
      const changes = keys
        .filter((k) => (oldP[k] ?? null) !== (newP[k] ?? null))
        .map((k) => ({ tabela: k, de: oldP[k] ?? null, para: newP[k] ?? null }));
      if (changes.length === 0) continue;
      result.push({
        id: r.id,
        codigo: r.record_id ?? "",
        descricao: String((r.new_data?.["descricao"] ?? r.old_data?.["descricao"] ?? "") as string),
        operation: r.operation,
        user_email: r.user_email,
        created_at: r.created_at,
        changes,
      });
    }
    return result;
  });
