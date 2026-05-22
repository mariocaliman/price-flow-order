import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getDashboardMetrics } from "@/lib/dashboard.functions";
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
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-bold">Dashboard de pedidos</h1>
            <p className="text-xs text-muted-foreground">Métricas administrativas</p>
          </div>
          <div className="flex gap-2">
            <Link to="/admin" className="px-3 py-2 text-sm rounded-md border border-border hover:bg-muted">Usuários</Link>
            <Link to="/" className="px-3 py-2 text-sm rounded-md border border-border hover:bg-muted">← Pedidos</Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex gap-1">
                {[7, 30, 90].map((d) => (
                  <button key={d} onClick={() => setPreset(d)}
                    className="px-3 py-2 text-xs rounded-md border border-border hover:bg-muted">
                    {d}d
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs text-muted-foreground block">De</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                  className="px-3 py-2 rounded-md bg-background border border-input text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block">Até</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                  className="px-3 py-2 rounded-md bg-background border border-input text-sm" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-muted-foreground block">Vendedores</label>
                <select multiple value={vendedorIds}
                  onChange={(e) => setVendedorIds(Array.from(e.target.selectedOptions).map((o) => o.value))}
                  className="w-full px-2 py-1.5 rounded-md bg-background border border-input text-sm min-h-[42px]">
                  {(data?.vendedores ?? []).map((v) => (
                    <option key={v.id} value={v.id}>{v.nome}</option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Ctrl/⌘+clique para múltiplos · vazio = todos
                </p>
              </div>
              <button onClick={load} disabled={loading}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {loading ? "Carregando..." : "Aplicar"}
              </button>
            </div>
          </CardContent>
        </Card>

        {err && (
          <div className="text-sm text-destructive border border-destructive/40 bg-destructive/10 rounded-md p-3">
            {err}
          </div>
        )}

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Pedidos" value={String(data?.resumo.totalPedidos ?? 0)} />
          <StatCard label="Faturamento" value={brl(data?.resumo.faturamento ?? 0)} highlight />
          <StatCard label="Ticket médio" value={brl(data?.resumo.ticketMedio ?? 0)} />
          <StatCard label="Clientes únicos" value={String(data?.resumo.clientesUnicos ?? 0)} />
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-sm">Faturamento por dia</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.porDia ?? []}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => brl(v)} />
                  <Line type="monotone" dataKey="faturamento" stroke={RED} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Distribuição por tabela</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label={(e) => e.name}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => brl(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm">Top 10 vendedores (faturamento)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.porVendedor ?? []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Bar dataKey="faturamento" fill={RED} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Top 20 produtos</CardTitle></CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Faturamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.porProduto ?? []).map((p) => (
                      <TableRow key={p.codigo}>
                        <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                        <TableCell className="text-xs">{p.descricao}</TableCell>
                        <TableCell className="text-right">{p.qtd.toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-right font-medium">{brl(p.faturamento)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Top 10 clientes</CardTitle></CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Pedidos</TableHead>
                      <TableHead className="text-right">Faturamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.porCliente ?? []).map((c) => (
                      <TableRow key={c.nome}>
                        <TableCell className="text-xs capitalize">{c.nome}</TableCell>
                        <TableCell className="text-right">{c.pedidos}</TableCell>
                        <TableCell className="text-right font-medium">{brl(c.faturamento)}</TableCell>
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
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`mt-1 font-bold ${highlight ? "text-2xl text-primary" : "text-xl"}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
