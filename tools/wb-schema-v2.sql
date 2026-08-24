-- ============================================================
-- 대왕고래 양동이 — 스키마 v2 (후보 목록 보관)
-- v1 위에 덧씌운다. 기존 데이터는 건드리지 않는다.
-- ============================================================

alter table wb_games add column if not exists pools jsonb not null default '{}'::jsonb;

-- ── 창구 1 개정: 방 만들 때 후보 목록도 함께 받는다 ─────────
create or replace function wb_create(
  p_host_token text, p_script_name text, p_pools jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_id uuid;
begin
  if coalesce(p_host_token,'') = '' then raise exception '호스트 열쇠가 없습니다'; end if;
  insert into wb_games(host_token, script_name, pools)
  values (p_host_token, coalesce(p_script_name,''), coalesce(p_pools,'{}'::jsonb))
  returning id into v_id;
  return v_id;
end; $fn$;

-- ── 창구 5 개정: 후보 목록을 서버가 알아서 꺼내 쓴다 ────────
create or replace function wb_start_stage(
  p_game_id uuid, p_host_token text,
  p_stage_no int, p_team text, p_count int)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_game wb_games; v_free int; v_ids jsonb;
begin
  select * into v_game from wb_games where id = p_game_id and host_token = p_host_token;
  if not found then raise exception '권한이 없습니다'; end if;
  if v_game.revealed then raise exception '이미 공개된 게임입니다'; end if;
  if p_count < 0 then raise exception '인원수가 올바르지 않습니다'; end if;

  select coalesce(jsonb_agg(entry->>'id'), '[]'::jsonb) into v_ids
    from jsonb_array_elements(coalesce(v_game.pools->p_team, '[]'::jsonb)) as entry;

  if jsonb_array_length(v_ids) < 3 then
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
                 select value as v from jsonb_array_elements(v_ids)
                 order by md5(p.id::text || p_stage_no::text || (value #>> '{}'))
                 limit 3) q)
         end
  from wb_players p where p.game_id = p_game_id;

  update wb_games set stage_no = p_stage_no, stage_team = p_team where id = p_game_id;
  return jsonb_build_object('ok', true, 'assigned', p_count);
end; $fn$;

-- ── 창구 4 개정: 이번 단계의 후보 목록을 함께 돌려준다 ──────
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

  -- 이번 단계의 목록만 내려보낸다. 다른 유형의 목록은 주지 않는다.
  if v_t.id is not null then
    v_res := v_res || jsonb_build_object(
      'pool', coalesce(v_game.pools->v_t.team, '[]'::jsonb));
  end if;

  if v_game.revealed then
    v_res := v_res || jsonb_build_object('character', jsonb_build_object(
      'id', v_p.char_id, 'name', v_p.char_name,
      'ability', v_p.char_ability, 'image', v_p.char_image));
  end if;

  return v_res;
end; $fn$;

drop function if exists wb_start_stage(uuid,text,int,text,int,jsonb);
drop function if exists wb_create(text,text);

grant execute on function wb_create(text,text,jsonb)          to anon;
grant execute on function wb_start_stage(uuid,text,int,text,int) to anon;
grant execute on function wb_player_state(uuid,text)          to anon;
