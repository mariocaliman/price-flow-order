import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import logo from "@/assets/rioquimica-logo.jpeg";
import { useAuth } from "@/hooks/use-auth";
import { useProducts } from "@/hooks/use-products";
import { supabase } from "@/integrations/supabase/client";
import { brl, priceTables, roundToBox, type PriceTable, type Product } from "@/lib/products";
import {
  buildPropostaPdf, DEFAULT_APRESENTACAO, DEFAULT_COMPROMISSO, DEFAULT_DIFERENCIAIS, DEFAULT_LOGISTICA,
  fmtNumero, propostaFilename, propostaTotal,
  type PropostaData, type PropostaItem,
} from "@/lib/proposta-pdf";

export const Route = createFileRoute("/propostas")({
  head: () => ({
    meta: [
      { title: "Propostas Comerciais · Rioquímica" },
      { name: "description", content: "Crie, salve e gere PDFs de propostas comerciais Rioquímica." },
      { property: "og:title", content: "Propostas Comerciais · Rioquímica" },
      { property: "og:description", content: "Crie, salve e gere PDFs de propostas comerciais Rioquímica." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PropostasPage,
});

const STATUS: Record<string, string> = {
  rascunho: "Rascunho", enviada: "Enviada", aprovada: "Aprovada", recusada: "Recusada",
};
const PRAZOS = ["À vista", "28 DDL", "30 DDL", "30/60 DDL", "30/60/90 DDL", "45 DDL", "60 DDL", "28/42/56 DDL"];
const DRAFT_KEY = "proposta_draft_v1";

interface Row { id: string; numero: number; cliente: string; status: string; vencimento: string | null; total: number; created_at: string; payload: Partial<PropostaData> & { status?: string } }

const today = () => new Date().toISOString().slice(0, 10);
const plus = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const fmtD = (d?: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");

type Form = PropostaData & { status: string; tabela: PriceTable; fallbackTabela: PriceTable };
function emptyForm(nome = "", cargo = ""): Form {
  return {
    numero: null, dataCriacao: today(), cidade: "São José do Rio Preto", cliente: "",
    contatoNome: "", contatoTratamento: "À Sra.", prazo: "28 DDL", vencimento: plus(15),
    apresentacao: DEFAULT_APRESENTACAO, diferenciais: DEFAULT_DIFERENCIAIS,
    logistica: DEFAULT_LOGISTICA, compromisso: DEFAULT_COMPROMISSO,
    obs: "", assinaturaNome: nome, assinaturaCargo: cargo,
    assinaturaInfo: "", assinaturaCliente: true, items: [], status: "rascunho", tabela: "RQE Especialista", fallbackTabela: "RQE Especialista",
  };
}

function PropostasPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { products } = useProducts();
  const [view, setView] = useState<"list" | "edit">("list");
  const [rows, setRows] = useState<Row[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [q, setQ] = useState("");
  const [clientes, setClientes] = useState<string[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [id, setId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [cargo, setCargo] = useState("");

  useEffect(() => {
    if (!auth.loading && !auth.user) navigate({ to: "/login" });
  }, [auth.loading, auth.user, navigate]);

  useEffect(() => {
    if (!auth.user) return;
    void loadList();
    (async () => {
      const [{ data: p }, { data: pr }, { data: prof }] = await Promise.all([
        supabase.from("pedidos").select("nome").limit(1000),
        supabase.from("propostas").select("cliente").limit(1000),
        supabase.from("profiles").select("cargo").eq("id", auth.user!.id).maybeSingle(),
      ]);
      const set = new Set<string>();
      (p ?? []).forEach((r) => r.nome && set.add(r.nome));
      (pr ?? []).forEach((r) => r.cliente && set.add(r.cliente));
      setClientes([...set].sort());
      setCargo((prof as { cargo?: string } | null)?.cargo ?? "");
    })();
    // restore draft
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        setForm(d.form); setId(d.id); setView("edit");
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user?.id]);

  // autosave local draft to avoid data loss
  useEffect(() => {
    if (view === "edit") localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, id }));
  }, [form, id, view]);

  async function loadList() {
    setLoadingList(true);
    const { data } = await supabase.from("propostas").select("*").order("created_at", { ascending: false }).limit(500);
    setRows((data ?? []) as unknown as Row[]);
    setLoadingList(false);
  }

  function closeEditor() {
    localStorage.removeItem(DRAFT_KEY);
    setView("list"); setId(null);
    void loadList();
  }

  function newProposta() {
    setForm(emptyForm(auth.nome, cargo)); setId(null); setView("edit");
  }

  function openRow(r: Row, duplicate = false) {
    const f = { ...emptyForm(), ...r.payload, status: duplicate ? "rascunho" : r.status } as Form;
    if (duplicate) { f.numero = null; f.dataCriacao = today(); f.vencimento = plus(15); }
    else f.numero = r.numero;
    setForm(f); setId(duplicate ? null : r.id); setView("edit");
  }

  async function deleteRow(r: Row) {
    if (!confirm(`Excluir a proposta Nº ${fmtNumero(r.numero)}? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("propostas").delete().eq("id", r.id);
    if (error) alert(error.message); else void loadList();
  }

  async function pdfFromRow(r: Row) {
    const d = { ...emptyForm(), ...r.payload, numero: r.numero } as PropostaData;
    const doc = await buildPropostaPdf(d);
    doc.save(propostaFilename(d));
  }

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setItem = (i: number, patch: Partial<PropostaItem>) =>
    setForm((f) => ({ ...f, items: f.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));

  const tabela = form.tabela;
  const fallbackTabela = form.fallbackTabela;
  const allowPrecoEscolha = auth.isAdmin || auth.canUsePrecoEscolha;
  const availableTables = priceTables.filter((t) => allowPrecoEscolha || t !== "Preço de Escolha");
  useEffect(() => {
    if (!auth.roleLoading && !allowPrecoEscolha && form.tabela === "Preço de Escolha") set("tabela", "RQE Especialista");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.roleLoading, allowPrecoEscolha, form.tabela]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.codigo, p])), [products]);
  const categorias = useMemo(() => Array.from(new Set(products.map((p) => p.categoria))).filter(Boolean).sort(), [products]);
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return products.filter((p) => {
      if (catFilter && p.categoria !== catFilter) return false;
      if (!s) return true;
      return `${p.codigo} ${p.descricao} ${p.principioAtivo} ${p.categoria}`.toLowerCase().includes(s);
    });
  }, [products, search, catFilter]);

  function priceOf(p: Product): number {
    const v = p.precos[tabela];
    if (v != null) return v;
    if (tabela === "Preço de Escolha") {
      const fb = p.precos[fallbackTabela];
      if (fb != null) return fb;
    }
    for (const t of priceTables) { const x = p.precos[t]; if (x != null) return x; }
    return 0;
  }
  function tableUsed(p: Product): string {
    if (p.precos[tabela] != null) return tabela;
    if (tabela === "Preço de Escolha" && p.precos[fallbackTabela] != null) return fallbackTabela;
    return priceTables.find((t) => p.precos[t] != null) ?? tabela;
  }

  function addProduct(p: Product) {
    const price = priceOf(p);
    if (!price) { alert(`Sem preço cadastrado em "${tabela}" para ${p.descricao}.`); return; }
    setForm((f) => {
      const i = f.items.findIndex((it) => it.codigo === p.codigo);
      if (i >= 0) {
        const items = [...f.items];
        items[i] = { ...items[i], qty: roundToBox(items[i].qty + p.qtdPorEmbalagem, p.qtdPorEmbalagem, "auto"), unitPrice: price, tabela: tableUsed(p) };
        return { ...f, items };
      }
      return { ...f, items: [...f.items, { codigo: p.codigo, descricao: p.descricao, apresentacao: p.apresentacao, tabela: tableUsed(p), qty: p.qtdPorEmbalagem || 1, unitPrice: price }] };
    });
  }

  function updateQty(i: number, v: number) {
    const p = productMap.get(form.items[i].codigo);
    setItem(i, { qty: p ? roundToBox(v, p.qtdPorEmbalagem, "auto") : v });
  }

  function updateUnitPrice(i: number, v: number) {
    const p = productMap.get(form.items[i].codigo);
    if (p && tabela === "Preço de Escolha" && !auth.isAdmin) {
      const min = priceOf(p);
      if (v < min) {
        alert(`Preço bloqueado: na tabela "Preço de Escolha" não é permitido reduzir o preço abaixo de ${brl(min)}. Esta alteração somente com aprovação de um administrador.`);
        return;
      }
    }
    setItem(i, { unitPrice: v });
  }

  function validate(): string | null {
    if (!form.cliente.trim()) return "Informe o nome do cliente.";
    if (!form.prazo.trim()) return "Informe o prazo de pagamento.";
    if (!form.vencimento) return "Informe o vencimento da proposta.";
    if (!form.items.length) return "Adicione pelo menos um produto.";
    if (form.items.some((i) => !(i.qty > 0) || !(i.unitPrice > 0))) return "Todos os itens precisam de quantidade e preço maiores que zero.";
    return null;
  }

  async function save(): Promise<number | null> {
    if (!form.cliente.trim()) { alert("Informe o nome do cliente."); return null; }
    setSaving(true);
    const payload = { ...form };
    const rec = {
      cliente: form.cliente.trim(), status: form.status, vencimento: form.vencimento || null,
      total: propostaTotal(form.items), payload: payload as never,
    };
    const res = id
      ? await supabase.from("propostas").update(rec).eq("id", id).select("id, numero").single()
      : await supabase.from("propostas").insert({ ...rec, user_id: auth.user!.id }).select("id, numero").single();
    setSaving(false);
    if (res.error) { alert("Erro ao salvar: " + res.error.message); return null; }
    setId(res.data.id);
    setForm((f) => ({ ...f, numero: res.data.numero }));
    return res.data.numero;
  }

  async function pdf(mode: "view" | "download") {
    const err = validate();
    if (err) { alert(err); return; }
    const numero = await save();
    if (numero == null) return;
    const d = { ...form, numero };
    const doc = await buildPropostaPdf(d);
    if (mode === "view") window.open(doc.output("bloburl"), "_blank");
    else doc.save(propostaFilename(d));
  }

  const total = propostaTotal(form.items);
  const totalQty = form.items.reduce((s, i) => s + (i.qty || 0), 0);
  const inputCls = "mt-0.5 w-full px-2 py-1.5 rounded-md bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring";
  const btn = "px-3 py-2 text-xs sm:text-sm rounded-md border border-border hover:bg-muted transition disabled:opacity-50";
  const btnPrimary = "px-3 py-2 text-xs sm:text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50";

  const listFiltered = rows.filter((r) => `${r.numero} ${r.cliente}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="max-w-[1500px] mx-auto px-3 sm:px-6 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Rioquímica" className="w-10 h-10 rounded-md object-contain" />
            <div>
              <h1 className="font-bold text-sm sm:text-base">Propostas Comerciais</h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                {view === "list" ? "Minhas Propostas" : id ? `Editando proposta Nº ${fmtNumero(form.numero)}` : "Nova Proposta"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/" className={btn}>← Pedidos</Link>
            {view === "list" ? (
              <button onClick={newProposta} className={btnPrimary}>+ Nova Proposta</button>
            ) : (
              <>
                <button onClick={closeEditor} className={btn}>Minhas Propostas</button>
                <button onClick={async () => { if (await save() != null) alert("Proposta salva."); }} disabled={saving} className={btn}>
                  {saving ? "Salvando..." : id ? "Salvar Alterações" : "Salvar Rascunho"}
                </button>
                {id && <button onClick={() => { setId(null); setForm((f) => ({ ...f, numero: null, dataCriacao: today(), status: "rascunho" })); }} className={btn}>Duplicar Proposta</button>}
                <button onClick={() => pdf("view")} className={btn}>Visualizar PDF</button>
                <button onClick={() => pdf("download")} className={btnPrimary}>Gerar PDF</button>
              </>
            )}
          </div>
        </div>
      </header>

      {view === "list" ? (
        <main className="max-w-[1500px] mx-auto px-3 sm:px-6 py-4 sm:py-6">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Minhas Propostas</h2>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número ou cliente..."
                className="px-3 py-2 rounded-md bg-background border border-input text-sm sm:w-72" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="text-left p-3">Nº</th><th className="text-left p-3">Cliente</th>
                    <th className="text-left p-3">Criação</th><th className="text-left p-3">Vencimento</th>
                    <th className="text-right p-3">Total</th><th className="text-left p-3">Situação</th>
                    <th className="text-right p-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {listFiltered.map((r) => {
                    const expired = r.vencimento && r.vencimento < today() && r.status !== "aprovada";
                    return (
                      <tr key={r.id} className="hover:bg-muted/40">
                        <td className="p-3 font-mono">{fmtNumero(r.numero)}</td>
                        <td className="p-3">{r.cliente}</td>
                        <td className="p-3">{fmtD(r.created_at)}</td>
                        <td className={`p-3 ${expired ? "text-destructive" : ""}`}>{fmtD(r.vencimento)}{expired ? " (vencida)" : ""}</td>
                        <td className="p-3 text-right font-semibold">{brl(Number(r.total))}</td>
                        <td className="p-3"><span className="text-xs px-2 py-0.5 rounded bg-accent text-accent-foreground">{STATUS[r.status] ?? r.status}</span></td>
                        <td className="p-3">
                          <div className="flex gap-1 justify-end flex-wrap">
                            <button onClick={() => openRow(r)} className="px-2 py-1 text-xs rounded border border-border hover:bg-muted">Abrir</button>
                            <button onClick={() => openRow(r, true)} className="px-2 py-1 text-xs rounded border border-border hover:bg-muted">Duplicar</button>
                            <button onClick={() => pdfFromRow(r)} className="px-2 py-1 text-xs rounded border border-border hover:bg-muted">PDF</button>
                            <button onClick={() => deleteRow(r)} className="px-2 py-1 text-xs rounded border border-destructive/40 text-destructive hover:bg-destructive/10">Excluir</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!listFiltered.length && (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">
                      {loadingList ? "Carregando..." : "Nenhuma proposta ainda. Clique em \u201cNova Proposta\u201d."}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      ) : (
        <main className="max-w-[1500px] mx-auto px-3 sm:px-6 py-4 sm:py-6 grid grid-cols-12 gap-3 sm:gap-6">
          {/* Catálogo */}
          <section className="col-span-12 md:col-span-5 xl:col-span-4">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="p-4 border-b border-border space-y-2">
                <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Adicionar Produto</h2>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código, nome ou descrição..." className={inputCls} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Categoria</label>
                    <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="mt-0.5 w-full px-2 py-1.5 rounded-md bg-background border border-input text-xs">
                      <option value="">Todas categorias</option>
                      {categorias.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Tabela de preço</label>
                    <select value={tabela} onChange={(e) => set("tabela", e.target.value as PriceTable)} className="mt-0.5 w-full px-2 py-1.5 rounded-md bg-background border border-input text-xs font-medium">
                      {availableTables.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                {tabela === "Preço de Escolha" && (
                  <div className="flex items-center gap-2 pl-2 border-l-2 border-primary/40">
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">↳ Complementar</label>
                    <select value={fallbackTabela} onChange={(e) => set("fallbackTabela", e.target.value as PriceTable)} className="flex-1 px-2 py-1.5 rounded-md bg-background border border-input text-xs font-medium">
                      {priceTables.filter((t) => t !== "Preço de Escolha").map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="max-h-[70vh] overflow-y-auto divide-y divide-border">
                {filtered.map((p) => {
                  const price = priceOf(p);
                  return (
                    <button key={p.codigo} onClick={() => addProduct(p)} className="w-full text-left p-3 hover:bg-muted/60 transition flex gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="font-mono text-xs text-muted-foreground">{p.codigo}</span>
                        <p className="text-xs font-medium line-clamp-2">{p.descricao}</p>
                        <p className="text-[11px] text-muted-foreground line-clamp-1">{p.apresentacao}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{price ? brl(price) : "—"}</div>
                        <div className="text-[10px] text-muted-foreground">+ adicionar</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="col-span-12 md:col-span-7 xl:col-span-8 space-y-4">
            {/* Dados */}
            <div className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Cliente e informações comerciais</h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-mono">
                  Nº {fmtNumero(form.numero)} · criada em {fmtD(form.dataCriacao)}
                </span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <div className="col-span-2">
                  <label className="text-[10px] text-muted-foreground">Nome do cliente *</label>
                  <input list="clientes-list" value={form.cliente} onChange={(e) => set("cliente", e.target.value)} className={inputCls} placeholder="Selecione ou digite" />
                  <datalist id="clientes-list">{clientes.map((c) => <option key={c} value={c} />)}</datalist>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Prazo de pagamento *</label>
                  <input list="prazos-prop" value={form.prazo} onChange={(e) => set("prazo", e.target.value)} className={inputCls} />
                  <datalist id="prazos-prop">{PRAZOS.map((c) => <option key={c} value={c} />)}</datalist>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Vencimento da proposta *</label>
                  <input type="date" value={form.vencimento} onChange={(e) => set("vencimento", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Situação</label>
                  <select value={form.status} onChange={(e) => set("status", e.target.value)} className={inputCls}>
                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Cidade (data do PDF)</label>
                  <input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} className={inputCls} placeholder="Ex.: Recife" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Tratamento do contato</label>
                  <select value={form.contatoTratamento} onChange={(e) => set("contatoTratamento", e.target.value)} className={inputCls}>
                    <option>À Sra.</option><option>Ao Sr.</option><option>À</option><option>Ao</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Nome do contato no cliente</label>
                  <input value={form.contatoNome} onChange={(e) => set("contatoNome", e.target.value)} className={inputCls} placeholder="Ex.: Flávia" />
                </div>
              </div>
            </div>

            {/* Itens */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="p-3 border-b border-border">
                <h2 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Produtos adicionados ({form.items.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px]">
                    <tr>
                      <th className="text-left p-2">Produto</th><th className="text-left p-2">Tabela</th>
                      <th className="text-right p-2 w-20">Qtd</th><th className="text-right p-2 w-28">Preço unit.</th>
                      <th className="text-right p-2">Subtotal</th><th className="p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {form.items.map((it, i) => {
                      const p = productMap.get(it.codigo);
                      return (
                        <tr key={i}>
                          <td className="p-2">
                            <div className="font-mono text-muted-foreground">{it.codigo}</div>
                            <div className="font-medium">{it.descricao}</div>
                            <div className="text-muted-foreground">{it.apresentacao}</div>
                          </td>
                          <td className="p-2">
                            <span className="text-[11px] text-muted-foreground">{it.tabela}</span>
                          </td>
                          <td className="p-2">
                            <input type="number" min={0} value={it.qty} onChange={(e) => updateQty(i, Number(e.target.value))}
                              className="w-full px-1.5 py-1 rounded border border-input bg-background text-right" />
                          </td>
                          <td className="p-2">
                            <input type="number" min={0} step="0.01" value={it.unitPrice}
                              onChange={(e) => updateUnitPrice(i, Number(e.target.value))}
                              title={p ? `Tabela: ${brl(priceOf(p))}` : undefined}
                              className={`w-full px-1.5 py-1 rounded border border-input bg-background text-right ${p && it.unitPrice !== priceOf(p) ? "ring-1 ring-warning" : ""}`} />
                            {p && it.unitPrice !== priceOf(p) && (
                              <button onClick={() => setItem(i, { unitPrice: priceOf(p), tabela: tableUsed(p) })} className="text-[10px] text-primary hover:underline">restaurar tabela</button>
                            )}
                          </td>
                          <td className="p-2 text-right font-semibold whitespace-nowrap">{brl(it.qty * it.unitPrice)}</td>
                          <td className="p-2">
                            <button onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }))}
                              className="text-destructive hover:opacity-70" title="Remover">✕</button>
                          </td>
                        </tr>
                      );
                    })}
                    {!form.items.length && (
                      <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Selecione produtos no catálogo ao lado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Resumo */}
            <div className="bg-card border border-border rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><div className="text-[10px] uppercase text-muted-foreground">Itens</div><div className="font-semibold">{form.items.length}</div></div>
              <div><div className="text-[10px] uppercase text-muted-foreground">Unidades</div><div className="font-semibold">{totalQty.toLocaleString("pt-BR")}</div></div>
              <div><div className="text-[10px] uppercase text-muted-foreground">Condição</div><div className="font-semibold">{form.prazo || "—"}</div></div>
              <div><div className="text-[10px] uppercase text-muted-foreground">Valor total da proposta</div><div className="font-bold text-primary text-lg">{brl(total)}</div></div>
            </div>

            {/* Observações e assinatura */}
            <div className="bg-card border border-border rounded-lg p-3 space-y-3">
              <h2 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Texto, observações e assinatura</h2>
              <div>
                <label className="text-[10px] text-muted-foreground">Texto de apresentação (PDF)</label>
                <textarea rows={6} value={form.apresentacao} onChange={(e) => set("apresentacao", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Diferenciais Rioquímica (PDF)</label>
                <textarea rows={5} value={form.diferenciais} onChange={(e) => set("diferenciais", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Operação logística (PDF)</label>
                <textarea rows={4} value={form.logistica} onChange={(e) => set("logistica", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Compromisso com o cliente (PDF)</label>
                <textarea rows={4} value={form.compromisso} onChange={(e) => set("compromisso", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Observações comerciais</label>
                <textarea rows={3} value={form.obs} onChange={(e) => set("obs", e.target.value)} className={inputCls} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div><label className="text-[10px] text-muted-foreground">Responsável comercial</label>
                  <input value={form.assinaturaNome} onChange={(e) => set("assinaturaNome", e.target.value)} className={inputCls} /></div>
                <div><label className="text-[10px] text-muted-foreground">Cargo</label>
                  <input value={form.assinaturaCargo} onChange={(e) => set("assinaturaCargo", e.target.value)} className={inputCls} /></div>
                <div><label className="text-[10px] text-muted-foreground">Contato / informações</label>
                  <input value={form.assinaturaInfo} onChange={(e) => set("assinaturaInfo", e.target.value)} className={inputCls} placeholder="E-mail, telefone..." /></div>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={form.assinaturaCliente} onChange={(e) => set("assinaturaCliente", e.target.checked)} />
                Incluir campo para assinatura do cliente
              </label>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
