import { useEffect, useState } from "react";
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold">Administração de Usuários</h1>
            <p className="text-xs text-muted-foreground">
              Gerencie acesso, papéis e a tabela Preço de Escolha
            </p>
          </div>
          <Link
            to="/"
            className="px-3 py-2 text-sm rounded-md border border-border hover:bg-muted"
          >
            ← Voltar aos pedidos
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Novo usuário</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha (mín. 6)</Label>
                <Input
                  id="password"
                  type="text"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-end gap-4 flex-wrap">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isAdminNew}
                    onChange={(e) => setIsAdminNew(e.target.checked)}
                  />
                  Administrador
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={canPrecoNew}
                    onChange={(e) => setCanPrecoNew(e.target.checked)}
                  />
                  Acesso a Preço de Escolha
                </label>
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Criando..." : "Criar usuário"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {err && (
          <div className="text-sm text-destructive border border-destructive/40 bg-destructive/10 rounded-md p-3">
            {err}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Usuários ({users.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <div className="overflow-x-auto">
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
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={onEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nome">Nome</Label>
              <Input id="edit-nome" value={editNome} onChange={(e) => setEditNome(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Nova senha (opcional)</Label>
              <Input
                id="edit-password"
                type="text"
                placeholder="Deixe em branco para manter"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={editSubmitting}>
                {editSubmitting ? "Salvando..." : "Salvar alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
