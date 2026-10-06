create extension if not exists pgcrypto;

create type public.user_role as enum ('owner', 'manager', 'cashier', 'waiter', 'kitchen');
create type public.order_status as enum ('new', 'preparing', 'ready', 'served', 'cancelled', 'refunded');
create type public.order_type as enum ('dine_in', 'takeaway', 'delivery', 'qr');
create type public.payment_method as enum ('cash', 'card', 'bkash', 'nagad', 'other');
create type public.shift_status as enum ('open', 'closed');

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name public.user_role unique not null,
  label text not null,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  label text not null
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.employees (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'cashier',
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text,
  image_url text,
  price numeric(12,2) not null check (price >= 0),
  cost numeric(12,2) not null default 0 check (cost >= 0),
  available boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null check (unit in ('kg', 'liter', 'piece', 'case')),
  quantity numeric(14,3) not null default 0,
  minimum_quantity numeric(14,3) not null default 0,
  unit_cost numeric(12,4) not null default 0,
  supplier_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipes (
  product_id uuid not null references public.products(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantity numeric(14,4) not null check (quantity > 0),
  primary key (product_id, ingredient_id)
);

create table public.modifiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(12,2) not null default 0,
  active boolean not null default true
);

create table public.product_modifiers (
  product_id uuid not null references public.products(id) on delete cascade,
  modifier_id uuid not null references public.modifiers(id) on delete cascade,
  primary key (product_id, modifier_id)
);

create table public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  table_number text unique not null,
  seats integer not null default 2,
  status text not null default 'available',
  qr_token text unique not null default encode(gen_random_bytes(12), 'hex'),
  created_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete set null,
  invoice_number text,
  purchase_date date not null default current_date,
  due_date date,
  total numeric(12,2) not null default 0,
  paid numeric(12,2) not null default 0,
  notes text,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_cost numeric(12,4) not null check (unit_cost >= 0)
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete set null,
  shift_date date not null default current_date,
  status public.shift_status not null default 'open',
  opening_cash numeric(12,2) not null default 0,
  expected_cash numeric(12,2) not null default 0,
  closing_cash numeric(12,2),
  difference numeric(12,2),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  table_id uuid references public.restaurant_tables(id) on delete set null,
  shift_id uuid references public.shifts(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  order_type public.order_type not null default 'dine_in',
  status public.order_status not null default 'new',
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  ordered_at timestamptz not null default now(),
  served_at timestamptz,
  cancelled_at timestamptz
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  unit_cost numeric(12,2) not null default 0,
  notes text
);

create table public.order_item_modifiers (
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  modifier_id uuid not null references public.modifiers(id) on delete restrict,
  price numeric(12,2) not null default 0,
  primary key (order_item_id, modifier_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete set null,
  method public.payment_method not null,
  amount numeric(12,2) not null check (amount >= 0),
  received numeric(12,2),
  change_amount numeric(12,2) not null default 0,
  paid_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid references public.shifts(id) on delete set null,
  title text not null,
  category text not null,
  amount numeric(12,2) not null check (amount >= 0),
  expense_date date not null default current_date,
  notes text,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index orders_ordered_at_idx on public.orders(ordered_at);
create index orders_shift_id_idx on public.orders(shift_id);
create index payments_paid_at_idx on public.payments(paid_at);
create index expenses_expense_date_idx on public.expenses(expense_date);
create index audit_logs_created_at_idx on public.audit_logs(created_at);

alter table public.employees enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.products enable row level security;
alter table public.categories enable row level security;
alter table public.ingredients enable row level security;
alter table public.recipes enable row level security;
alter table public.modifiers enable row level security;
alter table public.product_modifiers enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.suppliers enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_modifiers enable row level security;
alter table public.payments enable row level security;
alter table public.shifts enable row level security;
alter table public.expenses enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.current_employee_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select e.role
  from public.employees e
  where e.id = (select auth.uid())
    and e.active = true
$$;

revoke all on function public.current_employee_role() from public;
grant execute on function public.current_employee_role() to authenticated;

drop policy if exists "authenticated users can read products" on public.products;
drop policy if exists "authenticated users can read categories" on public.categories;
drop policy if exists "authenticated users can read ingredients" on public.ingredients;
drop policy if exists "authenticated users can read orders" on public.orders;
drop policy if exists "authenticated users can create orders" on public.orders;
drop policy if exists "authenticated users can update orders" on public.orders;
drop policy if exists "authenticated users can read order items" on public.order_items;
drop policy if exists "authenticated users can create order items" on public.order_items;
drop policy if exists "authenticated users can read payments" on public.payments;
drop policy if exists "authenticated users can create payments" on public.payments;
drop policy if exists "authenticated users can read shifts" on public.shifts;
drop policy if exists "authenticated users can create shifts" on public.shifts;
drop policy if exists "authenticated users can update shifts" on public.shifts;
drop policy if exists "authenticated users can read expenses" on public.expenses;
drop policy if exists "authenticated users can create expenses" on public.expenses;

create policy "employees read own profile or managers read all"
  on public.employees for select to authenticated
  using (id = (select auth.uid()) or (select public.current_employee_role()) in ('owner', 'manager'));

create policy "authenticated employees read roles" on public.roles
  for select to authenticated using ((select public.current_employee_role()) is not null);
create policy "authenticated employees read permissions" on public.permissions
  for select to authenticated using ((select public.current_employee_role()) is not null);
create policy "authenticated employees read role permissions" on public.role_permissions
  for select to authenticated using ((select public.current_employee_role()) is not null);
create policy "managers manage roles" on public.roles
  for all to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'))
  with check ((select public.current_employee_role()) in ('owner', 'manager'));
create policy "managers manage permissions" on public.permissions
  for all to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'))
  with check ((select public.current_employee_role()) in ('owner', 'manager'));
create policy "managers manage role permissions" on public.role_permissions
  for all to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'))
  with check ((select public.current_employee_role()) in ('owner', 'manager'));

create policy "authenticated employees read products" on public.products
  for select to authenticated using ((select public.current_employee_role()) is not null);
create policy "managers manage products" on public.products
  for all to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'))
  with check ((select public.current_employee_role()) in ('owner', 'manager'));

create policy "authenticated employees read categories" on public.categories
  for select to authenticated using ((select public.current_employee_role()) is not null);
create policy "managers manage categories" on public.categories
  for all to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'))
  with check ((select public.current_employee_role()) in ('owner', 'manager'));

create policy "authenticated employees read ingredients" on public.ingredients
  for select to authenticated using ((select public.current_employee_role()) is not null);
create policy "managers manage ingredients" on public.ingredients
  for all to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'))
  with check ((select public.current_employee_role()) in ('owner', 'manager'));

create policy "authenticated employees read recipes" on public.recipes
  for select to authenticated using ((select public.current_employee_role()) is not null);
create policy "managers manage recipes" on public.recipes
  for all to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'))
  with check ((select public.current_employee_role()) in ('owner', 'manager'));

create policy "authenticated employees read modifiers" on public.modifiers
  for select to authenticated using ((select public.current_employee_role()) is not null);
create policy "managers manage modifiers" on public.modifiers
  for all to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'))
  with check ((select public.current_employee_role()) in ('owner', 'manager'));

create policy "authenticated employees read product modifiers" on public.product_modifiers
  for select to authenticated using ((select public.current_employee_role()) is not null);
create policy "managers manage product modifiers" on public.product_modifiers
  for all to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'))
  with check ((select public.current_employee_role()) in ('owner', 'manager'));

create policy "authenticated employees read restaurant tables" on public.restaurant_tables
  for select to authenticated using ((select public.current_employee_role()) is not null);
create policy "managers manage restaurant tables" on public.restaurant_tables
  for all to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'))
  with check ((select public.current_employee_role()) in ('owner', 'manager'));

create policy "managers manage suppliers" on public.suppliers
  for all to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'))
  with check ((select public.current_employee_role()) in ('owner', 'manager'));

create policy "authenticated employees manage customers" on public.customers
  for all to authenticated using ((select public.current_employee_role()) is not null)
  with check ((select public.current_employee_role()) is not null);

create policy "employees read own orders or managers read all" on public.orders
  for select to authenticated
  using (employee_id = (select auth.uid()) or (select public.current_employee_role()) in ('owner', 'manager'));
create policy "employees create own orders" on public.orders
  for insert to authenticated with check (
    employee_id = (select auth.uid())
    and (select public.current_employee_role()) is not null
  );
create policy "managers update orders" on public.orders
  for update to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'))
  with check ((select public.current_employee_role()) in ('owner', 'manager'));
create policy "managers delete orders" on public.orders
  for delete to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'));

create policy "employees read visible order items" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id)
  );
create policy "employees insert own order items" on public.order_items
  for insert to authenticated with check (
    exists (select 1 from public.orders o where o.id = order_id and o.employee_id = (select auth.uid()))
  );
create policy "managers update order items" on public.order_items
  for update to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'))
  with check ((select public.current_employee_role()) in ('owner', 'manager'));
create policy "managers delete order items" on public.order_items
  for delete to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'));

create policy "employees read modifiers for visible order items" on public.order_item_modifiers
  for select to authenticated using (
    exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_id
    )
  );
create policy "employees add modifiers to own order items" on public.order_item_modifiers
  for insert to authenticated with check (
    exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_id and o.employee_id = (select auth.uid())
    )
  );
create policy "managers manage order item modifiers" on public.order_item_modifiers
  for all to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'))
  with check ((select public.current_employee_role()) in ('owner', 'manager'));

create policy "employees read payments for visible orders" on public.payments
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id)
  );
create policy "employees create payments for own orders" on public.payments
  for insert to authenticated with check (
    exists (select 1 from public.orders o where o.id = order_id and o.employee_id = (select auth.uid()))
  );
create policy "managers update payments" on public.payments
  for update to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'))
  with check ((select public.current_employee_role()) in ('owner', 'manager'));
create policy "managers delete payments" on public.payments
  for delete to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'));

create policy "employees read own shifts or managers read all" on public.shifts
  for select to authenticated
  using (employee_id = (select auth.uid()) or (select public.current_employee_role()) in ('owner', 'manager'));
create policy "employees create own shifts" on public.shifts
  for insert to authenticated with check (employee_id = (select auth.uid()));
create policy "managers update shifts" on public.shifts
  for update to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'))
  with check ((select public.current_employee_role()) in ('owner', 'manager'));
create policy "managers delete shifts" on public.shifts
  for delete to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'));

create policy "managers read expenses" on public.expenses
  for select to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'));
create policy "managers create expenses" on public.expenses
  for insert to authenticated with check ((select public.current_employee_role()) in ('owner', 'manager'));
create policy "managers update expenses" on public.expenses
  for update to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'))
  with check ((select public.current_employee_role()) in ('owner', 'manager'));
create policy "managers delete expenses" on public.expenses
  for delete to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'));

create policy "managers access purchases" on public.purchases
  for all to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'))
  with check ((select public.current_employee_role()) in ('owner', 'manager'));
create policy "managers access purchase items" on public.purchase_items
  for all to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'))
  with check ((select public.current_employee_role()) in ('owner', 'manager'));

create policy "managers read audit logs" on public.audit_logs
  for select to authenticated using ((select public.current_employee_role()) in ('owner', 'manager'));
create policy "managers append audit logs" on public.audit_logs
  for insert to authenticated with check (
    employee_id = (select auth.uid())
    and (select public.current_employee_role()) in ('owner', 'manager')
  );
