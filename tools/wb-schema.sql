-- ============================================================
-- 대왕고래 양동이 온라인 진행 — 스키마 v1
-- ============================================================

create table if not exists wb_games (
  id          uuid primary key default gen_random_uuid(),
  host_token  text not null,
  script_name text not null default '',
  stage_no    int  not null default 0,      -- 0=대기 1=악마 2=하수인 3=외지인 4=마을주민
  stage_team  text,
  revealed    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists wb_players (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references wb_games(id) on delete cascade,
  player_token text not null,
  name         text not null default '',
  team         text,
  char_id      text,
  char_name    text,
  char_ability text,
  char_image   text,
  joined_at    timestamptz not null default now(),
  unique (game_id, player_token)
);

create table if not exists wb_tasks (
  id        uuid primary key default gen_random_uuid(),
  game_id   uuid not null references wb_games(id) on delete cascade,
  player_id uuid not null references wb_players(id) on delete cascade,
  stage_no  int  not null,
  team      text not null,
  is_real   boolean not null,
  targets   jsonb not null default '[]'::jsonb,
  picks     jsonb not null default '[]'::jsonb,
  submitted boolean not null default false,
  unique (game_id, player_id, stage_no)
);

create index if not exists wb_players_game_idx    on wb_players(game_id);
create index if not exists wb_tasks_game_stage_idx on wb_tasks(game_id, stage_no);
create index if not exists wb_games_created_idx    on wb_games(created_at);

alter table wb_games   enable row level security;
alter table wb_players enable row level security;
alter table wb_tasks   enable row level security;

revoke all on wb_games   from anon, authenticated;
revoke all on wb_players from anon, authenticated;
revoke all on wb_tasks   from anon, authenticated;

-- ── 창구 1: 게임 만들기 (이야기꾼) ──────────────────────────
create or replace function wb_create(p_host_token text, p_script_name text)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_id uuid;
begin
  if coalesce(p_host_token,'') = '' then raise exception '호스트 열쇠가 없습니다'; end if;
  insert into wb_games(host_token, script_name)
  values (p_host_token, coalesce(p_script_name,'')) returning id into v_id;
  return v_id;
end; $fn$;

-- ── 창구 2: 참가 등록 (참가자) ──────────────────────────────
create or replace function wb_join(p_game_id uuid, p_player_token text, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_game wb_games; v_id uuid;
begin
  select * into v_game from wb_games where id = p_game_id;
  if not found then raise exception '게임을 찾을 수 없습니다'; end if;
  select id into v_id from wb_players
   where game_id = p_game_id and player_token = p_player_token;
  if v_id is null then
    if v_game.stage_no > 0 then raise exception '이미 시작된 게임입니다'; end if;
    insert into wb_players(game_id, player_token, name)
    values (p_game_id, p_player_token, left(coalesce(p_name,''),20))
    returning id into v_id;
  else
    update wb_players set name = left(coalesce(p_name,''),20) where id = v_id;
  end if;
  return jsonb_build_object('player_id', v_id);
end; $fn$;

-- ── 창구 3: 전체 현황 (이야기꾼 전용) ───────────────────────
create or replace function wb_host_state(p_game_id uuid, p_host_token text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_game wb_games; v_players jsonb;
begin
  select * into v_game from wb_games where id = p_game_id and host_token = p_host_token;
  if not found then raise exception '권한이 없습니다'; end if;
  select coalesce(jsonb_agg(s.x order by s.j), '[]'::jsonb) into v_players
  from (
    select p.joined_at as j, jsonb_build_object(
      'player_id', p.id, 'name', p.name, 'team', p.team,
      'char_id', p.char_id, 'char_name', p.char_name, 'char_image', p.char_image,
      'picks',     coalesce(t.picks, '[]'::jsonb),
      'is_real',   coalesce(t.is_real, false),
      'submitted', coalesce(t.submitted, false)
    ) as x
    from wb_players p
    left join wb_tasks t on t.player_id = p.id and t.stage_no = v_game.stage_no
    where p.game_id = p_game_id
  ) s;
  return jsonb_build_object(
    'stage_no', v_game.stage_no, 'stage_team', v_game.stage_team,
    'revealed', v_game.revealed, 'players', v_players);
end; $fn$;

-- ── 창구 4: 내 화면 (참가자, 본인 것만) ─────────────────────
create or replace function wb_player_state(p_game_id uuid, p_player_token text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_game wb_games; v_p wb_players; v_t wb_tasks; v_res jsonb;
begin
  select * into v_game from wb_games where id = p_game_id;
  if not found then raise exception '게임을 찾을 수 없습니다'; end if;
  select * into v_p from wb_players
   where game_id = p_game_id and player_token = p_player_token;
  if not found then
    return jsonb_build_object('joined', false, 'stage_no', v_game.stage_no);
  end if;
  select * into v_t from wb_tasks
   where player_id = v_p.id and stage_no = v_game.stage_no;
  v_res := jsonb_build_object(
    'joined', true, 'name', v_p.name,
    'stage_no', v_game.stage_no, 'revealed', v_game.revealed,
    'task', case when v_t.id is null then null else jsonb_build_object(
      'team', v_t.team, 'is_real', v_t.is_real, 'targets', v_t.targets,
      'picks', v_t.picks, 'submitted', v_t.submitted) end);
  if v_game.revealed then
    v_res := v_res || jsonb_build_object('character', jsonb_build_object(
      'id', v_p.char_id, 'name', v_p.char_name,
      'ability', v_p.char_ability, 'image', v_p.char_image));
  end if;
  return v_res;
end; $fn$;

-- ── 창구 5: 단계 시작 = 유형 랜덤 배정 + 과제 배포 ──────────
create or replace function wb_start_stage(
  p_game_id uuid, p_host_token text,
  p_stage_no int, p_team text, p_count int, p_pool jsonb)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_game wb_games; v_free int;
begin
  select * into v_game from wb_games where id = p_game_id and host_token = p_host_token;
  if not found then raise exception '권한이 없습니다'; end if;
  if v_game.revealed then raise exception '이미 공개된 게임입니다'; end if;
  if p_count < 0 then raise exception '인원수가 올바르지 않습니다'; end if;
  if jsonb_array_length(coalesce(p_pool,'[]'::jsonb)) < 3 then
    raise exception '후보 목록이 3개 미만입니다'; end if;
  select count(*) into v_free from wb_players where game_id = p_game_id and team is null;
  if p_count > v_free then
    raise exception '유형이 없는 참가자는 %명뿐입니다', v_free; end if;

  update wb_players set team = p_team where id in (
    select id from wb_players where game_id = p_game_id and team is null
     order by random() limit p_count);

  delete from wb_tasks where game_id = p_game_id and stage_no = p_stage_no;

  insert into wb_tasks(game_id, player_id, stage_no, team, is_real, targets)
  select p_game_id, p.id, p_stage_no, p_team,
         coalesce(p.team = p_team, false),
         case when coalesce(p.team = p_team, false) then '[]'::jsonb
         else (select coalesce(jsonb_agg(q.v), '[]'::jsonb) from (
                 select value as v from jsonb_array_elements(p_pool)
                 order by md5(p.id::text || p_stage_no::text || (value #>> '{}'))
                 limit 3) q)
         end
  from wb_players p where p.game_id = p_game_id;

  update wb_games set stage_no = p_stage_no, stage_team = p_team where id = p_game_id;
  return jsonb_build_object('ok', true, 'assigned', p_count);
end; $fn$;

-- ── 창구 6: 지망 제출 (참가자) ──────────────────────────────
create or replace function wb_submit(p_game_id uuid, p_player_token text, p_picks jsonb)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_game wb_games; v_p wb_players;
begin
  select * into v_game from wb_games where id = p_game_id;
  if not found then raise exception '게임을 찾을 수 없습니다'; end if;
  select * into v_p from wb_players
   where game_id = p_game_id and player_token = p_player_token;
  if not found then raise exception '참가자를 찾을 수 없습니다'; end if;
  if jsonb_array_length(coalesce(p_picks,'[]'::jsonb)) <> 3 then
    raise exception '3개를 골라야 합니다'; end if;
  update wb_tasks set picks = p_picks, submitted = true
   where game_id = p_game_id and player_id = v_p.id and stage_no = v_game.stage_no;
  if not found then raise exception '지금은 제출할 수 없습니다'; end if;
  return jsonb_build_object('ok', true);
end; $fn$;

-- ── 창구 7: 캐릭터 확정 (이야기꾼) ──────────────────────────
create or replace function wb_assign(
  p_game_id uuid, p_host_token text, p_player_id uuid, p_char jsonb)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_game wb_games;
begin
  select * into v_game from wb_games where id = p_game_id and host_token = p_host_token;
  if not found then raise exception '권한이 없습니다'; end if;
  if coalesce(p_char->>'id','') = '' then raise exception '캐릭터 정보가 없습니다'; end if;
  update wb_players set
    char_id      = p_char->>'id',
    char_name    = coalesce(p_char->>'name',''),
    char_ability = coalesce(p_char->>'ability',''),
    char_image   = coalesce(p_char->>'image','')
  where id = p_player_id and game_id = p_game_id;
  if not found then raise exception '참가자를 찾을 수 없습니다'; end if;
  return jsonb_build_object('ok', true);
end; $fn$;

-- ── 창구 8: 일괄 공개 (이야기꾼) ────────────────────────────
create or replace function wb_reveal(p_game_id uuid, p_host_token text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_game wb_games; v_missing int;
begin
  select * into v_game from wb_games where id = p_game_id and host_token = p_host_token;
  if not found then raise exception '권한이 없습니다'; end if;
  select count(*) into v_missing from wb_players
   where game_id = p_game_id and coalesce(char_id,'') = '';
  if v_missing > 0 then
    raise exception '아직 캐릭터가 정해지지 않은 참가자가 %명 있습니다', v_missing; end if;
  update wb_games set revealed = true where id = p_game_id;
  return jsonb_build_object('ok', true);
end; $fn$;

-- ── 청소부: 하루 지난 게임 삭제 ─────────────────────────────
create or replace function wb_cleanup()
returns void language sql security definer set search_path = public as $fn$
  delete from wb_games where created_at < now() - interval '1 day';
$fn$;

grant execute on function wb_create(text,text)                                to anon;
grant execute on function wb_join(uuid,text,text)                             to anon;
grant execute on function wb_host_state(uuid,text)                            to anon;
grant execute on function wb_player_state(uuid,text)                          to anon;
grant execute on function wb_start_stage(uuid,text,int,text,int,jsonb)        to anon;
grant execute on function wb_submit(uuid,text,jsonb)                          to anon;
grant execute on function wb_assign(uuid,text,uuid,jsonb)                     to anon;
grant execute on function wb_reveal(uuid,text)                                to anon;
