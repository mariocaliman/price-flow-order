import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getDashboardMetrics } from "@/lib/dashboard.functions";
import { exportPedidos } from "@/lib/export.functions";
import { downloadCsv, downloadXlsx } from "@/lib/export-utils";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/admin/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — Pedidos" }] }),
});

const RED = "hsl(var(--primary))";
const PIE_COLORS = ["#c81e28", "#f97316", "#eab308", "#22c55e", "#0ea5e9", "#8b5cf6", "#ec4899"];

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

type Metrics = Awaited<ReturnType<typeof getDashboardMetrics>>;

function DashboardPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const fetchMetrics = useServerFn(getDashboardMetrics);
  const fetchExport = useServerFn(exportPedidos);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);

  async function handleExport(format: "csv" | "xlsx") {
    setExporting(format);
    try {
      const r = await fetchExport({ data: { from, to, vendedorIds } });
      const stamp = `${from}_a_${to}`;
      if (format === "csv") downloadCsv(r.pedidos, r.itens, stamp);
      else downloadXlsx(r.pedidos, r.itens, stamp);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(null);
    }
  }

  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [vendedorIds, setVendedorIds] = useState<string[]>([]);
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (auth.loading || auth.roleLoading) return;
    if (!auth.user) { navigate({ to: "/login" }); return; }
    if (!auth.isAdmin) { navigate({ to: "/" }); }
  }, [auth.loading, auth.roleLoading, auth.user, auth.isAdmin, navigate]);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const r = await fetchMetrics({ data: { from, to, vendedorIds } });
      setData(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (auth.isAdmin) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isAdmin]);

  function setPreset(days: number) {
    setFrom(isoDaysAgo(days));
    setTo(new Date().toISOString().slice(0, 10));
  }

  const pieData = useMemo(
    () => (data?.porTabela ?? []).map((t) => ({ name: t.nome, value: t.faturamento })),
    [data],
  );

  if (auth.loading || auth.roleLoading || !auth.isAdmin) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="font-bold text-sm sm:text-base">Dashboard de pedidos</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Métricas administrativas</p>
          </div>
          <div className="flex gap-1.5 sm:gap-2 flex-wrap">
            <Link to="/admin" className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-md border border-border hover:bg-muted">Usuários</Link>
            <Link to="/admin/products" className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-md border border-border hover:bg-muted">Produtos</Link>
            <Link to="/" className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-md border border-border hover:bg-muted">← Pedidos</Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Filtros */}
        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="flex flex-wrap gap-2 sm:gap-3 items-end">
              <div className="flex gap-1">
                {[7, 30, 90].map((d) => (
                  <button key={d} onClick={() => setPreset(d)}
                    className="px-2 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs rounded-md border border-border hover:bg-muted">
                    {d}d
                  </button>
                ))}
              </div>
              <div>
                <label className="text-[10px] sm:text-xs text-muted-foreground block">De</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                  className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-md bg-background border border-input text-xs sm:text-sm" />
              </div>
              <div>
                <label className="text-[10px] sm:text-xs text-muted-foreground block">Até</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                  className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-md bg-background border border-input text-xs sm:text-sm" />
              </div>
              <div className="flex-1 min-w-[160px] sm:min-w-[200px]">
                <label className="text-[10px] sm:text-xs text-muted-foreground block">Vendedores</label>
                <select multiple value={vendedorIds}
                  onChange={(e) => setVendedorIds(Array.from(e.target.selectedOptions).map((o) => o.value))}
                  className="w-full px-2 py-1.5 rounded-md bg-background border border-input text-xs sm:text-sm min-h-[42px]">
                  {(data?.vendedores ?? []).map((v) => (
                    <option key={v.id} value={v.id}>{v.nome}</option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Ctrl/⌘+clique para múltiplos · vazio = todos
                </p>
              </div>
              <button onClick={load} disabled={loading}
                className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-md bg-primary text-primary-foreground text-xs sm:text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {loading ? "Carregando..." : "Aplicar"}
              </button>
              <button onClick={() => handleExport("xlsx")} disabled={!!exporting}
                title="Baixar pedidos + itens em Excel (2 abas)"
                className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-md border border-border bg-card text-xs sm:text-sm font-medium hover:bg-muted disabled:opacity-50">
                {exporting === "xlsx" ? "..." : "📊 Excel"}
              </button>
              <button onClick={() => handleExport("csv")} disabled={!!exporting}
                title="Baixar 2 arquivos CSV (pedidos + itens)"
                className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-md border border-border bg-card text-xs sm:text-sm font-medium hover:bg-muted disabled:opacity-50">
                {exporting === "csv" ? "..." : "📄 CSV"}
              </button>
            </div>
          </CardContent>
        </Card>

        {err && (
          <div className="text-xs sm:text-sm text-destructive border border-destructive/40 bg-destructive/10 rounded-md p-3">
            {err}
          </div>
        )}

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <StatCard label="Pedidos" value={String(data?.resumo.totalPedidos ?? 0)} />
          <StatCard label="Faturamento" value={brl(data?.resumo.faturamento ?? 0)} highlight />
          <StatCard label="Ticket médio" value={brl(data?.resumo.ticketMedio ?? 0)} />
          <StatCard label="Clientes únicos" value={String(data?.resumo.clientesUnicos ?? 0)} />
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="p-4 sm:p-6"><CardTitle className="text-xs sm:text-sm">Faturamento por dia</CardTitle></CardHeader>
            <CardContent className="h-56 sm:h-72 p-2 sm:p-6 pt-0 sm:pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.porDia ?? []}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => brl(v)} />
                  <Line type="monotone" dataKey="faturamento" stroke={RED} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 sm:p-6"><CardTitle className="text-xs sm:text-sm">Distribuição por tabela</CardTitle></CardHeader>
            <CardContent className="h-56 sm:h-72 p-2 sm:p-6 pt-0 sm:pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={60} label={(e) => e.name} style={{ fontSize: 10 }}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => brl(v)} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="p-4 sm:p-6"><CardTitle className="text-xs sm:text-sm">Top 10 vendedores (faturamento)</CardTitle></CardHeader>
          <CardContent className="h-56 sm:h-72 p-2 sm:p-6 pt-0 sm:pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.porVendedor ?? []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="nome" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Bar dataKey="faturamento" fill={RED} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="p-4 sm:p-6"><CardTitle className="text-xs sm:text-sm">Top 20 produtos</CardTitle></CardHeader>
            <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
              <div className="max-h-80 sm:max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[11px] sm:text-xs">Código</TableHead>
                      <TableHead className="text-[11px] sm:text-xs">Produto</TableHead>
                      <TableHead className="text-right text-[11px] sm:text-xs">Qtd</TableHead>
                      <TableHead className="text-right text-[11px] sm:text-xs">Faturamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.porProduto ?? []).map((p) => (
                      <TableRow key={p.codigo}>
                        <TableCell className="font-mono text-[10px] sm:text-xs">{p.codigo}</TableCell>
                        <TableCell className="text-[10px] sm:text-xs">{p.descricao}</TableCell>
                        <TableCell className="text-right text-[10px] sm:text-xs">{p.qtd.toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-right font-medium text-[10px] sm:text-xs">{brl(p.faturamento)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 sm:p-6"><CardTitle className="text-xs sm:text-sm">Top 10 clientes</CardTitle></CardHeader>
            <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
              <div className="max-h-80 sm:max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[11px] sm:text-xs">Cliente</TableHead>
                      <TableHead className="text-right text-[11px] sm:text-xs">Pedidos</TableHead>
                      <TableHead className="text-right text-[11px] sm:text-xs">Faturamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.porCliente ?? []).map((c) => (
                      <TableRow key={c.nome}>
                        <TableCell className="text-[10px] sm:text-xs capitalize">{c.nome}</TableCell>
                        <TableCell className="text-right text-[10px] sm:text-xs">{c.pedidos}</TableCell>
                        <TableCell className="text-right font-medium text-[10px] sm:text-xs">{brl(c.faturamento)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card>
      <CardContent className="p-3 sm:pt-6 sm:px-6 sm:pb-6">
        <div className="text-[10px] sm:text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`mt-1 font-bold ${highlight ? "text-base sm:text-2xl text-primary" : "text-sm sm:text-xl"}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
