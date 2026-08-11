import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brl } from "@/lib/products";
import { listPriceHistory, type PriceHistoryRow } from "@/lib/price-history.functions";

export const Route = createFileRoute("/admin/prices")({
  component: AdminPricesPage,
  head: () => ({
    meta: [
      { title: "Admin — Histórico de preços" },
      { name: "description", content: "Acompanhe todas as alterações de preços dos produtos do catálogo." },
      { property: "og:title", content: "Histórico de preços" },
      { property: "og:description", content: "Alterações de preços por produto, tabela, data e usuário." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function pct(de: number | null, para: number | null) {
  if (de == null || para == null || de === 0) return null;
  return ((para - de) / de) * 100;
}

function AdminPricesPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const fetchHistory = useServerFn(listPriceHistory);

  const [rows, setRows] = useState<PriceHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (auth.loading || auth.roleLoading) return;
    if (!auth.user) { navigate({ to: "/login" }); return; }
    if (!auth.isAdmin) navigate({ to: "/" });
  }, [auth.loading, auth.roleLoading, auth.user, auth.isAdmin, navigate]);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const data = (await fetchHistory({
        data: {
          codigo: codigo.trim() || undefined,
          from: from ? new Date(from + "T00:00:00").toISOString() : undefined,
          to: to ? new Date(to + "T23:59:59").toISOString() : undefined,
          limit: 300,
        },
      })) as PriceHistoryRow[];
      setRows(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }

  useEffect(() => { if (auth.isAdmin) void load(); /* eslint-disable-next-line */ }, [auth.isAdmin]);

  const totalChanges = useMemo(() => rows.reduce((s, r) => s + r.changes.length, 0), [rows]);

  if (auth.loading || auth.roleLoading || !auth.isAdmin) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="font-bold text-sm sm:text-base">Histórico de preços</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground">
              Todas as alterações de preços registradas por produto, tabela, data e usuário
            </p>
          </div>
          <div className="flex gap-1.5 sm:gap-2 flex-wrap">
            <Link to="/admin/products" className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-md border border-border hover:bg-muted">📦 Produtos</Link>
            <Link to="/admin" className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-md border border-border hover:bg-muted">👥 Usuários</Link>
            <Link to="/" className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-md border border-border hover:bg-muted">← Pedidos</Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
        {err && <div className="text-sm text-destructive border border-destructive/40 bg-destructive/10 rounded-md p-3">{err}</div>}

        <Card>
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
            <CardTitle className="text-sm sm:text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-[10px]">Código do produto</Label>
              <Input className="h-8 text-xs" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex.: 0510101103" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">De</Label>
              <Input className="h-8 text-xs" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Até</Label>
              <Input className="h-8 text-xs" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? "Buscando..." : "Filtrar"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6 pb-2">
            <CardTitle className="text-sm sm:text-base">
              {rows.length} evento(s) · {totalChanges} alteração(ões) de preço
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 space-y-2">
            {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {!loading && rows.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma alteração de preço encontrada no período.</p>
            )}
            {rows.map((r) => (
              <div key={r.id} className="border border-border rounded-md p-2.5 sm:p-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] text-muted-foreground">{r.codigo}</div>
                    <div className="text-xs sm:text-sm font-medium leading-snug">{r.descricao || "—"}</div>
                  </div>
                  <div className="text-right text-[10px] text-muted-foreground">
                    <div>{new Date(r.created_at).toLocaleString("pt-BR")}</div>
                    <div>{r.user_email ?? "sistema"} · {r.operation === "INSERT" ? "cadastro" : "edição"}</div>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {r.changes.map((c) => {
                    const v = pct(c.de, c.para);
                    return (
                      <div key={c.tabela} className="flex items-center justify-between gap-2 text-[11px] border-t border-border/60 pt-1">
                        <span className="text-muted-foreground truncate">{c.tabela}</span>
                        <span className="whitespace-nowrap">
                          <span className="line-through text-muted-foreground">{c.de == null ? "—" : brl(c.de)}</span>
                          {" → "}
                          <span className="font-medium">{c.para == null ? "—" : brl(c.para)}</span>
                          {v != null && (
                            <span className={v >= 0 ? "ml-1 text-emerald-600" : "ml-1 text-destructive"}>
                              ({v >= 0 ? "+" : ""}{v.toFixed(1)}%)
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
