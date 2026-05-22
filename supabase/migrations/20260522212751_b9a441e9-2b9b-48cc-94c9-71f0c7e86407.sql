create table public.products (
  codigo text primary key,
  descricao text not null default '',
  apresentacao text not null default '',
  ncm text not null default '',
  classificacao text not null default '',
  principio_ativo text not null default '',
  validade text not null default '',
  qtd_por_embalagem integer not null default 1,
  linha text not null default '',
  categoria text not null default '',
  divisao text not null default '',
  precos jsonb not null default '{}'::jsonb,
  impostos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "Authenticated read products"
  on public.products for select
  to authenticated
  using (true);

create policy "Admins insert products"
  on public.products for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins update products"
  on public.products for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins delete products"
  on public.products for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create trigger products_updated_at
  before update on public.products
  for each row execute function public.update_updated_at_column();

create index products_categoria_idx on public.products(categoria);
create index products_divisao_idx on public.products(divisao);