import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  from: z.string(),
  to: z.string(),
  vendedorIds: z.array(z.string()).optional(),
});

interface PayloadItem {
  product?: {
    codigo?: string;
    descricao?: string;
    apresentacao?: string;
    ncm?: string;
  };
  qtyAdjusted?: number;
  qty?: number;
  unitPrice?: number;
  desconto?: number;
}

interface PayloadShape {
  cliente?: string;
  codCliente?: string;
  cnpj?: string;
  cidade?: string;
  uf?: string;
  vendedor?: string;
  tabela?: string;
  observacoes?: string;
  items?: PayloadItem[];
  totals?: {
    valorTotalNota?: number;
    subtotal?: number;
    ipi?: number;
    icms?: number;
    st?: number;
    pis?: number;
    cofins?: number;
  };
}

export interface PedidoExportRow {
  numero: number;
  data_pedido: string;
  vendedor: string;
  cliente: string;
  cnpj: string;
  cidade: string;
  uf: string;
  tabela: string;
  qtd_itens: number;
  subtotal: number;
  ipi: number;
  icms: number;
  st: number;
  pis: number;
  cofins: number;
  total: number;
  observacoes: string;
  created_at: string;
}

export interface ItemExportRow {
  numero_pedido: number;
  data_pedido: string;
  vendedor: string;
  cliente: string;
  codigo: string;
  descricao: string;
  apresentacao: string;
  ncm: string;
  quantidade: number;
  preco_unit: number;
  total_item: number;
}

export const exportPedidos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw new Error("Acesso restrito a administradores");

    let q = supabase
      .from("pedidos")
      .select("id, numero, user_id, data_pedido, created_at, total, nome, payload")
      .gte("data_pedido", data.from)
      .lte("data_pedido", data.to)
      .order("data_pedido", { ascending: true })
      .limit(10000);

    if (data.vendedorIds?.length) q = q.in("user_id", data.vendedorIds);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, nome, email")
      .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const nameOf = new Map((profs ?? []).map((p) => [p.id, p.nome || p.email || ""]));

    const pedidos: PedidoExportRow[] = [];
    const itens: ItemExportRow[] = [];

    for (const r of rows ?? []) {
      const p = (r.payload ?? {}) as PayloadShape;
      const vendedor = nameOf.get(r.user_id) ?? "";
      const cliente = (p.cliente ?? r.nome ?? "").trim();
      const t = p.totals ?? {};
      const items = p.items ?? [];

      pedidos.push({
        numero: r.numero,
        data_pedido: r.data_pedido,
        vendedor,
        cliente,
        cnpj: p.cnpj ?? "",
        cidade: p.cidade ?? "",
        uf: p.uf ?? "",
        tabela: p.tabela ?? "",
        qtd_itens: items.length,
        subtotal: Number(t.subtotal ?? 0),
        ipi: Number(t.ipi ?? 0),
        icms: Number(t.icms ?? 0),
        st: Number(t.st ?? 0),
        pis: Number(t.pis ?? 0),
        cofins: Number(t.cofins ?? 0),
        total: Number(r.total ?? t.valorTotalNota ?? 0),
        observacoes: p.observacoes ?? "",
        created_at: r.created_at,
      });

      for (const it of items) {
        const qtd = Number(it.qtyAdjusted ?? it.qty ?? 0);
        const preco = Number(it.unitPrice ?? 0);
        itens.push({
          numero_pedido: r.numero,
          data_pedido: r.data_pedido,
          vendedor,
          cliente,
          codigo: it.product?.codigo ?? "",
          descricao: it.product?.descricao ?? "",
          apresentacao: it.product?.apresentacao ?? "",
          ncm: it.product?.ncm ?? "",
          quantidade: qtd,
          preco_unit: preco,
          total_item: qtd * preco,
        });
      }
    }

    return { pedidos, itens };
  });
