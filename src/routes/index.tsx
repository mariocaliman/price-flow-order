import { useEffect, useMemo, useState } from "react";
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
  useEffect(() => {
    if (!auth.loading && !auth.user) navigate({ to: "/login" });
  }, [auth.loading, auth.user, navigate]);

  // Cabeçalho
  const [cliente, setCliente] = useState("");
  const [codCliente, setCodCliente] = useState("");
  const [prazo, setPrazo] = useState("28 DDL");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [vendedor, setVendedor] = useState("");
  const [obs, setObs] = useState("");

  // Configurações
  const [tabela, setTabela] = useState<PriceTable>("RQE Especialista");
  const [roundMode, setRoundMode] = useState<"auto" | "suggest" | "off">("auto");

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
    const totalGeral = items.reduce((s, it) => s + it.qtyAdjusted * it.unitPrice, 0);
    const totalUnidades = items.reduce((s, it) => s + it.qtyAdjusted, 0);
    const totalCaixas = items.reduce(
      (s, it) => s + Math.ceil(it.qtyAdjusted / Math.max(1, it.product.qtdPorEmbalagem)),
      0,
    );
    return { totalGeral, totalUnidades, totalCaixas, itens: items.length };
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
      cliente, codCliente, prazo, data, vendedor, obs, tabela, roundMode, items, totals,
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

  function loadLastPedido() {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith("pedido_")).sort();
    if (!keys.length) return alert("Nenhum pedido salvo.");
    const raw = localStorage.getItem(keys[keys.length - 1]);
    if (!raw) return;
    const p = JSON.parse(raw);
    setCliente(p.cliente); setCodCliente(p.codCliente); setPrazo(p.prazo);
    setData(p.data); setVendedor(p.vendedor); setObs(p.obs);
    setTabela(p.tabela); setRoundMode(p.roundMode); setItems(p.items);
  }

  function exportPDF() {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();

    // Cabeçalho
    doc.setFillColor(30, 80, 160);
    doc.rect(0, 0, W, 22, "F");
    doc.setTextColor(255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("PEDIDO COMERCIAL", 14, 14);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Tabela: ${tabela}`, W - 14, 14, { align: "right" });

    doc.setTextColor(0);
    doc.setFontSize(10);
    let y = 30;
    const left = [
      ["Cliente", cliente || "-"],
      ["Código Cliente", codCliente || "-"],
      ["Vendedor", vendedor || "-"],
    ];
    const right = [
      ["Data", new Date(data).toLocaleDateString("pt-BR")],
      ["Prazo", prazo || "-"],
      ["Nº Pedido", `#${Date.now().toString().slice(-6)}`],
    ];
    left.forEach(([k, v], i) => {
      doc.setFont("helvetica", "bold"); doc.text(`${k}:`, 14, y + i * 6);
      doc.setFont("helvetica", "normal"); doc.text(String(v), 45, y + i * 6);
    });
    right.forEach(([k, v], i) => {
      doc.setFont("helvetica", "bold"); doc.text(`${k}:`, W / 2 + 5, y + i * 6);
      doc.setFont("helvetica", "normal"); doc.text(String(v), W / 2 + 35, y + i * 6);
    });

    autoTable(doc, {
      startY: y + 22,
      head: [["Código", "Produto", "Apres.", "Cx", "Qtd", "Vol", "Preço Un.", "Total"]],
      body: items.map((it) => [
        it.product.codigo,
        it.product.descricao,
        it.product.apresentacao,
        String(it.product.qtdPorEmbalagem),
        String(it.qtyAdjusted),
        String(Math.ceil(it.qtyAdjusted / Math.max(1, it.product.qtdPorEmbalagem))),
        brl(it.unitPrice),
        brl(it.unitPrice * it.qtyAdjusted),
      ]),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 80, 160], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 70 },
        3: { halign: "center", cellWidth: 10 },
        4: { halign: "center", cellWidth: 14 },
        5: { halign: "center", cellWidth: 10 },
        6: { halign: "right", cellWidth: 22 },
        7: { halign: "right", cellWidth: 24 },
      },
    });

    // @ts-expect-error lastAutoTable
    let endY = doc.lastAutoTable.finalY + 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Itens: ${totals.itens}`, 14, endY);
    doc.text(`Volumes (caixas): ${totals.totalCaixas}`, 60, endY);
    doc.text(`Unidades: ${totals.totalUnidades}`, 120, endY);
    doc.setFontSize(13);
    doc.text(`TOTAL GERAL: ${brl(totals.totalGeral)}`, W - 14, endY + 8, { align: "right" });

    if (obs) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Observações:", 14, endY + 22);
      doc.setFont("helvetica", "normal");
      doc.text(doc.splitTextToSize(obs, W - 28), 14, endY + 28);
    }

    const H = doc.internal.pageSize.getHeight();
    doc.setDrawColor(180);
    doc.line(W / 2 - 50, H - 25, W / 2 + 50, H - 25);
    doc.setFontSize(9);
    doc.text("Assinatura / Responsável", W / 2, H - 20, { align: "center" });
    doc.setFontSize(7); doc.setTextColor(120);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, H - 8);

    const filename = `pedido_${(cliente || "cliente").replace(/\s+/g, "_")}_${data}.pdf`;
    doc.save(filename);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Topbar */}
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="max-w-[1500px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-primary text-primary-foreground grid place-items-center font-bold">
              RQ
            </div>
            <div>
              <h1 className="font-bold leading-tight">Sistema de Pedidos Comerciais</h1>
              <p className="text-xs text-muted-foreground">Tabela Hospitalar · {ALL_PRODUCTS.length} produtos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {auth.isAdmin && (
              <Link
                to="/admin"
                title="Painel do administrador"
                className="px-3 py-2 text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition inline-flex items-center gap-1.5 shadow-sm"
              >
                <span aria-hidden>⚙</span> Painel Admin
              </Link>
            )}
            <span className="hidden md:inline text-xs text-muted-foreground px-2">
              {auth.nome || auth.user?.email}
            </span>
            <button onClick={loadLastPedido} className="px-3 py-2 text-sm rounded-md border border-border hover:bg-muted transition">
              Carregar último
            </button>
            <button onClick={savePedido} className="px-3 py-2 text-sm rounded-md border border-border hover:bg-muted transition">
              Salvar
            </button>
            <button
              onClick={exportPDF}
              disabled={!items.length}
              className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              Gerar PDF
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/login" });
              }}
              className="px-3 py-2 text-sm rounded-md border border-border hover:bg-muted transition"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto px-6 py-6 grid grid-cols-12 gap-6">
        {/* Catálogo */}
        <section className="col-span-12 lg:col-span-5 xl:col-span-4">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border space-y-3">
              <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Catálogo</h2>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por código, descrição, princípio ativo..."
                className="w-full px-3 py-2 rounded-md bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex gap-2">
                <select
                  value={catFilter}
                  onChange={(e) => setCatFilter(e.target.value)}
                  className="flex-1 px-2 py-2 rounded-md bg-background border border-input text-sm"
                >
                  <option value="">Todas categorias</option>
                  {categorias.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select
                  value={tabela}
                  onChange={(e) => setTabela(e.target.value as PriceTable)}
                  className="flex-1 px-2 py-2 rounded-md bg-background border border-input text-sm"
                >
                  {priceTables.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
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
        <section className="col-span-12 lg:col-span-7 xl:col-span-8 space-y-6">
          {/* Dados do pedido */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-4">Dados do pedido</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Cliente" value={cliente} onChange={setCliente} />
              <Field label="Código do cliente" value={codCliente} onChange={setCodCliente} />
              <Field label="Vendedor" value={vendedor} onChange={setVendedor} />
              <Field label="Prazo de pagamento" value={prazo} onChange={setPrazo} />
              <Field label="Data do pedido" type="date" value={data} onChange={setData} />
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
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
              <div className="border-t border-border bg-muted/30 px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat label="Itens" value={String(totals.itens)} />
                <Stat label="Unidades" value={String(totals.totalUnidades)} />
                <Stat label="Volumes (caixas)" value={String(totals.totalCaixas)} />
                <Stat label="Total geral" value={brl(totals.totalGeral)} highlight />
              </div>
            )}
          </div>
        </section>
      </main>
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
