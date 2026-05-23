import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
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
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  setAdmin,
  setPrecoEscolha,
} from "@/lib/admin-users.functions";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin — Usuários" }] }),
});

interface UserRow {
  id: string;
  nome: string;
  email: string | null;
  created_at: string;
  can_use_preco_escolha: boolean;
  roles: string[];
}

function AdminPage() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const auth = useAuth();
  const list = useServerFn(listUsers);
  const create = useServerFn(createUser);
  const update = useServerFn(updateUser);
  const del = useServerFn(deleteUser);
  const promote = useServerFn(setAdmin);
  const togglePreco = useServerFn(setPrecoEscolha);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAdminNew, setIsAdminNew] = useState(false);
  const [canPrecoNew, setCanPrecoNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit dialog
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  useEffect(() => {
    if (auth.loading || auth.roleLoading) return;
    if (!auth.user) {
      navigate({ to: "/login" });
      return;
    }
    if (!auth.isAdmin) {
      navigate({ to: "/" });
    }
  }, [auth.loading, auth.roleLoading, auth.user, auth.isAdmin, navigate]);

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const data = (await list()) as UserRow[];
      setUsers(data);
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

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      await create({ data: { nome, email, password, isAdmin: isAdminNew, canUsePrecoEscolha: canPrecoNew } });
      setNome("");
      setEmail("");
      setPassword("");
      setIsAdminNew(false);
      setCanPrecoNew(false);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Excluir este usuário?")) return;
    try {
      await del({ data: { id } });
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function onToggleAdmin(id: string, current: boolean) {
    try {
      await promote({ data: { id, isAdmin: !current } });
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function onTogglePreco(id: string, current: boolean) {
    try {
      await togglePreco({ data: { id, enabled: !current } });
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setEditNome(u.nome ?? "");
    setEditEmail(u.email ?? "");
    setEditPassword("");
  }

  async function onEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setEditSubmitting(true);
    setErr(null);
    try {
      await update({
        data: {
          id: editing.id,
          nome: editNome,
          email: editEmail,
          password: editPassword || undefined,
        },
      });
      setEditing(null);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setEditSubmitting(false);
    }
  }

  if (auth.loading || auth.roleLoading || !auth.isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (pathname !== "/admin") {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="font-bold text-sm sm:text-base">Administração de Usuários</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground">
              Gerencie acesso, papéis e a tabela Preço de Escolha
            </p>
          </div>
          <div className="flex gap-1.5 sm:gap-2 flex-wrap">
            <Link to="/admin/products" className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-md border border-border hover:bg-muted">
              📦 Produtos
            </Link>
            <Link to="/admin/dashboard" className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-md border border-border hover:bg-muted">
              📊 Dashboard
            </Link>
            <Link to="/" className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-md border border-border hover:bg-muted">
              ← Pedidos
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Novo usuário</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <form onSubmit={onCreate} className="grid sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="nome" className="text-xs">Nome</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required className="h-8 text-xs sm:text-sm" />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="email" className="text-xs">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-8 text-xs sm:text-sm" />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="password" className="text-xs">Senha (mín. 6)</Label>
                <Input
                  id="password"
                  type="text"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-8 text-xs sm:text-sm"
                />
              </div>
              <div className="flex items-end gap-3 sm:gap-4 flex-wrap">
                <label className="flex items-center gap-2 text-xs sm:text-sm">
                  <input
                    type="checkbox"
                    checked={isAdminNew}
                    onChange={(e) => setIsAdminNew(e.target.checked)}
                  />
                  Administrador
                </label>
                <label className="flex items-center gap-2 text-xs sm:text-sm">
                  <input
                    type="checkbox"
                    checked={canPrecoNew}
                    onChange={(e) => setCanPrecoNew(e.target.checked)}
                  />
                  Acesso a Preço de Escolha
                </label>
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" size="sm" disabled={submitting} className="w-full sm:w-auto">
                  {submitting ? "Criando..." : "Criar usuário"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {err && (
          <div className="text-xs sm:text-sm text-destructive border border-destructive/40 bg-destructive/10 rounded-md p-3">
            {err}
          </div>
        )}

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Usuários ({users.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <>
                {/* Mobile: card list */}
                <div className="sm:hidden space-y-2">
                  {users.map((u) => {
                    const isUserAdmin = u.roles.includes("admin");
                    const isSelf = u.id === auth.user?.id;
                    return (
                      <div key={u.id} className="border border-border rounded-md p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-xs truncate">
                              {u.nome || "—"} {isSelf && <span className="text-[10px] text-muted-foreground">(você)</span>}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">{u.email}</div>
                          </div>
                          <span
                            className={
                              "inline-block px-1.5 py-0.5 rounded text-[10px] shrink-0 " +
                              (isUserAdmin
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground")
                            }
                          >
                            {isUserAdmin ? "admin" : "user"}
                          </span>
                        </div>
                        <label className="inline-flex items-center gap-2 text-[11px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!u.can_use_preco_escolha}
                            onChange={() => onTogglePreco(u.id, !!u.can_use_preco_escolha)}
                          />
                          Preço de Escolha: {u.can_use_preco_escolha ? "Liberado" : "Bloqueado"}
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => openEdit(u)}>
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => onToggleAdmin(u.id, isUserAdmin)}
                            disabled={isSelf && isUserAdmin}
                          >
                            {isUserAdmin ? "Rem. admin" : "Tornar admin"}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => onDelete(u.id)}
                            disabled={isSelf}
                          >
                            Excluir
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop: table */}
                <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead>Preço de Escolha</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => {
                      const isUserAdmin = u.roles.includes("admin");
                      const isSelf = u.id === auth.user?.id;
                      return (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">
                            {u.nome || "—"}{" "}
                            {isSelf && <span className="text-xs text-muted-foreground">(você)</span>}
                          </TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>
                            <span
                              className={
                                "inline-block px-2 py-0.5 rounded text-xs " +
                                (isUserAdmin
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground")
                              }
                            >
                              {isUserAdmin ? "admin" : "user"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!u.can_use_preco_escolha}
                                onChange={() => onTogglePreco(u.id, !!u.can_use_preco_escolha)}
                              />
                              {u.can_use_preco_escolha ? "Liberado" : "Bloqueado"}
                            </label>
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => openEdit(u)}>
                              Editar
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onToggleAdmin(u.id, isUserAdmin)}
                              disabled={isSelf && isUserAdmin}
                            >
                              {isUserAdmin ? "Remover admin" : "Tornar admin"}
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => onDelete(u.id)}
                              disabled={isSelf}
                            >
                              Excluir
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md max-h-[92vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Editar usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={onEditSubmit} className="space-y-3 sm:space-y-4">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="edit-nome" className="text-xs">Nome</Label>
              <Input id="edit-nome" value={editNome} onChange={(e) => setEditNome(e.target.value)} required className="h-8 text-xs sm:text-sm" />
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="edit-email" className="text-xs">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                required
                className="h-8 text-xs sm:text-sm"
              />
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="edit-password" className="text-xs">Nova senha (opcional)</Label>
              <Input
                id="edit-password"
                type="text"
                placeholder="Deixe em branco para manter"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                className="h-8 text-xs sm:text-sm"
              />
            </div>
            <DialogFooter className="flex-row gap-2">
              <Button type="button" variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="flex-1 sm:flex-none" disabled={editSubmitting}>
                {editSubmitting ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
