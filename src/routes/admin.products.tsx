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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listProducts,
  upsertProduct,
  deleteProduct,
} from "@/lib/products.functions";
import { priceTables, brl, type PriceTable, type Product } from "@/lib/products";

export const Route = createFileRoute("/admin/products")({
  component: AdminProductsPage,
  head: () => ({ meta: [{ title: "Admin — Produtos" }] }),
});

const emptyProduct = (): Product => ({
  codigo: "",
  descricao: "",
  apresentacao: "",
  ncm: "",
  classificacao: "",
  principioAtivo: "",
  validade: "",
  qtdPorEmbalagem: 1,
  linha: "",
  categoria: "",
  divisao: "",
  precos: Object.fromEntries(priceTables.map((t) => [t, null])) as Record<PriceTable, number | null>,
  impostos: { ivaSt: 0, icms: 0, ipi: 0, pis: 0, cofins: 0 },
});

function AdminProductsPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const list = useServerFn(listProducts);
  const upsert = useServerFn(upsertProduct);
  const del = useServerFn(deleteProduct);

  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [editing, setEditing] = useState<Product | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (auth.loading || auth.roleLoading) return;
    if (!auth.user) { navigate({ to: "/login" }); return; }
    if (!auth.isAdmin) { navigate({ to: "/" }); }
  }, [auth.loading, auth.roleLoading, auth.user, auth.isAdmin, navigate]);

  async function refresh() {
    setLoading(true); setErr(null);
    try {
      const data = (await list()) as Product[];
      setItems(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }

  useEffect(() => { if (auth.isAdmin) void refresh(); /* eslint-disable-next-line */ }, [auth.isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) =>
      p.codigo.toLowerCase().includes(q) ||
      p.descricao.toLowerCase().includes(q) ||
      p.categoria.toLowerCase().includes(q) ||
      p.principioAtivo.toLowerCase().includes(q),
    );
  }, [items, search]);

  function openNew() { setEditing(emptyProduct()); setIsNew(true); }
  function openEdit(p: Product) { setEditing(structuredClone(p)); setIsNew(false); }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSubmitting(true); setErr(null);
    try {
      await upsert({ data: editing });
      setEditing(null);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setSubmitting(false); }
  }

  async function onDelete(codigo: string) {
    if (!confirm(`Excluir o produto ${codigo}?`)) return;
    try {
      await del({ data: { codigo } });
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  if (auth.loading || auth.roleLoading || !auth.isAdmin) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="font-bold text-sm sm:text-base">Administração de Produtos</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Cadastre, edite preços e impostos, ou exclua produtos do catálogo</p>
          </div>
          <div className="flex gap-1.5 sm:gap-2 flex-wrap">
            <Button size="sm" onClick={openNew}>+ Novo produto</Button>
            <Link to="/admin" className="px-2.5 py-1.5 text-xs sm:text-sm rounded-md border border-border hover:bg-muted">← Usuários</Link>
            <Link to="/" className="px-2.5 py-1.5 text-xs sm:text-sm rounded-md border border-border hover:bg-muted">Pedidos</Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
        {err && (
          <div className="text-sm text-destructive border border-destructive/40 bg-destructive/10 rounded-md p-3">{err}</div>
        )}

        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 space-y-0 p-4 sm:p-6">
            <CardTitle className="text-sm sm:text-base">Produtos ({filtered.length}{filtered.length !== items.length ? `/${items.length}` : ""})</CardTitle>
            <Input
              placeholder="Buscar por código, descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:max-w-xs h-9 text-sm"
            />
          </CardHeader>
          <CardContent className="p-2 sm:p-6 sm:pt-0">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <>
                {/* Mobile: card list */}
                <div className="sm:hidden space-y-2">
                  {filtered.map((p) => (
                    <div key={p.codigo} className="border border-border rounded-md p-2.5 bg-card">
                      <div className="min-w-0">
                        <div className="font-mono text-[10px] text-muted-foreground">{p.codigo}</div>
                        <div className="text-xs font-medium leading-snug">{p.descricao}</div>
                        {p.apresentacao && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">{p.apresentacao}</div>
                        )}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-muted-foreground">
                          {p.categoria && <span>{p.categoria}</span>}
                          <span>Cx: {p.qtdPorEmbalagem}</span>
                          <span>Tabela: {p.precos["Tabela"] != null ? brl(p.precos["Tabela"]!) : "—"}</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs flex-1" onClick={() => openEdit(p)}>Editar</Button>
                        <Button type="button" variant="destructive" size="sm" className="h-7 px-2 text-xs flex-1" onClick={() => onDelete(p.codigo)}>Excluir</Button>
                      </div>
                    </div>
                  ))}
                  {!filtered.length && (
                    <p className="text-center text-xs text-muted-foreground py-6">Nenhum produto.</p>
                  )}
                </div>

                {/* Desktop: table */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Tabela</TableHead>
                        <TableHead className="text-right">Cx</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((p) => (
                        <TableRow key={p.codigo}>
                          <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                          <TableCell className="max-w-md">
                            <div className="text-sm font-medium leading-snug">{p.descricao}</div>
                            <div className="text-[11px] text-muted-foreground">{p.apresentacao}</div>
                          </TableCell>
                          <TableCell className="text-xs">{p.categoria}</TableCell>
                          <TableCell className="text-right text-sm">{p.precos["Tabela"] != null ? brl(p.precos["Tabela"]!) : "—"}</TableCell>
                          <TableCell className="text-right">{p.qtdPorEmbalagem}</TableCell>
                          <TableCell className="text-right space-x-2 whitespace-nowrap">
                            <Button type="button" variant="outline" size="sm" onClick={() => openEdit(p)}>Editar</Button>
                            <Button type="button" variant="destructive" size="sm" onClick={() => onDelete(p.codigo)}>Excluir</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!filtered.length && (
                        <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Nenhum produto.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? "Novo produto" : `Editar ${editing?.codigo}`}</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Código</Label>
                  <Input
                    value={editing.codigo}
                    onChange={(e) => setEditing({ ...editing, codigo: e.target.value })}
                    disabled={!isNew}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Apresentação</Label>
                  <Input value={editing.apresentacao} onChange={(e) => setEditing({ ...editing, apresentacao: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Descrição</Label>
                  <Input value={editing.descricao} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>NCM</Label>
                  <Input value={editing.ncm} onChange={(e) => setEditing({ ...editing, ncm: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Classificação</Label>
                  <Input value={editing.classificacao} onChange={(e) => setEditing({ ...editing, classificacao: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Princípio ativo</Label>
                  <Input value={editing.principioAtivo} onChange={(e) => setEditing({ ...editing, principioAtivo: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Validade (meses)</Label>
                  <Input value={editing.validade} onChange={(e) => setEditing({ ...editing, validade: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Qtd por embalagem</Label>
                  <Input type="number" min={1} value={editing.qtdPorEmbalagem}
                    onChange={(e) => setEditing({ ...editing, qtdPorEmbalagem: Math.max(1, Number(e.target.value) || 1) })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Linha</Label>
                  <Input value={editing.linha} onChange={(e) => setEditing({ ...editing, linha: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Input value={editing.categoria} onChange={(e) => setEditing({ ...editing, categoria: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Divisão</Label>
                  <Input value={editing.divisao} onChange={(e) => setEditing({ ...editing, divisao: e.target.value })} />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">Preços por tabela (R$)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {priceTables.map((t) => (
                    <div key={t} className="space-y-1.5">
                      <Label className="text-xs">{t}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={editing.precos[t] ?? ""}
                        placeholder="—"
                        onChange={(e) => {
                          const v = e.target.value === "" ? null : Number(e.target.value);
                          setEditing({ ...editing, precos: { ...editing.precos, [t]: v } });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">Impostos (0 a 1 — ex.: 0.18 = 18%)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {(["ivaSt", "icms", "ipi", "pis", "cofins"] as const).map((k) => (
                    <div key={k} className="space-y-1.5">
                      <Label className="text-xs uppercase">{k}</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        min={0}
                        value={editing.impostos[k]}
                        onChange={(e) => setEditing({
                          ...editing,
                          impostos: { ...editing.impostos, [k]: Number(e.target.value) || 0 },
                        })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Salvando..." : isNew ? "Cadastrar" : "Salvar alterações"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
