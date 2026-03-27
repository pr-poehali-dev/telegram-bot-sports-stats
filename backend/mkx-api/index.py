"""
API для дашборда MK X Stats Bot.
GET /?action=events — список последних событий
GET /?action=stats — статистика по тоталам и букмекерам
GET /?action=channels — список каналов
GET /?action=rounds&match_id=xxx — раунды конкретного матча
GET /?action=live — только live-матчи с раундами
POST /?action=channels — добавить канал
"""
import os
import json
import psycopg2
import psycopg2.extras

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p39733363_telegram_bot_sports_")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def ok(data):
    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(data, default=str),
    }


def err(msg, code=400):
    return {
        "statusCode": code,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps({"ok": False, "error": msg}),
    }


def get_events(conn, limit=50):
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        f"""SELECT id, match_id, player1, player2, bookmaker,
                   odds1, odds2, total, round1_winner, round2_winner, round3_winner,
                   rounds_total, total_result, match_winner, status,
                   live_round, p1_score, p2_score,
                   sent_to_telegram, created_at, updated_at
            FROM {SCHEMA}.mkx_events
            ORDER BY created_at DESC
            LIMIT %s""",
        (limit,)
    )
    rows = cur.fetchall()
    cur.close()
    return [dict(r) for r in rows]


def get_live_events(conn):
    """Возвращает live-матчи вместе с данными всех их раундов"""
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        f"""SELECT id, match_id, player1, player2, bookmaker,
                   odds1, odds2, total, round1_winner, round2_winner, round3_winner,
                   rounds_total, total_result, match_winner, status,
                   live_round, p1_score, p2_score,
                   sent_to_telegram, created_at, updated_at
            FROM {SCHEMA}.mkx_events
            WHERE status = 'live'
            ORDER BY created_at DESC"""
    )
    events = [dict(r) for r in cur.fetchall()]

    # Подгружаем раунды для каждого live-матча
    for ev in events:
        cur.execute(
            f"""SELECT round_num, winner, p1_health, p2_health,
                       finishing_move, duration_sec, status, created_at
                FROM {SCHEMA}.mkx_rounds
                WHERE match_id = %s
                ORDER BY round_num ASC""",
            (ev["match_id"],)
        )
        ev["rounds"] = [dict(r) for r in cur.fetchall()]

    cur.close()
    return events


def get_rounds_for_match(conn, match_id: str):
    """Раунды конкретного матча"""
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute(
        f"""SELECT id, match_id, player1, player2, bookmaker,
                   odds1, odds2, total, round1_winner, round2_winner, round3_winner,
                   rounds_total, total_result, match_winner, status,
                   live_round, p1_score, p2_score, created_at, updated_at
            FROM {SCHEMA}.mkx_events WHERE match_id = %s""",
        (match_id,)
    )
    row = cur.fetchone()
    if not row:
        cur.close()
        return None

    match = dict(row)

    cur.execute(
        f"""SELECT round_num, winner, p1_health, p2_health,
                   finishing_move, duration_sec, status, created_at, updated_at
            FROM {SCHEMA}.mkx_rounds
            WHERE match_id = %s
            ORDER BY round_num ASC""",
        (match_id,)
    )
    match["rounds"] = [dict(r) for r in cur.fetchall()]
    cur.close()
    return match


def get_stats(conn):
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute(
        f"""SELECT
            COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) AS matches_today,
            COUNT(*) FILTER (WHERE sent_to_telegram = TRUE AND DATE(created_at) = CURRENT_DATE) AS sent_today,
            COUNT(*) AS total_matches,
            COUNT(*) FILTER (WHERE status = 'live') AS live_count,
            ROUND(AVG(odds1)::numeric, 2) AS avg_odds1,
            ROUND(AVG(odds2)::numeric, 2) AS avg_odds2
            FROM {SCHEMA}.mkx_events"""
    )
    general = dict(cur.fetchone())

    cur.execute(
        f"""SELECT total,
            COUNT(*) FILTER (WHERE total_result = 'OVER') AS over_count,
            COUNT(*) FILTER (WHERE total_result = 'UNDER') AS under_count,
            COUNT(*) AS total_count
            FROM {SCHEMA}.mkx_events
            WHERE total_result IS NOT NULL
            GROUP BY total ORDER BY total"""
    )
    totals = [dict(r) for r in cur.fetchall()]

    cur.execute(
        f"""SELECT
            COUNT(*) FILTER (WHERE round1_winner = 'P1') AS r1_p1,
            COUNT(*) FILTER (WHERE round1_winner = 'P2') AS r1_p2,
            COUNT(*) FILTER (WHERE round2_winner = 'P1') AS r2_p1,
            COUNT(*) FILTER (WHERE round2_winner = 'P2') AS r2_p2,
            COUNT(*) FILTER (WHERE round3_winner = 'P1') AS r3_p1,
            COUNT(*) FILTER (WHERE round3_winner = 'P2') AS r3_p2
            FROM {SCHEMA}.mkx_events WHERE status = 'finished'"""
    )
    rounds = dict(cur.fetchone())

    # Статистика раундов из таблицы mkx_rounds
    cur.execute(
        f"""SELECT
            AVG(p1_health) FILTER (WHERE winner = 'P1') AS avg_p1_remaining_hp,
            AVG(p2_health) FILTER (WHERE winner = 'P2') AS avg_p2_remaining_hp,
            AVG(duration_sec) FILTER (WHERE duration_sec IS NOT NULL) AS avg_round_duration,
            COUNT(*) FILTER (WHERE finishing_move = 'KO') AS ko_count,
            COUNT(*) FILTER (WHERE finishing_move = 'Fatality') AS fatality_count,
            COUNT(*) FILTER (WHERE finishing_move = 'Brutality') AS brutality_count,
            COUNT(*) AS total_rounds_played
            FROM {SCHEMA}.mkx_rounds WHERE status = 'finished'"""
    )
    round_stats = dict(cur.fetchone())

    cur.execute(
        f"""SELECT bookmaker, COUNT(*) AS events_count,
            ROUND(AVG(odds1)::numeric, 2) AS avg_odds1
            FROM {SCHEMA}.mkx_events
            GROUP BY bookmaker ORDER BY events_count DESC"""
    )
    bookmakers = [dict(r) for r in cur.fetchall()]

    cur.execute(
        f"""SELECT status, events_found, events_new, created_at
            FROM {SCHEMA}.mkx_scraper_log
            ORDER BY created_at DESC LIMIT 1"""
    )
    last_scrape_row = cur.fetchone()
    last_scrape = dict(last_scrape_row) if last_scrape_row else None

    cur.close()
    return {
        "general": general,
        "totals": totals,
        "rounds": rounds,
        "round_stats": round_stats,
        "bookmakers": bookmakers,
        "last_scrape": last_scrape,
    }


def get_channels(conn):
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        f"SELECT * FROM {SCHEMA}.mkx_channels ORDER BY created_at DESC"
    )
    rows = [dict(r) for r in cur.fetchall()]
    cur.close()
    return rows


def add_channel(conn, channel_id: str, channel_name: str):
    cur = conn.cursor()
    cur.execute(
        f"""INSERT INTO {SCHEMA}.mkx_channels (channel_id, channel_name)
            VALUES (%s, %s) ON CONFLICT DO NOTHING RETURNING id""",
        (channel_id, channel_name)
    )
    result = cur.fetchone()
    conn.commit()
    cur.close()
    return result is not None


def handler(event: dict, context) -> dict:
    """REST API для дашборда MK X статистики с поддержкой раундов"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}
    action = params.get("action", "health")

    conn = get_conn()

    try:
        if action == "events":
            limit = int(params.get("limit", 50))
            events = get_events(conn, limit)
            return ok({"ok": True, "events": events, "count": len(events)})

        elif action == "live":
            events = get_live_events(conn)
            return ok({"ok": True, "events": events, "count": len(events)})

        elif action == "rounds":
            match_id = (params.get("match_id") or "").strip()
            if not match_id:
                return err("match_id required", 400)
            match = get_rounds_for_match(conn, match_id)
            if not match:
                return err("match not found", 404)
            return ok({"ok": True, "match": match})

        elif action == "stats":
            stats = get_stats(conn)
            return ok({"ok": True, **stats})

        elif action == "channels":
            if method == "POST":
                body = json.loads(event.get("body") or "{}")
                channel_id = body.get("channel_id", "")
                channel_name = body.get("channel_name", channel_id)
                if not channel_id:
                    return err("channel_id required")
                added = add_channel(conn, channel_id, channel_name)
                return ok({"ok": True, "added": added})
            else:
                channels = get_channels(conn)
                return ok({"ok": True, "channels": channels})

        else:
            return ok({"ok": True, "service": "MK X Stats API", "version": "1.1.0"})

    finally:
        conn.close()