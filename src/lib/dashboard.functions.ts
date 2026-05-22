import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  from: z.string(), // ISO date (YYYY-MM-DD)
  to: z.string(),
  vendedorIds: z.array(z.string()).optional(),
});

interface PayloadShape {
  cliente?: string;
  codCliente?: string;
  vendedor?: string;
  tabela?: string;
  items?: Array<{
    product?: { codigo?: string; descricao?: string };
    qtyAdjusted?: number;
    unitPrice?: number;
  }>;
  totals?: { valorTotalNota?: number };
}

export const getDashboardMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verifica se é admin
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

    if (data.vendedorIds && data.vendedorIds.length) {
      q = q.in("user_id", data.vendedorIds);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Carregar nomes dos vendedores
    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, nome, email")
      .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const nameOf = new Map((profs ?? []).map((p) => [p.id, p.nome || p.email || p.id.slice(0, 8)]));

    // Lista completa de vendedores (para filtro)
    const { data: allVendedores } = await supabase
      .from("profiles")
      .select("id, nome, email")
      .order("nome");

    const pedidos = (rows ?? []).map((r) => ({
      ...r,
      payload: (r.payload ?? {}) as PayloadShape,
      total: Number(r.total ?? 0),
    }));

    // Agregações
    let faturamento = 0;
    const clientes = new Set<string>();
    const porDia = new Map<string, { faturamento: number; pedidos: number }>();
    const porVendedor = new Map<string, { faturamento: number; pedidos: number }>();
    const porCliente = new Map<string, { faturamento: number; pedidos: number }>();
    const porProduto = new Map<string, { codigo: string; descricao: string; qtd: number; faturamento: number }>();
    const porTabela = new Map<string, { faturamento: number; pedidos: number }>();

    for (const p of pedidos) {
      const total = p.total || Number(p.payload?.totals?.valorTotalNota ?? 0);
      faturamento += total;

      const cliente = (p.payload?.cliente || p.nome || "").trim();
      if (cliente) clientes.add(cliente.toLowerCase());

      const dia = p.data_pedido;
      const d = porDia.get(dia) ?? { faturamento: 0, pedidos: 0 };
      d.faturamento += total; d.pedidos += 1;
      porDia.set(dia, d);

      const vname = nameOf.get(p.user_id) ?? p.user_id.slice(0, 8);
      const v = porVendedor.get(vname) ?? { faturamento: 0, pedidos: 0 };
      v.faturamento += total; v.pedidos += 1;
      porVendedor.set(vname, v);

      if (cliente) {
        const c = porCliente.get(cliente) ?? { faturamento: 0, pedidos: 0 };
        c.faturamento += total; c.pedidos += 1;
        porCliente.set(cliente, c);
      }

      const tab = p.payload?.tabela || "—";
      const t = porTabela.get(tab) ?? { faturamento: 0, pedidos: 0 };
      t.faturamento += total; t.pedidos += 1;
      porTabela.set(tab, t);

      for (const it of p.payload?.items ?? []) {
        const codigo = it.product?.codigo ?? "";
        if (!codigo) continue;
        const desc = it.product?.descricao ?? codigo;
        const qtd = Number(it.qtyAdjusted ?? 0);
        const fat = qtd * Number(it.unitPrice ?? 0);
        const pp = porProduto.get(codigo) ?? { codigo, descricao: desc, qtd: 0, faturamento: 0 };
        pp.qtd += qtd; pp.faturamento += fat;
        porProduto.set(codigo, pp);
      }
    }

    const totalPedidos = pedidos.length;
    const ticketMedio = totalPedidos ? faturamento / totalPedidos : 0;

    return {
      resumo: {
        totalPedidos,
        faturamento,
        ticketMedio,
        clientesUnicos: clientes.size,
      },
      porDia: Array.from(porDia.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([dia, v]) => ({ dia, ...v })),
      porVendedor: Array.from(porVendedor.entries())
        .map(([nome, v]) => ({ nome, ...v }))
        .sort((a, b) => b.faturamento - a.faturamento)
        .slice(0, 10),
      porCliente: Array.from(porCliente.entries())
        .map(([nome, v]) => ({ nome, ...v }))
        .sort((a, b) => b.faturamento - a.faturamento)
        .slice(0, 10),
      porProduto: Array.from(porProduto.values())
        .sort((a, b) => b.faturamento - a.faturamento)
        .slice(0, 20),
      porTabela: Array.from(porTabela.entries())
        .map(([nome, v]) => ({ nome, ...v }))
        .sort((a, b) => b.faturamento - a.faturamento),
      vendedores: (allVendedores ?? []).map((p) => ({
        id: p.id,
        nome: p.nome || p.email || p.id.slice(0, 8),
      })),
    };
  });
