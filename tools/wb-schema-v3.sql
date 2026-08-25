-- ============================================================
-- 대왕고래 양동이 — 스키마 v3 (제출 단계 검사)
-- v2 위에 덧씌운다. 기존 데이터는 건드리지 않는다.
-- ============================================================

-- ── 창구 6 개정: 어느 단계의 제출인지 확인한다 ──────────────
create or replace function wb_submit(
  p_game_id uuid, p_player_token text, p_picks jsonb,
  p_stage_no int default null)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_game wb_games; v_p wb_players;
begin
  select * into v_game from wb_games where id = p_game_id;
  if not found then raise exception '게임을 찾을 수 없습니다'; end if;

  -- 화면이 바뀌는 찰나에 도착한 제출이 엉뚱한 단계에 기록되는 것을 막는다.
  if p_stage_no is not null and p_stage_no <> v_game.stage_no then
    raise exception '단계가 바뀌었습니다';
  end if;

  select * into v_p from wb_players
   where game_id = p_game_id and player_token = p_player_token;
  if not found then raise exception '참가자를 찾을 수 없습니다'; end if;

  if jsonb_array_length(coalesce(p_picks,'[]'::jsonb)) <> 3 then
    raise exception '3개를 골라야 합니다'; end if;

  update wb_tasks set picks = p_picks, submitted = true
   where game_id = p_game_id and player_id = v_p.id
     and stage_no = v_game.stage_no and submitted = false;

  if not found then raise exception '지금은 제출할 수 없습니다'; end if;

  return jsonb_build_object('ok', true);
end; $fn$;

drop function if exists wb_submit(uuid,text,jsonb);

grant execute on function wb_submit(uuid,text,jsonb,int) to anon;
