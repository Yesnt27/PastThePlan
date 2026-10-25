/** Idempotent schema. RLS is on with no policies: only the server (postgres role) reads or writes. */
export const SCHEMA = `
create table if not exists fgl_groups (
  id text primary key,
  name text not null,
  invite_code text unique,
  created_at timestamptz not null default now()
);
create table if not exists fgl_people (
  group_id text not null references fgl_groups(id) on delete cascade,
  id text not null,
  name text not null,
  piece text not null,
  discord_id text,
  consent_chat boolean not null default false,
  profile jsonb not null default '{}',
  sort int not null default 0,
  primary key (group_id, id)
);
create table if not exists fgl_areas (
  group_id text not null references fgl_groups(id) on delete cascade,
  id text not null,
  label text not null,
  tint text not null,
  primary key (group_id, id)
);
create table if not exists fgl_lore (
  group_id text not null references fgl_groups(id) on delete cascade,
  id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (group_id, id)
);
create table if not exists fgl_plans (
  group_id text not null references fgl_groups(id) on delete cascade,
  id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (group_id, id)
);
create table if not exists fgl_messages (
  id bigserial primary key,
  group_id text not null references fgl_groups(id) on delete cascade,
  thread text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create unique index if not exists fgl_messages_uniq on fgl_messages (group_id, thread, (data->>'id'));
create table if not exists fgl_vault (
  group_id text not null references fgl_groups(id) on delete cascade,
  person text not null,
  field text not null,
  ciphertext text not null,
  iv text not null,
  tag text not null,
  key_version int not null default 1,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (group_id, person, field)
);
create table if not exists fgl_kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists fgl_chat (
  id text primary key,
  group_id text not null references fgl_groups(id) on delete cascade,
  channel text not null,
  person text not null,
  ts timestamptz not null,
  text text not null
);
create table if not exists fgl_drafts (
  id text primary key,
  group_id text not null references fgl_groups(id) on delete cascade,
  kind text not null,
  payload jsonb not null,
  cites text[] not null default '{}',
  status text not null default 'new',
  created_at timestamptz not null default now()
);
alter table fgl_kv enable row level security;
alter table fgl_chat enable row level security;
alter table fgl_drafts enable row level security;
create table if not exists fgl_events (
  id bigserial primary key,
  group_id text not null,
  kind text not null,
  created_at timestamptz not null default now()
);
create index if not exists fgl_events_group on fgl_events (group_id, id);
alter table fgl_groups enable row level security;
alter table fgl_people enable row level security;
alter table fgl_areas enable row level security;
alter table fgl_lore enable row level security;
alter table fgl_plans enable row level security;
alter table fgl_messages enable row level security;
alter table fgl_vault enable row level security;
alter table fgl_events enable row level security;
`
