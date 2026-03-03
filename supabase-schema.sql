-- 처리 완료된 상담 기록
create table if not exists processed_chats (
  id serial primary key,
  user_chat_id text unique not null,
  closed_at bigint not null,
  salesmap_record_id text not null,
  processed_at timestamptz default now()
);

-- 워크스페이스 매핑 (세일즈맵 recordId ↔ 채널톡 workspaceId)
create table if not exists workspace_map (
  id serial primary key,
  record_id text unique not null,
  workspace_id text unique not null
);

-- 세일즈맵 사용자 매핑
create table if not exists user_map (
  id serial primary key,
  user_id text unique not null,
  name text not null
);

-- 인덱스
create index if not exists idx_processed_chats_user_chat_id on processed_chats(user_chat_id);
create index if not exists idx_workspace_map_workspace_id on workspace_map(workspace_id);
create index if not exists idx_user_map_name on user_map(name);
