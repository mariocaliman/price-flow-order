import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/perfil")({ component: PerfilPage });

function PerfilPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cargo, setCargo] = useState("");
  const [bio, setBio] = useState("");

  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!auth.loading && !auth.user) navigate({ to: "/login" });
  }, [auth.loading, auth.user, navigate]);

  useEffect(() => {
    const uid = auth.user?.id;
    if (!uid) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("nome, telefone, cargo, bio")
        .eq("id", uid)
        .maybeSingle();
      if (data) {
        setNome(data.nome ?? "");
        setTelefone(data.telefone ?? "");
        setCargo(data.cargo ?? "");
        setBio(data.bio ?? "");
      }
      setLoading(false);
    })();
  }, [auth.user?.id]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!auth.user) return;
    setSaving(true);
    setMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        nome: nome.trim(),
        telefone: telefone.trim() || null,
        cargo: cargo.trim() || null,
        bio: bio.trim() || null,
      })
      .eq("id", auth.user.id);
    setSaving(false);
    if (error) setMsg({ kind: "err", text: error.message });
    else setMsg({ kind: "ok", text: "Perfil atualizado com sucesso." });
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    if (pwd.length < 8) {
      setPwdMsg({ kind: "err", text: "A senha deve ter pelo menos 8 caracteres." });
      return;
    }
    if (pwd !== pwd2) {
      setPwdMsg({ kind: "err", text: "As senhas não coincidem." });
      return;
    }
    setPwdSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setPwdSaving(false);
    if (error) setPwdMsg({ kind: "err", text: error.message });
    else {
      setPwd("");
      setPwd2("");
      setPwdMsg({ kind: "ok", text: "Senha alterada com sucesso." });
    }
  }

  if (auth.loading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Meu Perfil</h1>
            <p className="text-xs text-muted-foreground">{auth.user?.email}</p>
          </div>
          <Link
            to="/"
            className="px-3 py-2 text-xs sm:text-sm rounded-md border border-border hover:bg-muted transition"
          >
            Voltar
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* Informações pessoais */}
        <section className="bg-card border border-border rounded-lg p-5">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-4">
            Informações pessoais
          </h2>
          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nome</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                maxLength={120}
                className="mt-1 w-full px-3 py-2 rounded-md bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Telefone</label>
                <input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  maxLength={30}
                  className="mt-1 w-full px-3 py-2 rounded-md bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Cargo</label>
                <input
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  placeholder="Ex.: Representante comercial"
                  maxLength={120}
                  className="mt-1 w-full px-3 py-2 rounded-md bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                maxLength={500}
                placeholder="Conte um pouco sobre você..."
                className="mt-1 w-full px-3 py-2 rounded-md bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              />
              <p className="text-[11px] text-muted-foreground mt-1">{bio.length}/500</p>
            </div>
            {msg && (
              <p className={`text-xs ${msg.kind === "ok" ? "text-emerald-600" : "text-destructive"}`}>
                {msg.text}
              </p>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </form>
        </section>

        {/* Alterar senha */}
        <section className="bg-card border border-border rounded-lg p-5">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-4">
            Alterar senha
          </h2>
          <form onSubmit={changePassword} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nova senha</label>
              <input
                type="password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                minLength={8}
                required
                className="mt-1 w-full px-3 py-2 rounded-md bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Confirmar nova senha</label>
              <input
                type="password"
                value={pwd2}
                onChange={(e) => setPwd2(e.target.value)}
                minLength={8}
                required
                className="mt-1 w-full px-3 py-2 rounded-md bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {pwdMsg && (
              <p className={`text-xs ${pwdMsg.kind === "ok" ? "text-emerald-600" : "text-destructive"}`}>
                {pwdMsg.text}
              </p>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={pwdSaving}
                className="px-4 py-2 text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
              >
                {pwdSaving ? "Alterando..." : "Alterar senha"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
