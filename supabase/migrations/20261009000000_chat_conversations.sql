-- Run once in Supabase SQL Editor to create isolated, per-user chat storage.
create table if not exists public.chat_conversations (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  product text not null check (product in ('engine', 'dev')),
  title text not null default 'New chat',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_conversations_user_updated_idx
  on public.chat_conversations (user_id, updated_at desc);

alter table public.chat_conversations enable row level security;
revoke all on table public.chat_conversations from anon;
grant select, insert, update, delete on table public.chat_conversations to authenticated;

drop policy if exists "Users can read their own chats" on public.chat_conversations;
create policy "Users can read their own chats"
  on public.chat_conversations for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own chats" on public.chat_conversations;
create policy "Users can create their own chats"
  on public.chat_conversations for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own chats" on public.chat_conversations;
create policy "Users can update their own chats"
  on public.chat_conversations for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own chats" on public.chat_conversations;
create policy "Users can delete their own chats"
  on public.chat_conversations for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Private object storage for generated TexDEV downloads. The server uses the Supabase secret key.
insert into storage.buckets (id, name, public)
values ('texdev-artifacts', 'texdev-artifacts', false)
on conflict (id) do nothing;
