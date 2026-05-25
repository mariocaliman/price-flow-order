import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, email, created_at, can_use_preco_escolha")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    return (profiles ?? []).map((p) => ({
      ...p,
      roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
    }));
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email(),
        nome: z.string().min(1).max(120),
        password: z.string().min(6).max(72),
        isAdmin: z.boolean().optional(),
        canUsePrecoEscolha: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (error) throw new Error(error.message);
    const newId = created.user!.id;
    if (data.isAdmin) {
      await supabaseAdmin.from("user_roles").upsert({ user_id: newId, role: "admin" });
    }
    if (data.canUsePrecoEscolha) {
      await supabaseAdmin
        .from("profiles")
        .update({ can_use_preco_escolha: true })
        .eq("id", newId);
    }
    return { id: newId };
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        nome: z.string().min(1).max(120).optional(),
        email: z.string().email().optional(),
        password: z.string().min(6).max(72).optional().or(z.literal("")),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const authPatch: { email?: string; password?: string } = {};
    if (data.email) authPatch.email = data.email;
    if (data.password) authPatch.password = data.password;
    if (Object.keys(authPatch).length > 0) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, authPatch);
      if (error) throw new Error(error.message);
    }
    const profPatch: { nome?: string; email?: string } = {};
    if (data.nome !== undefined) profPatch.nome = data.nome;
    if (data.email) profPatch.email = data.email;
    if (Object.keys(profPatch).length > 0) {
      const { error } = await supabaseAdmin.from("profiles").update(profPatch).eq("id", data.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    if (data.id === context.userId) throw new Error("Não é possível excluir o próprio usuário.");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), isAdmin: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    if (data.isAdmin) {
      await supabaseAdmin.from("user_roles").upsert({ user_id: data.id, role: "admin" });
    } else {
      if (data.id === context.userId)
        throw new Error("Você não pode remover o seu próprio admin.");
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.id)
        .eq("role", "admin");
    }
    return { ok: true };
  });

export const setPrecoEscolha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ can_use_preco_escolha: data.enabled })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
