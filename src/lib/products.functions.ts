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

const precosSchema = z.record(z.string(), z.number().nullable());
const impostosSchema = z.object({
  ivaSt: z.number().min(0).max(10).default(0),
  icms: z.number().min(0).max(1).default(0),
  ipi: z.number().min(0).max(1).default(0),
  pis: z.number().min(0).max(1).default(0),
  cofins: z.number().min(0).max(1).default(0),
});

const productSchema = z.object({
  codigo: z.string().min(1).max(64),
  descricao: z.string().min(1).max(500),
  apresentacao: z.string().max(200).default(""),
  ncm: z.string().max(32).default(""),
  classificacao: z.string().max(120).default(""),
  principioAtivo: z.string().max(500).default(""),
  validade: z.string().max(32).default(""),
  qtdPorEmbalagem: z.number().int().min(1).max(100000).default(1),
  linha: z.string().max(120).default(""),
  categoria: z.string().max(200).default(""),
  divisao: z.string().max(200).default(""),
  precos: precosSchema,
  impostos: impostosSchema,
});

type RowDb = {
  codigo: string;
  descricao: string;
  apresentacao: string;
  ncm: string;
  classificacao: string;
  principio_ativo: string;
  validade: string;
  qtd_por_embalagem: number;
  linha: string;
  categoria: string;
  divisao: string;
  precos: Record<string, number | null>;
  impostos: { ivaSt?: number; icms?: number; ipi?: number; pis?: number; cofins?: number };
};

function fromDb(r: RowDb) {
  return {
    codigo: r.codigo,
    descricao: r.descricao,
    apresentacao: r.apresentacao,
    ncm: r.ncm,
    classificacao: r.classificacao,
    principioAtivo: r.principio_ativo,
    validade: r.validade,
    qtdPorEmbalagem: r.qtd_por_embalagem,
    linha: r.linha,
    categoria: r.categoria,
    divisao: r.divisao,
    precos: r.precos ?? {},
    impostos: {
      ivaSt: r.impostos?.ivaSt ?? 0,
      icms: r.impostos?.icms ?? 0,
      ipi: r.impostos?.ipi ?? 0,
      pis: r.impostos?.pis ?? 0,
      cofins: r.impostos?.cofins ?? 0,
    },
  };
}

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("*")
      .order("descricao", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => fromDb(r as RowDb));
  });

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => productSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const row = {
      codigo: data.codigo,
      descricao: data.descricao,
      apresentacao: data.apresentacao,
      ncm: data.ncm,
      classificacao: data.classificacao,
      principio_ativo: data.principioAtivo,
      validade: data.validade,
      qtd_por_embalagem: data.qtdPorEmbalagem,
      linha: data.linha,
      categoria: data.categoria,
      divisao: data.divisao,
      precos: data.precos,
      impostos: data.impostos,
    };
    const { error } = await supabaseAdmin.from("products").upsert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ codigo: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("products").delete().eq("codigo", data.codigo);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
