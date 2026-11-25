-- travel-guide-app 초기 스키마
-- 접근은 서버(secret key)에서만 한다. 브라우저 직접 접근을 막기 위해 RLS를 켜고 정책은 만들지 않는다.

create table public.plans (
  id             uuid primary key default gen_random_uuid(),
  title          text not null default '새 여행',
  destination    text not null,
  start_date     date not null,
  end_date       date not null,
  status         text not null default 'generating'
                 check (status in ('generating', 'ready', 'failed')),
  progress_step  text
                 check (progress_step in ('offers', 'itinerary', 'places')),
  input          jsonb not null,
  offers         jsonb,
  itinerary      jsonb,
  error          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint plans_dates_check check (end_date >= start_date)
);

create index plans_created_at_idx on public.plans (created_at desc);

create table public.plan_messages (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.plans (id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);

create index plan_messages_plan_id_idx on public.plan_messages (plan_id, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger plans_set_updated_at
before update on public.plans
for each row execute function public.set_updated_at();

alter table public.plans enable row level security;
alter table public.plan_messages enable row level security;
