CREATE SEQUENCE IF NOT EXISTS public.propostas_numero_seq;
CREATE TABLE public.propostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero bigint NOT NULL DEFAULT nextval('public.propostas_numero_seq') UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'rascunho',
  vencimento date,
  total numeric NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT USAGE ON SEQUENCE public.propostas_numero_seq TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.propostas TO authenticated;
GRANT ALL ON public.propostas TO service_role;
ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin select" ON public.propostas FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own insert" ON public.propostas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own or admin update" ON public.propostas FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own or admin delete" ON public.propostas FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE OR REPLACE FUNCTION public.propostas_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER propostas_touch BEFORE UPDATE ON public.propostas FOR EACH ROW EXECUTE FUNCTION public.propostas_touch();