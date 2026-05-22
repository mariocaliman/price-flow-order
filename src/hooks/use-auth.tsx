import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface AuthState {
  loading: boolean;
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  nome: string;
  canUsePrecoEscolha: boolean;
  roleLoading: boolean;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [nome, setNome] = useState("");
  const [canUsePrecoEscolha, setCanUsePrecoEscolha] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) {
      setIsAdmin(false);
      setNome("");
      setCanUsePrecoEscolha(false);
      setRoleLoading(false);
      return;
    }
    setRoleLoading(true);
    (async () => {
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("profiles").select("nome, can_use_preco_escolha").eq("id", uid).maybeSingle(),
      ]);
      setIsAdmin((roles ?? []).some((r) => r.role === "admin"));
      setNome(profile?.nome ?? "");
      setCanUsePrecoEscolha(!!profile?.can_use_preco_escolha);
      setRoleLoading(false);
    })();
  }, [session?.user?.id]);

  return { loading, user: session?.user ?? null, session, isAdmin, nome, canUsePrecoEscolha, roleLoading };
}
