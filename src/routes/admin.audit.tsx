import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listAuditLog, type AuditRow } from "@/lib/audit.functions";

export const Route = createFileRoute("/admin/audit")({
  component: AuditPage,
  head: () => ({ meta: [{ title: "Admin — Auditoria" }] }),
});

const TABLES = [
  { value: "products", label: "Produtos" },
  { value: "pedidos", label: "Pedidos" },
  { value: "profiles", label: "Perfis" },
  { value: "user_roles", label: "Papéis" },
];

const OP_LABEL: Record<string, string> = {
  INSERT: "Criado",
  UPDATE: "Editado",
  DELETE: "Excluído",
};
const OP_COLOR: Record<string, string> = {
  INSERT: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  UPDATE: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  DELETE: "bg-destructive/15 text-destructive",
};

function AuditPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const fetchLog = useServerFn(listAuditLog);

  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [tables, setTables] = useState<string[]>(TABLES.map((t) => t.value));
  const [operation, setOperation] = useState<"" | "INSERT" | "UPDATE" | "DELETE">("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [detail, setDetail] = useState<AuditRow | null>(null);

  useEffect(() => {
    if (auth.loading || auth.roleLoading) return;
    if (!auth.user) {
      navigate({ to: "/login" });
      return;
    }
    if (!auth.isAdmin) navigate({ to: "/" });
  }, [auth.loading, auth.roleLoading, auth.user, auth.isAdmin, navigate]);

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const data = (await fetchLog({
        data: {
          tables: tables.length > 0 ? tables : undefined,
          operation: operation || undefined,
          search: search || undefined,
          from: from ? new Date(from).toISOString() : undefined,
          to: to ? new Date(to + "T23:59:59").toISOString() : undefined,
          limit: 300,
        },
      })) as AuditRow[];
      setRows(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (auth.isAdmin) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isAdmin]);

  const toggleTable = (v: string) =>
    setTables((prev) => (prev.includes(v) ? prev.filter((t) => t !== v) : [...prev, v]));

  if (auth.loading || auth.roleLoading || !auth.isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="font-bold text-sm sm:text-base">Auditoria</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground">
              Histórico de alterações no catálogo, pedidos, perfis e papéis
            </p>
          </div>
          <div className="flex gap-1.5 sm:gap-2 flex-wrap">
            <Link to="/admin" className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-md border border-border hover:bg-muted">
              👥 Usuários
            </Link>
            <Link to="/admin/products" className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-md border border-border hover:bg-muted">
              📦 Produtos
            </Link>
            <Link to="/admin/dashboard" className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-md border border-border hover:bg-muted">
              📊 Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-3">
            <div className="flex flex-wrap gap-2">
              {TABLES.map((t) => (
                <label key={t.value} className="inline-flex items-center gap-1.5 text-xs cursor-pointer border border-border rounded-md px-2 py-1">
                  <input
                    type="checkbox"
                    checked={tables.includes(t.value)}
                    onChange={() => toggleTable(t.value)}
                  />
                  {t.label}
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px]">Operação</Label>
                <select
                  value={operation}
                  onChange={(e) => setOperation(e.target.value as "" | "INSERT" | "UPDATE" | "DELETE")}
                  className="h-8 w-full text-xs border border-input rounded-md px-2 bg-background"
                >
                  <option value="">Todas</option>
                  <option value="INSERT">Criado</option>
                  <option value="UPDATE">Editado</option>
                  <option value="DELETE">Excluído</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">De</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Até</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <Label className="text-[11px]">Buscar (ID/código)</Label>
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ex: 12345" className="h-8 text-xs" />
              </div>
              <div className="flex items-end">
                <Button size="sm" onClick={refresh} disabled={loading} className="w-full h-8 text-xs">
                  {loading ? "..." : "Aplicar"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {err && (
          <div className="text-xs sm:text-sm text-destructive border border-destructive/40 bg-destructive/10 rounded-md p-3">
            {err}
          </div>
        )}

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Eventos ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum evento encontrado.</p>
            ) : (
              <div className="space-y-1.5">
                {rows.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setDetail(r)}
                    className="w-full text-left border border-border rounded-md p-2.5 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={"text-[10px] px-1.5 py-0.5 rounded font-medium " + OP_COLOR[r.operation]}>
                          {OP_LABEL[r.operation]}
                        </span>
                        <span className="text-xs font-medium">{labelTable(r.table_name)}</span>
                        {r.record_id && (
                          <span className="text-[11px] text-muted-foreground truncate">#{r.record_id}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{r.user_email ?? "—"}</span>
                        <span>•</span>
                        <span>{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">
              {detail && `${OP_LABEL[detail.operation]} — ${labelTable(detail.table_name)}`}
            </DialogTitle>
          </DialogHeader>
          {detail && <DetailView row={detail} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function labelTable(t: string) {
  return TABLES.find((x) => x.value === t)?.label ?? t;
}

function DetailView({ row }: { row: AuditRow }) {
  const diff = useMemo(() => computeDiff(row.old_data, row.new_data), [row]);
  return (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-2 gap-3 text-[11px]">
        <div>
          <div className="text-muted-foreground">Usuário</div>
          <div className="font-medium">{row.user_email ?? row.user_id ?? "—"}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Data</div>
          <div className="font-medium">{new Date(row.created_at).toLocaleString("pt-BR")}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Registro</div>
          <div className="font-medium break-all">{row.record_id ?? "—"}</div>
        </div>
        <div>
          <div className="text-muted-foreground">ID do log</div>
          <div className="font-mono text-[10px] break-all">{row.id}</div>
        </div>
      </div>

      {row.operation === "UPDATE" && diff.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold mb-1.5">Alterações</h4>
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-[11px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-1.5">Campo</th>
                  <th className="text-left p-1.5">Antes</th>
                  <th className="text-left p-1.5">Depois</th>
                </tr>
              </thead>
              <tbody>
                {diff.map((d) => (
                  <tr key={d.key} className="border-t border-border">
                    <td className="p-1.5 font-medium">{d.key}</td>
                    <td className="p-1.5 text-destructive break-all">{stringify(d.before)}</td>
                    <td className="p-1.5 text-emerald-600 dark:text-emerald-400 break-all">{stringify(d.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <details className="text-[11px]">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Dados brutos</summary>
        <div className="grid sm:grid-cols-2 gap-2 mt-2">
          <div>
            <div className="text-[10px] text-muted-foreground mb-1">old_data</div>
            <pre className="bg-muted/40 p-2 rounded text-[10px] overflow-auto max-h-64">{JSON.stringify(row.old_data, null, 2)}</pre>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground mb-1">new_data</div>
            <pre className="bg-muted/40 p-2 rounded text-[10px] overflow-auto max-h-64">{JSON.stringify(row.new_data, null, 2)}</pre>
          </div>
        </div>
      </details>
    </div>
  );
}

function computeDiff(oldData: unknown, newData: unknown) {
  const a = (oldData && typeof oldData === "object" ? oldData : {}) as Record<string, unknown>;
  const b = (newData && typeof newData === "object" ? newData : {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const skip = new Set(["updated_at", "created_at"]);
  const out: { key: string; before: unknown; after: unknown }[] = [];
  for (const k of keys) {
    if (skip.has(k)) continue;
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
      out.push({ key: k, before: a[k], after: b[k] });
    }
  }
  return out;
}

function stringify(v: unknown) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
