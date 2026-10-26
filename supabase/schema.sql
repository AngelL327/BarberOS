create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  city text not null,
  email text not null,
  phone text not null,
  initials text not null,
  avatar_bg text not null default '#0891b2',
  products integer not null default 0,
  rating numeric(2,1) not null default 5.0,
  reviews integer not null default 0,
  status text not null default 'active' check (status in ('active', 'pending', 'inactive')),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  category text not null,
  price numeric(12,2) not null check (price >= 0),
  city text not null,
  store_name text not null,
  store_initials text not null,
  store_color text not null default '#0891b2',
  status text not null default 'active' check (status in ('active', 'inactive')),
  updated_at timestamptz not null default now()
);

create table if not exists public.waitlist (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.waitlist enable row level security;

drop policy if exists "Public can read active stores" on public.stores;
create policy "Public can read active stores" on public.stores for select using (status = 'active');

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products" on public.products for select using (status = 'active');

drop policy if exists "Public can register stores" on public.stores;
create policy "Public can register stores" on public.stores for insert with check (status = 'active');

drop policy if exists "Public can publish products" on public.products;
create policy "Public can publish products" on public.products for insert with check (status = 'active');

drop policy if exists "Public can join waitlist" on public.waitlist;
create policy "Public can join waitlist" on public.waitlist for insert with check (position('@' in email) > 1);

drop policy if exists "Public can update waitlist" on public.waitlist;
create policy "Public can update waitlist" on public.waitlist for update using (true);

create index if not exists products_city_idx on public.products (city);
create index if not exists products_name_idx on public.products using gin (to_tsvector('simple', name));

-- BarberOS workspace. Every operational row belongs to one barber shop.
create table if not exists public.barber_shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  city text not null default '',
  phone text,
  plan text not null default 'INICIAL',
  subscription_status text not null default 'TRIAL',
  created_at timestamptz not null default now()
);

create table if not exists public.barber_memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.barber_shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'OWNER' check (role in ('OWNER','BARBER')),
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table if not exists public.barber_services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.barber_shops(id) on delete cascade,
  name text not null,
  category text not null default '',
  duration_minutes integer not null check (duration_minutes > 0),
  price numeric(12,2) not null check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.barber_products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.barber_shops(id) on delete cascade,
  name text not null,
  category text not null default '',
  price numeric(12,2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.barber_clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.barber_shops(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  visits integer not null default 0 check (visits >= 0),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.barber_staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.barber_shops(id) on delete cascade,
  name text not null,
  phone text,
  commission_rate numeric(5,2) not null default 0 check (commission_rate between 0 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.barber_appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.barber_shops(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  service_name text not null,
  barber_name text not null,
  starts_at timestamptz not null,
  price numeric(12,2) not null check (price >= 0),
  duration_minutes integer not null default 30 check (duration_minutes > 0),
  status text not null default 'PENDING' check (status in ('PENDING','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW')),
  created_at timestamptz not null default now()
);

create table if not exists public.barber_expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.barber_shops(id) on delete cascade,
  description text not null,
  category text not null default '',
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null default 'cash' check (payment_method in ('cash','card','transfer')),
  created_at timestamptz not null default now()
);

create table if not exists public.barber_cash_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.barber_shops(id) on delete cascade,
  opening_cash numeric(12,2) not null default 0 check (opening_cash >= 0),
  counted_cash numeric(12,2) check (counted_cash >= 0),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create unique index if not exists barber_one_open_cash_per_business
  on public.barber_cash_sessions (business_id) where closed_at is null;

create table if not exists public.barber_sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.barber_shops(id) on delete cascade,
  appointment_id uuid references public.barber_appointments(id),
  description text not null,
  item_name text not null default '',
  quantity integer not null default 1 check (quantity > 0),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  tip numeric(12,2) not null default 0 check (tip >= 0),
  total numeric(12,2) not null check (total > 0),
  payment_method text not null check (payment_method in ('cash','card','transfer')),
  barber_name text not null default '',
  commission_rate numeric(5,2) not null default 0 check (commission_rate between 0 and 100),
  commission_amount numeric(12,2) not null default 0 check (commission_amount >= 0),
  created_at timestamptz not null default now()
);

alter table public.barber_sales add column if not exists item_name text not null default '';
alter table public.barber_sales add column if not exists quantity integer not null default 1;
alter table public.barber_sales add column if not exists subtotal numeric(12,2) not null default 0;
alter table public.barber_sales add column if not exists discount numeric(12,2) not null default 0;
alter table public.barber_sales add column if not exists tip numeric(12,2) not null default 0;
alter table public.barber_sales add column if not exists appointment_id uuid references public.barber_appointments(id);
create unique index if not exists barber_one_sale_per_appointment
  on public.barber_sales (appointment_id) where appointment_id is not null;

create table if not exists public.barber_sale_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.barber_shops(id) on delete cascade,
  sale_id uuid not null references public.barber_sales(id) on delete cascade,
  item_name text not null,
  item_type text not null check (item_type in ('service','product')),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'barber_appointments_no_overlap') then
    alter table public.barber_appointments
      add constraint barber_appointments_no_overlap
      exclude using gist (
        business_id with =,
        barber_name with =,
        tstzrange(starts_at, starts_at + make_interval(mins => duration_minutes), '[)') with &&
      ) where (status in ('PENDING','CONFIRMED'));
  end if;
end;
$$;

create index if not exists barber_appointments_business_date_idx
  on public.barber_appointments (business_id, starts_at);
create index if not exists barber_sales_business_date_idx
  on public.barber_sales (business_id, created_at desc);
create index if not exists barber_expenses_business_date_idx
  on public.barber_expenses (business_id, created_at desc);

create or replace function public.require_open_cash_for_cash_expense()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  open_session_id uuid;
begin
  if new.payment_method = 'cash' then
    select id into open_session_id
      from public.barber_cash_sessions
      where business_id = new.business_id and closed_at is null
      for update;
    if not found then
      raise exception 'Abre la caja antes de registrar un gasto en efectivo';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists barber_expense_requires_open_cash on public.barber_expenses;
create trigger barber_expense_requires_open_cash
  before insert on public.barber_expenses
  for each row execute procedure public.require_open_cash_for_cash_expense();

create or replace function public.is_barber_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.barber_memberships
    where business_id = p_business_id and user_id = auth.uid()
  );
$$;

create or replace function public.create_barber_shop_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  shop_name text := coalesce(new.raw_user_meta_data ->> 'shop_name', '');
  shop_city text := coalesce(new.raw_user_meta_data ->> 'shop_city', '');
  shop_slug text;
  new_shop_id uuid;
begin
  if shop_name = '' then
    return new;
  end if;
  shop_slug := trim(both '-' from regexp_replace(lower(shop_name), '[^a-z0-9]+', '-', 'g'));
  if shop_slug = '' then
    shop_slug := 'barberia';
  end if;
  shop_slug := left(shop_slug, 45) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  insert into public.barber_shops (name, slug, city)
    values (shop_name, shop_slug, shop_city) returning id into new_shop_id;
  insert into public.barber_memberships (business_id, user_id, role)
    values (new_shop_id, new.id, 'OWNER');
  return new;
end;
$$;

drop trigger if exists create_barber_shop_after_signup on auth.users;
create trigger create_barber_shop_after_signup
  after insert on auth.users
  for each row execute procedure public.create_barber_shop_for_new_user();

drop function if exists public.create_barber_sale(uuid, text, numeric, text, numeric, text);
drop function if exists public.create_barber_sale(uuid, text, uuid, integer, numeric, numeric, text, numeric, text);

create or replace function public.create_barber_sale(
  p_business_id uuid,
  p_item_type text,
  p_item_id uuid,
  p_quantity integer,
  p_discount numeric,
  p_tip numeric,
  p_payment_method text,
  p_commission_rate numeric,
  p_barber_name text default '',
  p_appointment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_sale_id uuid;
  current_item_name text;
  current_item_price numeric(12,2);
  current_stock integer;
  open_cash_session_id uuid;
  sale_subtotal numeric(12,2);
  sale_total numeric(12,2);
  linked_appointment public.barber_appointments%rowtype;
begin
  if not public.is_barber_member(p_business_id) then
    raise exception 'No tienes acceso a esta barbería';
  end if;
  if p_quantity <= 0 or p_commission_rate < 0 or p_commission_rate > 100
     or p_discount < 0 or p_tip < 0 then
    raise exception 'La cantidad, el descuento, la propina o la comisión no son válidos';
  end if;
  if p_payment_method not in ('cash','card','transfer') then
    raise exception 'Método de pago no válido';
  end if;
  if p_item_type = 'service' then
    select name, price into current_item_name, current_item_price
      from public.barber_services
      where id = p_item_id and business_id = p_business_id and active;
    if not found then
      raise exception 'El servicio no existe o está inactivo';
    end if;
  elsif p_item_type = 'product' then
    select name, price, stock into current_item_name, current_item_price, current_stock
      from public.barber_products
      where id = p_item_id and business_id = p_business_id and active
      for update;
    if not found then
      raise exception 'El producto no existe o está inactivo';
    end if;
    if current_stock < p_quantity then
      raise exception 'No hay existencias suficientes para completar la venta';
    end if;
    update public.barber_products
      set stock = stock - p_quantity
      where id = p_item_id and business_id = p_business_id;
  else
    raise exception 'Selecciona un servicio o producto válido';
  end if;
  if p_appointment_id is not null then
    select * into linked_appointment
      from public.barber_appointments
      where id = p_appointment_id and business_id = p_business_id
        and status in ('PENDING','CONFIRMED')
      for update;
    if not found then
      raise exception 'La cita no existe o ya fue atendida';
    end if;
    if p_item_type <> 'service' or p_quantity <> 1
       or current_item_name <> linked_appointment.service_name then
      raise exception 'La venta debe incluir el servicio reservado y una cantidad';
    end if;
    current_item_name := linked_appointment.service_name;
    current_item_price := linked_appointment.price;
  end if;
  sale_subtotal := current_item_price * p_quantity;
  if p_discount > sale_subtotal then
    raise exception 'El descuento no puede superar el subtotal';
  end if;
  sale_total := sale_subtotal - p_discount + p_tip;
  if sale_total <= 0 then
    raise exception 'El total de la venta debe ser mayor a cero';
  end if;
  if p_payment_method = 'cash' then
    select id into open_cash_session_id
      from public.barber_cash_sessions
      where business_id = p_business_id and closed_at is null
      for update;
    if not found then
      raise exception 'Abre la caja antes de registrar un cobro en efectivo';
    end if;
  end if;
  insert into public.barber_sales (
    business_id, appointment_id, description, item_name, quantity, subtotal, discount, tip, total,
    payment_method, barber_name, commission_rate, commission_amount
  ) values (
    p_business_id, p_appointment_id, current_item_name, current_item_name, p_quantity,
    sale_subtotal, p_discount, p_tip, sale_total, p_payment_method,
    coalesce(p_barber_name, ''), p_commission_rate,
    round((sale_subtotal - p_discount) * p_commission_rate / 100, 2)
  ) returning id into new_sale_id;
  insert into public.barber_sale_items (
    business_id, sale_id, item_name, item_type, quantity, unit_price, line_total
  ) values (
    p_business_id, new_sale_id, current_item_name, p_item_type, p_quantity,
    current_item_price, sale_subtotal
  );
  if p_appointment_id is not null then
    update public.barber_appointments
      set status = 'COMPLETED'
      where id = p_appointment_id and business_id = p_business_id;
  end if;
  return new_sale_id;
end;
$$;

grant execute on function public.create_barber_sale(uuid, text, uuid, integer, numeric, numeric, text, numeric, text, uuid) to authenticated;
grant execute on function public.is_barber_member(uuid) to authenticated;

alter table public.barber_shops enable row level security;
alter table public.barber_memberships enable row level security;
alter table public.barber_services enable row level security;
alter table public.barber_products enable row level security;
alter table public.barber_clients enable row level security;
alter table public.barber_staff enable row level security;
alter table public.barber_appointments enable row level security;
alter table public.barber_expenses enable row level security;
alter table public.barber_cash_sessions enable row level security;
alter table public.barber_sales enable row level security;
alter table public.barber_sale_items enable row level security;

drop policy if exists "Members can read their barber shops" on public.barber_shops;
create policy "Members can read their barber shops" on public.barber_shops for select to authenticated
  using (public.is_barber_member(id));
drop policy if exists "Owners can update their barber shops" on public.barber_shops;
create policy "Owners can update their barber shops" on public.barber_shops for update to authenticated
  using (exists (select 1 from public.barber_memberships m where m.business_id = barber_shops.id and m.user_id = auth.uid() and m.role = 'OWNER'))
  with check (exists (select 1 from public.barber_memberships m where m.business_id = barber_shops.id and m.user_id = auth.uid() and m.role = 'OWNER'));
drop policy if exists "Users can read their memberships" on public.barber_memberships;
create policy "Users can read their memberships" on public.barber_memberships for select to authenticated
  using (user_id = auth.uid());

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'barber_services','barber_products','barber_clients','barber_staff',
    'barber_appointments','barber_expenses','barber_cash_sessions'
  ] loop
    execute format('drop policy if exists "Members can read %1$s" on public.%1$s', table_name);
    execute format('create policy "Members can read %1$s" on public.%1$s for select to authenticated using (public.is_barber_member(business_id))', table_name);
    execute format('drop policy if exists "Members can insert %1$s" on public.%1$s', table_name);
    execute format('create policy "Members can insert %1$s" on public.%1$s for insert to authenticated with check (public.is_barber_member(business_id))', table_name);
    execute format('drop policy if exists "Members can update %1$s" on public.%1$s', table_name);
    execute format('create policy "Members can update %1$s" on public.%1$s for update to authenticated using (public.is_barber_member(business_id)) with check (public.is_barber_member(business_id))', table_name);
  end loop;
end;
$$;

drop policy if exists "Members can read barber_sales" on public.barber_sales;
create policy "Members can read barber_sales" on public.barber_sales for select to authenticated
  using (public.is_barber_member(business_id));
drop policy if exists "Members can read barber_sale_items" on public.barber_sale_items;
create policy "Members can read barber_sale_items" on public.barber_sale_items for select to authenticated
  using (public.is_barber_member(business_id));
