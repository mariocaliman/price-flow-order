import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  deleteUser,
  setAdmin,
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
  roles: string[];
}

function AdminPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const list = useServerFn(listUsers);
  const create = useServerFn(createUser);
  const del = useServerFn(deleteUser);
  const promote = useServerFn(setAdmin);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAdminNew, setIsAdminNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      await create({ data: { nome, email, password, isAdmin: isAdminNew } });
      setNome("");
      setEmail("");
      setPassword("");
      setIsAdminNew(false);
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
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold">Administração de Usuários</h1>
            <p className="text-xs text-muted-foreground">
              Gerencie quem pode acessar o sistema de pedidos
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

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Novo usuário</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
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
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isAdminNew}
                    onChange={(e) => setIsAdminNew(e.target.checked)}
                  />
                  Tornar administrador
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Papel</TableHead>
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
                          {u.nome || "—"} {isSelf && <span className="text-xs text-muted-foreground">(você)</span>}
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
                        <TableCell className="text-right space-x-2">
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
    </div>
  );
}
