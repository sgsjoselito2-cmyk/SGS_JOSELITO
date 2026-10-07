-- Módulo PALETIZADO (Paletizador por Columnas): tablas del catálogo.
-- Ejecute este script una vez en Supabase → SQL Editor → New query → Run.

create table if not exists public.paletizador_productos (
  id          uuid primary key default gen_random_uuid(),
  codigo      text,
  nombre      text not null,
  largo       numeric not null check (largo > 0),   -- mm
  ancho       numeric not null check (ancho > 0),   -- mm
  alto        numeric not null check (alto > 0),    -- mm
  peso        numeric not null default 0,           -- kg por caja
  girar       boolean not null default true,
  orden       bigint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists paletizador_productos_codigo_unico on public.paletizador_productos (codigo) where codigo is not null and codigo <> '';

create table if not exists public.paletizador_palets (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  largo       numeric not null check (largo > 0),   -- mm
  ancho       numeric not null check (ancho > 0),   -- mm
  base        numeric not null default 144,         -- mm
  altura_max  numeric not null,                     -- mm, con base
  peso_max    numeric not null default 0,           -- kg
  holgura     numeric not null default 0,           -- mm
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (altura_max > base)
);

-- Fecha de modificación automática
create or replace function public.paletizador_tocar_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists paletizador_productos_updated on public.paletizador_productos;
create trigger paletizador_productos_updated before update on public.paletizador_productos for each row execute function public.paletizador_tocar_updated_at();
drop trigger if exists paletizador_palets_updated on public.paletizador_palets;
create trigger paletizador_palets_updated before update on public.paletizador_palets for each row execute function public.paletizador_tocar_updated_at();

-- Seguridad: solo los usuarios con sesión iniciada pueden ver y cambiar el catálogo.
alter table public.paletizador_productos enable row level security;
alter table public.paletizador_palets    enable row level security;

drop policy if exists "paletizador leer productos" on public.paletizador_productos;
drop policy if exists "paletizador editar productos" on public.paletizador_productos;
create policy "paletizador leer productos"   on public.paletizador_productos for select to authenticated using (true);
create policy "paletizador editar productos" on public.paletizador_productos for all    to authenticated using (true) with check (true);

drop policy if exists "paletizador leer palets" on public.paletizador_palets;
drop policy if exists "paletizador editar palets" on public.paletizador_palets;
create policy "paletizador leer palets"   on public.paletizador_palets for select to authenticated using (true);
create policy "paletizador editar palets" on public.paletizador_palets for all    to authenticated using (true) with check (true);

-- Avisar a las páginas abiertas cuando alguien cambia el catálogo (tiempo real)
do $$ begin
  begin alter publication supabase_realtime add table public.paletizador_productos; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.paletizador_palets;    exception when duplicate_object then null; end;
end $$;
