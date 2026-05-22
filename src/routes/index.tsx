import { useEffect, useMemo, useState } from "react";
import logo from "@/assets/rioquimica-logo.jpeg";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  products as ALL_PRODUCTS,
  priceTables,
  categorias,
  roundToBox,
  brl,
  calcItemTaxes,
  type PriceTable,
  type Product,
} from "@/lib/products";

export const Route = createFileRoute("/")({ component: PedidosPage });

interface OrderItem {
  product: Product;
  qtyTyped: number;
  qtyAdjusted: number;
  unitPrice: number;
}

function PedidosPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!auth.loading && !auth.user) navigate({ to: "/login" });
  }, [auth.loading, auth.user, navigate]);

  // Cabeçalho
  const [cliente, setCliente] = useState("");
  const [codCliente, setCodCliente] = useState("");
  const [prazo, setPrazo] = useState("28 DDL");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [vencimento, setVencimento] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  });
  const [vendedor, setVendedor] = useState("");
  const [obs, setObs] = useState("");

  // Configurações
  const [tabela, setTabela] = useState<PriceTable>("RQE Especialista");
  const [roundMode, setRoundMode] = useState<"auto" | "suggest" | "off">("auto");

  const allowPrecoEscolha = mounted && (auth.isAdmin || auth.canUsePrecoEscolha);
  const availableTables = useMemo(
    () => priceTables.filter((t) => allowPrecoEscolha || t !== "Preço de Escolha"),
    [allowPrecoEscolha],
  );
  useEffect(() => {
    if (!allowPrecoEscolha && tabela === "Preço de Escolha") {
      setTabela("RQE Especialista");
    }
  }, [allowPrecoEscolha, tabela]);

  // Catálogo
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("");

  // Pedido
  const [items, setItems] = useState<OrderItem[]>([]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ALL_PRODUCTS.filter((p) => {
      if (catFilter && p.categoria !== catFilter) return false;
      if (!q) return true;
      return (
        p.codigo.toLowerCase().includes(q) ||
        p.descricao.toLowerCase().includes(q) ||
        p.principioAtivo.toLowerCase().includes(q) ||
        p.categoria.toLowerCase().includes(q)
      );
    }).slice(0, 80);
  }, [search, catFilter]);

  function priceOf(p: Product): number {
    const v = p.precos[tabela];
    if (v != null) return v;
    // fallback to first available
    for (const t of priceTables) {
      const x = p.precos[t];
      if (x != null) return x;
    }
    return 0;
  }

  function addProduct(p: Product) {
    const price = priceOf(p);
    if (!price) {
      alert(`Sem preço cadastrado em "${tabela}" para ${p.descricao}.`);
      return;
    }
    setItems((prev) => {
      const i = prev.findIndex((it) => it.product.codigo === p.codigo);
      if (i >= 0) {
        const nx = [...prev];
        const newTyped = nx[i].qtyTyped + p.qtdPorEmbalagem;
        nx[i] = {
          ...nx[i],
          qtyTyped: newTyped,
          qtyAdjusted: roundToBox(newTyped, p.qtdPorEmbalagem, roundMode === "off" ? "off" : "auto"),
          unitPrice: price,
        };
        return nx;
      }
      return [
        ...prev,
        {
          product: p,
          qtyTyped: p.qtdPorEmbalagem,
          qtyAdjusted: p.qtdPorEmbalagem,
          unitPrice: price,
        },
      ];
    });
  }

  function updateQty(idx: number, value: number) {
    setItems((prev) => {
      const nx = [...prev];
      const it = nx[idx];
      const box = it.product.qtdPorEmbalagem;
      const adjusted =
        roundMode === "auto"
          ? roundToBox(value, box, "auto")
          : roundMode === "suggest"
          ? roundToBox(value, box, "auto")
          : Math.max(0, Math.round(value));
      nx[idx] = { ...it, qtyTyped: value, qtyAdjusted: roundMode === "auto" ? adjusted : value };
      return nx;
    });
  }

  function applySuggestion(idx: number) {
    setItems((prev) => {
      const nx = [...prev];
      const it = nx[idx];
      const adj = roundToBox(it.qtyTyped, it.product.qtdPorEmbalagem, "auto");
      nx[idx] = { ...it, qtyAdjusted: adj, qtyTyped: adj };
      return nx;
    });
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function clearOrder() {
    if (confirm("Limpar todos os itens do pedido?")) setItems([]);
  }

  const totals = useMemo(() => {
    let totalGeral = 0, totalUnidades = 0, totalCaixas = 0;
    let baseIcms = 0, vIcms = 0, baseIpi = 0, vIpi = 0;
    let baseSt = 0, vSt = 0, vPis = 0, vCofins = 0;
    for (const it of items) {
      const t = calcItemTaxes(it.unitPrice, it.qtyAdjusted, it.product);
      totalGeral += t.base;
      totalUnidades += it.qtyAdjusted;
      totalCaixas += Math.ceil(it.qtyAdjusted / Math.max(1, it.product.qtdPorEmbalagem));
      baseIcms += t.base; vIcms += t.icms;
      baseIpi += t.base; vIpi += t.ipi;
      baseSt += t.stBase; vSt += t.st;
      vPis += t.pis; vCofins += t.cofins;
    }
    const valorTotalNota = totalGeral + vIpi + vSt;
    return {
      totalGeral, totalUnidades, totalCaixas, itens: items.length,
      baseIcms, vIcms, baseIpi, vIpi, baseSt, vSt, vPis, vCofins, valorTotalNota,
    };
  }, [items]);

  const [saving, setSaving] = useState(false);

  async function savePedido() {
    if (!auth.user) {
      alert("Faça login para salvar.");
      return;
    }
    if (!cliente.trim()) {
      alert("Informe o nome do cliente antes de salvar.");
      return;
    }
    if (!items.length) {
      alert("Adicione pelo menos um item ao pedido.");
      return;
    }
    const payload = {
      cliente, codCliente, prazo, data, vencimento, vendedor, obs, tabela, roundMode, items, totals,
      savedAt: new Date().toISOString(),
    };
    setSaving(true);
    try {
      const { error } = await supabase.from("pedidos").insert({
        user_id: auth.user.id,
        nome: cliente.trim(),
        data_pedido: data,
        payload: payload as never,
      });
      if (error) throw error;
      // Backup local
      localStorage.setItem(`pedido_${Date.now()}`, JSON.stringify(payload));
      alert(`Pedido "${cliente.trim()}" salvo em ${new Date(data).toLocaleDateString("pt-BR")}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Erro ao salvar pedido: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  // ===== Histórico =====
  interface PedidoRow {
    id: string;
    nome: string;
    data_pedido: string;
    created_at: string;
    user_id: string;
    payload: {
      cliente?: string;
      codCliente?: string;
      vendedor?: string;
      vencimento?: string;
      prazo?: string;
      data?: string;
      obs?: string;
      tabela?: PriceTable;
      roundMode?: "auto" | "suggest" | "off";
      items?: OrderItem[];
    };
    profile_nome?: string;
  }
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pedidos, setPedidos] = useState<PedidoRow[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [fNome, setFNome] = useState("");
  const [fData, setFData] = useState("");
  const [fCliente, setFCliente] = useState("");
  const [fCodigo, setFCodigo] = useState("");
  const [fVendedor, setFVendedor] = useState("");

  async function openHistory() {
    setHistoryOpen(true);
    setHistLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from("pedidos")
        .select("id, nome, data_pedido, created_at, user_id, payload")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      // RLS retorna apenas os do usuário; admin recebe todos.
      let mapped = (rows ?? []) as unknown as PedidoRow[];
      if (auth.isAdmin && mapped.length) {
        const ids = Array.from(new Set(mapped.map((r) => r.user_id)));
        const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", ids);
        const map = new Map((profs ?? []).map((p: { id: string; nome: string }) => [p.id, p.nome]));
        mapped = mapped.map((r) => ({ ...r, profile_nome: map.get(r.user_id) ?? "" }));
      }
      setPedidos(mapped);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setHistLoading(false);
    }
  }

  const filteredPedidos = useMemo(() => {
    return pedidos.filter((p) => {
      if (fNome && !p.nome.toLowerCase().includes(fNome.toLowerCase())) return false;
      if (fData && p.data_pedido !== fData) return false;
      if (fCliente && !(p.payload?.codCliente ?? "").toLowerCase().includes(fCliente.toLowerCase())) return false;
      if (fCodigo && !p.id.toLowerCase().includes(fCodigo.toLowerCase())) return false;
      if (fVendedor && !(p.payload?.vendedor ?? "").toLowerCase().includes(fVendedor.toLowerCase())) return false;
      return true;
    });
  }, [pedidos, fNome, fData, fCliente, fCodigo, fVendedor]);

  function loadPedido(p: PedidoRow) {
    const pl = p.payload ?? {};
    setCliente(pl.cliente ?? p.nome ?? "");
    setCodCliente(pl.codCliente ?? "");
    setPrazo(pl.prazo ?? "28 DDL");
    setData(pl.data ?? p.data_pedido);
    setVencimento(pl.vencimento ?? "");
    setVendedor(pl.vendedor ?? "");
    setObs(pl.obs ?? "");
    if (pl.tabela) setTabela(pl.tabela);
    if (pl.roundMode) setRoundMode(pl.roundMode);
    setItems((pl.items ?? []) as OrderItem[]);
    setHistoryOpen(false);
  }

  async function loadLogoDataUrl(): Promise<string | null> {
    try {
      const res = await fetch(logo);
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result as string);
        r.onerror = () => resolve(null);
        r.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  async function exportPDF() {
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const pedidoNum = `#${Date.now().toString().slice(-6)}`;
    const RED: [number, number, number] = [200, 30, 40];

    // Logo
    const logoData = await loadLogoDataUrl();
    if (logoData) {
      try { doc.addImage(logoData, "JPEG", 10, 6, 22, 18); } catch { /* ignore */ }
    }

    // Cabeçalho fornecedor
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...RED);
    doc.setFontSize(12);
    doc.text("RIOQUIMICA S.A", 34, 11);
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("AV. TARRAF, Nr. 2590/2600", 34, 15);
    doc.text("TEL: 55-17-4009-4288", 34, 19);
    doc.text("CNPJ: 55.643.555/0001-43", 34, 23);

    // Bloco direito - confirmação
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...RED);
    doc.setFontSize(11);
    doc.text("CONFIRMAÇÃO DO PEDIDO", W - 10, 11, { align: "right" });
    doc.setTextColor(0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`EMISSÃO: ${new Date().toLocaleDateString("pt-BR")}`, W - 10, 15, { align: "right" });
    doc.text(`PEDIDO Nº ${pedidoNum}`, W - 10, 19, { align: "right" });
    

    // Linha divisória
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.4);
    doc.line(10, 26, W - 10, 26);
    doc.setLineWidth(0.2);


    // Bloco cliente
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`CLIENTE: ${codCliente || "-"}`, 10, 32);
    doc.setFont("helvetica", "normal");
    doc.text(cliente || "-", 10, 36);
    doc.text(`VENDEDOR: ${vendedor || "-"}`, 10, 40);
    doc.text(`COND. PGTO: ${prazo || "-"}`, 10, 44);
    doc.text(`DATA PEDIDO: ${new Date(data).toLocaleDateString("pt-BR")}`, W / 2 + 10, 32);
    if (vencimento) {
      doc.text(`VENCIMENTO PROPOSTA: ${new Date(vencimento).toLocaleDateString("pt-BR")}`, W / 2 + 70, 32);
    }
    doc.text(`Nº ITENS: ${items.length}`, W / 2 + 10, 36);
    doc.text(`Nº VOLUMES: ${totals.totalCaixas}`, W / 2 + 10, 40);
    doc.text(`UNIDADES: ${totals.totalUnidades}`, W / 2 + 10, 44);

    doc.line(10, 48, W - 10, 48);

    // Tabela de itens
    autoTable(doc, {
      startY: 52,
      head: [["IT", "Produto", "Descrição", "UM", "Qtd.Vendida", "Valor Unit.", "Total", "Vlr IPI", "Vlr ST"]],
      body: items.map((it, i) => {
        const t = calcItemTaxes(it.unitPrice, it.qtyAdjusted, it.product);
        return [
          String(i + 1).padStart(2, "0"),
          it.product.codigo,
          `${it.product.descricao} ${it.product.apresentacao}`.trim(),
          "UN",
          it.qtyAdjusted.toLocaleString("pt-BR", { minimumFractionDigits: 0 }),
          it.unitPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
          t.base.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
          t.ipi.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
          t.st.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        ];
      }),
      styles: { fontSize: 7.5, cellPadding: 1.2, lineColor: [180, 180, 180], lineWidth: 0.1 },
      headStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: "bold", lineColor: [120, 120, 120] },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 25 },
        2: { cellWidth: "auto" as unknown as number },
        3: { cellWidth: 10, halign: "center" },
        4: { cellWidth: 22, halign: "right" },
        5: { cellWidth: 22, halign: "right" },
        6: { cellWidth: 24, halign: "right" },
        7: { cellWidth: 20, halign: "right" },
        8: { cellWidth: 20, halign: "right" },
      },
    });

    // @ts-expect-error lastAutoTable
    let endY = doc.lastAutoTable.finalY + 2;

    // Linha de totais (T O T A I S)
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("T O T A I S", 12, endY + 4);
    doc.text(totals.totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 }), W - 56, endY + 4, { align: "right" });
    doc.text(totals.vIpi.toLocaleString("pt-BR", { minimumFractionDigits: 2 }), W - 32, endY + 4, { align: "right" });
    doc.text(totals.vSt.toLocaleString("pt-BR", { minimumFractionDigits: 2 }), W - 12, endY + 4, { align: "right" });

    endY += 8;

    // Tabela resumo de impostos (footer estilo nota)
    autoTable(doc, {
      startY: endY,
      head: [["Base ICMS", "Valor ICMS", "Base IPI", "Valor IPI", "Base ST", "Valor ST", "Valor PIS", "Valor COFINS", "Valor Total"]],
      body: [[
        totals.baseIcms.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        totals.vIcms.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        totals.baseIpi.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        totals.vIpi.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        totals.baseSt.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        totals.vSt.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        totals.vPis.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        totals.vCofins.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        totals.valorTotalNota.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      ]],
      styles: { fontSize: 7.5, cellPadding: 1.2, halign: "right", lineColor: [120, 120, 120], lineWidth: 0.1 },
      headStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: "bold", halign: "center" },
      margin: { left: 10, right: 10 },
    });

    // @ts-expect-error lastAutoTable
    endY = doc.lastAutoTable.finalY + 6;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`VALOR TOTAL DO PEDIDO: ${brl(totals.valorTotalNota)}`, W - 10, endY, { align: "right" });

    if (obs) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("MENSAGEM / OBSERVAÇÕES:", 10, endY + 6);
      doc.setFont("helvetica", "normal");
      doc.text(doc.splitTextToSize(obs, W - 20), 10, endY + 10);
    }

    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 10, H - 6);
    doc.text(`Pedido ${pedidoNum}`, W - 10, H - 6, { align: "right" });

    const filename = `pedido_${(cliente || "cliente").replace(/\s+/g, "_")}_${data}.pdf`;
    doc.save(filename);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Topbar */}
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="max-w-[1500px] mx-auto px-3 sm:px-6 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src={logo} alt="Rioquímica" className="w-10 h-10 shrink-0 rounded-md object-contain" />
            <div className="min-w-0">
              <h1 className="font-bold leading-tight text-sm sm:text-base truncate" suppressHydrationWarning>
                {(() => {
                  if (!mounted) return "Olá!";
                  const h = new Date().getHours();
                  const saud = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
                  const nome = (auth.nome || auth.user?.email?.split("@")[0] || "").split(" ")[0];
                  return nome ? `${saud}, ${nome}!` : `${saud}!`;
                })()}
              </h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                Sistema de Pedidos · {ALL_PRODUCTS.length} produtos
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {auth.isAdmin && (
              <Link
                to="/admin"
                title="Painel do administrador"
                className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition inline-flex items-center gap-1.5 shadow-sm"
              >
                <span aria-hidden>⚙</span> Admin
              </Link>
            )}
            <span className="hidden xl:inline text-xs text-muted-foreground px-2 truncate max-w-[160px]">
              {auth.nome || auth.user?.email}
            </span>
            <button onClick={openHistory} className="px-3 py-2 text-xs sm:text-sm rounded-md border border-border hover:bg-muted transition">
              Histórico
            </button>
            <button onClick={savePedido} disabled={saving} className="px-3 py-2 text-xs sm:text-sm rounded-md border border-border hover:bg-muted transition disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button
              onClick={exportPDF}
              disabled={!items.length}
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              Gerar PDF
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/login" });
              }}
              className="px-3 py-2 text-xs sm:text-sm rounded-md border border-border hover:bg-muted transition"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto px-6 py-6 grid grid-cols-12 gap-6">
        {/* Catálogo */}
        <section className="col-span-12 md:col-span-5 xl:col-span-4">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border space-y-3">
              <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Catálogo</h2>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por código, descrição, princípio ativo..."
                className="w-full px-3 py-2 rounded-md bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Categoria</label>
                  <select
                    value={catFilter}
                    onChange={(e) => setCatFilter(e.target.value)}
                    className="mt-1 w-full px-2 py-2 rounded-md bg-background border border-input text-sm"
                  >
                    <option value="">Todas categorias</option>
                    {categorias.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Tabela de preço</label>
                  <select
                    value={tabela}
                    onChange={(e) => setTabela(e.target.value as PriceTable)}
                    className="mt-1 w-full px-2 py-2 rounded-md bg-background border border-input text-sm font-medium"
                  >
                    {availableTables.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto divide-y divide-border">
              {filtered.map((p) => {
                const price = priceOf(p);
                return (
                  <button
                    key={p.codigo}
                    onClick={() => addProduct(p)}
                    className="w-full text-left p-3 hover:bg-muted/60 transition flex items-start gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{p.codigo}</span>
                        <span className="px-1.5 py-0.5 rounded bg-accent text-accent-foreground text-[10px]">
                          {p.linha}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate">{p.descricao}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.apresentacao} · Cx {p.qtdPorEmbalagem}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{price ? brl(price) : "—"}</div>
                      <div className="text-[10px] text-muted-foreground">+ adicionar</div>
                    </div>
                  </button>
                );
              })}
              {!filtered.length && (
                <div className="p-6 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</div>
              )}
            </div>
          </div>
        </section>

        {/* Pedido */}
        <section className="col-span-12 md:col-span-7 xl:col-span-8 space-y-6">
          {/* Dados do pedido */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-4">Dados do pedido</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Cliente" value={cliente} onChange={setCliente} />
              <Field label="Código do cliente" value={codCliente} onChange={setCodCliente} />
              <Field label="Vendedor" value={vendedor} onChange={setVendedor} />
              <Field label="Prazo de pagamento" value={prazo} onChange={setPrazo} />
              <Field label="Data do pedido" type="date" value={data} onChange={setData} />
              <Field label="Vencimento da proposta" type="date" value={vencimento} onChange={setVencimento} />
              <div>
                <label className="text-xs text-muted-foreground">Modo de arredondamento</label>
                <select
                  value={roundMode}
                  onChange={(e) => setRoundMode(e.target.value as "auto" | "suggest" | "off")}
                  className="mt-1 w-full px-3 py-2 rounded-md bg-background border border-input text-sm"
                >
                  <option value="auto">Automático (ajusta ao confirmar)</option>
                  <option value="suggest">Sugestão (mostra antes)</option>
                  <option value="off">Desligado</option>
                </select>
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs text-muted-foreground">Observações</label>
              <textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={2}
                className="mt-1 w-full px-3 py-2 rounded-md bg-background border border-input text-sm"
              />
            </div>
          </div>

          {/* Itens */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                Itens do pedido ({items.length})
              </h2>
              {items.length > 0 && (
                <button onClick={clearOrder} className="text-xs text-destructive hover:underline">
                  Limpar tudo
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                Selecione produtos no catálogo ao lado para começar.
              </div>
            ) : (
              <div className="overflow-auto max-h-[55vh]">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground sticky top-0 z-10">
                    <tr>
                      <th className="text-left px-3 py-2">Código</th>
                      <th className="text-left px-3 py-2">Produto</th>
                      <th className="text-center px-3 py-2">Cx</th>
                      <th className="text-center px-3 py-2">Qtd digitada</th>
                      <th className="text-center px-3 py-2">Qtd ajustada</th>
                      <th className="text-right px-3 py-2">Preço un.</th>
                      <th className="text-right px-3 py-2">Total</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((it, idx) => {
                      const box = it.product.qtdPorEmbalagem;
                      const suggested = roundToBox(it.qtyTyped, box, "auto");
                      const needsSuggestion =
                        roundMode === "suggest" && suggested !== it.qtyTyped && box > 1;
                      return (
                        <tr key={it.product.codigo} className="hover:bg-muted/30">
                          <td className="px-3 py-2 font-mono text-xs">{it.product.codigo}</td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{it.product.descricao}</div>
                            <div className="text-xs text-muted-foreground">{it.product.apresentacao}</div>
                          </td>
                          <td className="px-3 py-2 text-center">{box}</td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="number"
                              min={0}
                              value={it.qtyTyped}
                              onChange={(e) => updateQty(idx, Number(e.target.value) || 0)}
                              className="w-20 px-2 py-1 text-center rounded border border-input bg-background"
                            />
                            {needsSuggestion && (
                              <button
                                onClick={() => applySuggestion(idx)}
                                className="block mx-auto mt-1 text-[11px] px-2 py-0.5 rounded bg-warning text-warning-foreground hover:opacity-90"
                                title={`Arredondar para ${suggested}`}
                              >
                                → {suggested}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center font-semibold">
                            {it.qtyAdjusted}
                            <div className="text-[10px] text-muted-foreground">
                              {Math.ceil(it.qtyAdjusted / box)} cx
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-xs text-muted-foreground">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                value={it.unitPrice}
                                onChange={(e) =>
                                  setItems((prev) => {
                                    const nx = [...prev];
                                    nx[idx] = { ...nx[idx], unitPrice: Number(e.target.value) || 0 };
                                    return nx;
                                  })
                                }
                                className={`w-24 px-2 py-1 text-right rounded border border-input bg-background ${
                                  it.unitPrice !== priceOf(it.product) ? "ring-1 ring-warning" : ""
                                }`}
                                title={`Tabela: ${brl(priceOf(it.product))}`}
                              />
                            </div>
                            {it.unitPrice !== priceOf(it.product) && (
                              <button
                                onClick={() =>
                                  setItems((prev) => {
                                    const nx = [...prev];
                                    nx[idx] = { ...nx[idx], unitPrice: priceOf(nx[idx].product) };
                                    return nx;
                                  })
                                }
                                className="text-[10px] text-muted-foreground hover:underline mt-0.5"
                              >
                                restaurar tabela
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold">
                            {brl(it.unitPrice * it.qtyAdjusted)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => removeItem(idx)}
                              className="text-destructive hover:underline text-xs"
                            >
                              remover
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totais */}
            {items.length > 0 && (
              <>
                <div className="border-t border-border bg-muted/30 px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Stat label="Itens" value={String(totals.itens)} />
                  <Stat label="Unidades" value={String(totals.totalUnidades)} />
                  <Stat label="Volumes (caixas)" value={String(totals.totalCaixas)} />
                  <Stat label="Total produtos" value={brl(totals.totalGeral)} />
                </div>
                <div className="border-t border-border bg-card px-5 py-4">
                  <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-3">
                    Impostos do pedido
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 text-sm">
                    <Stat label="Base ICMS" value={brl(totals.baseIcms)} />
                    <Stat label="Valor ICMS" value={brl(totals.vIcms)} />
                    <Stat label="Base IPI" value={brl(totals.baseIpi)} />
                    <Stat label="Valor IPI" value={brl(totals.vIpi)} />
                    <Stat label="Base ST" value={brl(totals.baseSt)} />
                    <Stat label="Valor ST" value={brl(totals.vSt)} />
                    <Stat label="Valor PIS" value={brl(totals.vPis)} />
                    <Stat label="Valor COFINS" value={brl(totals.vCofins)} />
                    <div className="md:col-span-2 lg:col-span-2">
                      <Stat label="Valor total da nota" value={brl(totals.valorTotalNota)} highlight />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </main>

      {historyOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          onClick={() => setHistoryOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Histórico de pedidos</h2>
                <p className="text-xs text-muted-foreground">
                  {auth.isAdmin ? "Todos os pedidos (admin)" : "Seus pedidos"}
                </p>
              </div>
              <button
                onClick={() => setHistoryOpen(false)}
                className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted"
              >
                Fechar
              </button>
            </div>

            <div className="p-4 border-b border-border grid grid-cols-2 md:grid-cols-5 gap-2">
              <input
                value={fNome}
                onChange={(e) => setFNome(e.target.value)}
                placeholder="Nome"
                className="px-3 py-2 rounded-md bg-background border border-input text-sm"
              />
              <input
                type="date"
                value={fData}
                onChange={(e) => setFData(e.target.value)}
                className="px-3 py-2 rounded-md bg-background border border-input text-sm"
              />
              <input
                value={fCliente}
                onChange={(e) => setFCliente(e.target.value)}
                placeholder="Cód. cliente"
                className="px-3 py-2 rounded-md bg-background border border-input text-sm"
              />
              <input
                value={fCodigo}
                onChange={(e) => setFCodigo(e.target.value)}
                placeholder="Código do pedido"
                className="px-3 py-2 rounded-md bg-background border border-input text-sm"
              />
              <input
                value={fVendedor}
                onChange={(e) => setFVendedor(e.target.value)}
                placeholder="Vendedor"
                className="px-3 py-2 rounded-md bg-background border border-input text-sm"
              />
            </div>

            <div className="flex-1 overflow-auto">
              {histLoading ? (
                <p className="p-6 text-sm text-muted-foreground text-center">Carregando...</p>
              ) : filteredPedidos.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground text-center">Nenhum pedido encontrado.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2">Código</th>
                      <th className="text-left px-3 py-2">Nome</th>
                      <th className="text-left px-3 py-2">Cód. cliente</th>
                      <th className="text-left px-3 py-2">Vendedor</th>
                      <th className="text-left px-3 py-2">Data</th>
                      {auth.isAdmin && <th className="text-left px-3 py-2">Usuário</th>}
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredPedidos.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono text-xs">#{p.id.slice(0, 8)}</td>
                        <td className="px-3 py-2">{p.nome}</td>
                        <td className="px-3 py-2">{p.payload?.codCliente || "—"}</td>
                        <td className="px-3 py-2">{p.payload?.vendedor || "—"}</td>
                        <td className="px-3 py-2">
                          {new Date(p.data_pedido).toLocaleDateString("pt-BR")}
                        </td>
                        {auth.isAdmin && (
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {p.profile_nome || p.user_id.slice(0, 8)}
                          </td>
                        )}
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => loadPedido(p)}
                            className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
                          >
                            Carregar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2 rounded-md bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`mt-1 font-bold ${highlight ? "text-xl text-primary" : "text-base"}`}>{value}</div>
    </div>
  );
}
