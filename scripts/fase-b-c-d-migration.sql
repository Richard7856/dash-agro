-- ============================================================
-- Migración SAE Parity — Fases B, C y D
-- Fecha: 2026-04-01
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- FASE B: Pedidos de Venta (Sales Orders)
-- ─────────────────────────────────────────────────────────────

create table if not exists ordenes_venta (
  id              uuid primary key default gen_random_uuid(),
  numero          text not null,
  cliente_id      uuid references clientes(id) on delete set null,
  fecha           date not null default current_date,
  fecha_entrega   date,
  status          text not null default 'borrador'
                  check (status in ('borrador','confirmado','surtido','cancelado')),
  subtotal        numeric(12,2) not null default 0,
  iva             numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  notas           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table if not exists ordenes_venta_items (
  id                      uuid primary key default gen_random_uuid(),
  orden_venta_id          uuid not null references ordenes_venta(id) on delete cascade,
  inventario_registro_id  uuid references inventario_registros(id) on delete set null,
  descripcion             text not null,
  cantidad                numeric(12,4) not null,
  precio_unitario         numeric(12,4) not null,
  descuento_pct           numeric(5,2) not null default 0,
  subtotal                numeric(12,2) not null,
  created_at              timestamptz default now()
);

alter table ordenes_venta enable row level security;
alter table ordenes_venta_items enable row level security;

create policy "auth users ordenes_venta"
  on ordenes_venta for all using (auth.role() = 'authenticated');
create policy "auth users ordenes_venta_items"
  on ordenes_venta_items for all using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────
-- FASE C: Órdenes de Compra (Purchase Orders)
-- ─────────────────────────────────────────────────────────────

create table if not exists ordenes_compra (
  id                      uuid primary key default gen_random_uuid(),
  numero                  text not null,
  proveedor_id            uuid references proveedores(id) on delete set null,
  fecha                   date not null default current_date,
  fecha_entrega_esperada  date,
  status                  text not null default 'borrador'
                          check (status in ('borrador','enviada','recibida_parcial','recibida','cancelada')),
  subtotal                numeric(12,2) not null default 0,
  iva                     numeric(12,2) not null default 0,
  total                   numeric(12,2) not null default 0,
  notas                   text,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

create table if not exists ordenes_compra_items (
  id                      uuid primary key default gen_random_uuid(),
  orden_compra_id         uuid not null references ordenes_compra(id) on delete cascade,
  inventario_registro_id  uuid references inventario_registros(id) on delete set null,
  descripcion             text not null,
  cantidad                numeric(12,4) not null,
  precio_unitario         numeric(12,4) not null,
  descuento_pct           numeric(5,2) not null default 0,
  subtotal                numeric(12,2) not null,
  created_at              timestamptz default now()
);

alter table ordenes_compra enable row level security;
alter table ordenes_compra_items enable row level security;

create policy "auth users ordenes_compra"
  on ordenes_compra for all using (auth.role() = 'authenticated');
create policy "auth users ordenes_compra_items"
  on ordenes_compra_items for all using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────
-- FASE D-1: Lotes con caducidad
-- ─────────────────────────────────────────────────────────────

create table if not exists inventario_lotes (
  id                uuid primary key default gen_random_uuid(),
  producto_id       uuid not null references inventario_registros(id) on delete cascade,
  numero_lote       text not null,
  fecha_fabricacion date,
  fecha_caducidad   date,
  cantidad_inicial  numeric(12,4) not null,
  cantidad_actual   numeric(12,4) not null,
  status            text not null default 'activo'
                    check (status in ('activo','agotado','caducado')),
  notas             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index if not exists inventario_lotes_producto_idx
  on inventario_lotes(producto_id);
create index if not exists inventario_lotes_caducidad_idx
  on inventario_lotes(fecha_caducidad) where status = 'activo';

alter table inventario_lotes enable row level security;
create policy "auth users inventario_lotes"
  on inventario_lotes for all using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────
-- FASE D-2: Costo aterrizado en compras
-- ─────────────────────────────────────────────────────────────

alter table compras add column if not exists costo_flete numeric(12,2) not null default 0;
alter table compras add column if not exists costo_otros numeric(12,2) not null default 0;
