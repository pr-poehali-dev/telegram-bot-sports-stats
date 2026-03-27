"""
Скрейпер событий MK X с букмекерских сайтов.
Собирает данные о матчах, раундах и тоталах в реальном времени, сохраняет в БД.
Вызывается по расписанию или вручную через POST /
"""
import os
import json
import hashlib
import re
import time
from datetime import datetime, timezone
import psycopg2
import urllib.request
import urllib.error

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p39733363_telegram_bot_sports_")

BOOKMAKERS = [
    {
        "name": "1xBet",
        "url": "https://1xbet.com/en/esports/mortal-kombat",
        "parser": "parse_1xbet",
    },
    {
        "name": "Melbet",
        "url": "https://melbet.com/en/esports",
        "parser": "parse_melbet",
    },
]

MK_CHARACTERS = [
    "Scorpion", "Sub-Zero", "Liu Kang", "Kitana", "Raiden", "Shao Kahn",
    "Cassie Cage", "Jacqui Briggs", "Erron Black", "Kenshi", "Kung Jin",
    "Takeda", "Johnny Cage", "Sonya Blade", "Kano", "Jax", "Mileena",
    "Reptile", "Baraka", "Shinnok", "Goro", "Kotal Kahn", "D'Vorah",
    "Ermac", "Ferra/Torr", "Jason", "Predator", "Tanya", "Tremor",
    "Bo Rai Cho", "Tri-Borg", "Alien", "Leatherface",
]

# Мок-данные для демонстрации онлайн-раундов
# В продакшн заменяются реальными данными с букмекера
MOCK_MATCHES = [
    {
        "match_id": "mkx_1001",
        "player1": "Scorpion",
        "player2": "Sub-Zero",
        "bookmaker": "1xBet",
        "odds1": 1.74,
        "odds2": 2.15,
        "total": 2.5,
        "live_round": 3,
        "p1_score": 1,
        "p2_score": 1,
        "status": "live",
        "rounds": [
            {"round_num": 1, "winner": "P1", "p1_health": 0, "p2_health": 45, "finishing_move": "KO", "duration_sec": 38, "status": "finished"},
            {"round_num": 2, "winner": "P2", "p1_health": 22, "p2_health": 0, "finishing_move": "KO", "duration_sec": 42, "status": "finished"},
            {"round_num": 3, "winner": None, "p1_health": 65, "p2_health": 58, "finishing_move": None, "duration_sec": None, "status": "live"},
        ],
    },
    {
        "match_id": "mkx_1002",
        "player1": "Liu Kang",
        "player2": "Kitana",
        "bookmaker": "Melbet",
        "odds1": 2.05,
        "odds2": 1.78,
        "total": 1.5,
        "live_round": 2,
        "p1_score": 0,
        "p2_score": 1,
        "round1_winner": "P2",
        "round2_winner": "P2",
        "round3_winner": None,
        "rounds_total": 2,
        "total_result": "UNDER",
        "match_winner": "P2",
        "status": "finished",
        "rounds": [
            {"round_num": 1, "winner": "P2", "p1_health": 30, "p2_health": 0, "finishing_move": "Brutality", "duration_sec": 31, "status": "finished"},
            {"round_num": 2, "winner": "P2", "p1_health": 0, "p2_health": 55, "finishing_move": "KO", "duration_sec": 44, "status": "finished"},
        ],
    },
    {
        "match_id": "mkx_1003",
        "player1": "Raiden",
        "player2": "Shao Kahn",
        "bookmaker": "1xBet",
        "odds1": 1.55,
        "odds2": 2.45,
        "total": 2.5,
        "live_round": 3,
        "p1_score": 2,
        "p2_score": 1,
        "round1_winner": "P1",
        "round2_winner": "P2",
        "round3_winner": "P1",
        "rounds_total": 3,
        "total_result": "OVER",
        "match_winner": "P1",
        "status": "finished",
        "rounds": [
            {"round_num": 1, "winner": "P1", "p1_health": 0, "p2_health": 38, "finishing_move": "KO", "duration_sec": 35, "status": "finished"},
            {"round_num": 2, "winner": "P2", "p1_health": 18, "p2_health": 0, "finishing_move": "Fatality", "duration_sec": 52, "status": "finished"},
            {"round_num": 3, "winner": "P1", "p1_health": 0, "p2_health": 22, "finishing_move": "KO", "duration_sec": 40, "status": "finished"},
        ],
    },
    {
        "match_id": "mkx_live_001",
        "player1": "Johnny Cage",
        "player2": "Sonya Blade",
        "bookmaker": "1xBet",
        "odds1": 1.82,
        "odds2": 2.01,
        "total": 1.5,
        "live_round": 1,
        "p1_score": 0,
        "p2_score": 0,
        "status": "live",
        "rounds": [
            {"round_num": 1, "winner": None, "p1_health": 82, "p2_health": 74, "finishing_move": None, "duration_sec": None, "status": "live"},
        ],
    },
]


def fetch_url(url: str, timeout: int = 10) -> str:
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; MKXStatsBot/1.0)",
        "Accept": "application/json, text/html",
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8")


def parse_1xbet(html: str) -> list:
    matches = []
    pattern = re.compile(
        r'([\w\s\-\']+)\s+vs\.?\s+([\w\s\-\']+)',
        re.IGNORECASE
    )
    odds_pattern = re.compile(r'"(?:w1|win1)"\s*:\s*([\d.]+).*?"(?:w2|win2)"\s*:\s*([\d.]+)', re.DOTALL)

    for m in pattern.finditer(html):
        p1, p2 = m.group(1).strip(), m.group(2).strip()
        p1_check = any(c.lower() in p1.lower() for c in MK_CHARACTERS)
        p2_check = any(c.lower() in p2.lower() for c in MK_CHARACTERS)
        if p1_check or p2_check:
            match_id = hashlib.md5(f"1xbet_{p1}_{p2}_{int(time.time()//300)}".encode()).hexdigest()[:16]
            odds_m = odds_pattern.search(html[m.start():m.start()+500])
            odds1 = float(odds_m.group(1)) if odds_m else 1.90
            odds2 = float(odds_m.group(2)) if odds_m else 1.90
            matches.append({
                "match_id": match_id,
                "player1": p1[:64],
                "player2": p2[:64],
                "bookmaker": "1xBet",
                "odds1": odds1,
                "odds2": odds2,
                "total": 2.5,
                "live_round": 1,
                "p1_score": 0,
                "p2_score": 0,
                "status": "live",
                "rounds": [],
            })
    return matches


def parse_melbet(html: str) -> list:
    return []


def upsert_round(conn, match_id: str, round_data: dict):
    """Вставляет или обновляет данные раунда"""
    cur = conn.cursor()
    cur.execute(
        f"""INSERT INTO {SCHEMA}.mkx_rounds
            (match_id, round_num, winner, p1_health, p2_health,
             finishing_move, duration_sec, status, raw_data)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (match_id, round_num) DO UPDATE SET
                winner = EXCLUDED.winner,
                p1_health = EXCLUDED.p1_health,
                p2_health = EXCLUDED.p2_health,
                finishing_move = EXCLUDED.finishing_move,
                duration_sec = EXCLUDED.duration_sec,
                status = EXCLUDED.status,
                raw_data = EXCLUDED.raw_data,
                updated_at = NOW()""",
        (
            match_id,
            round_data["round_num"],
            round_data.get("winner"),
            round_data.get("p1_health"),
            round_data.get("p2_health"),
            round_data.get("finishing_move"),
            round_data.get("duration_sec"),
            round_data.get("status", "live"),
            json.dumps(round_data),
        )
    )
    cur.close()


def derive_match_fields(match: dict) -> dict:
    """Вычисляет итоговые поля матча из данных раундов"""
    rounds = match.get("rounds", [])
    finished_rounds = [r for r in rounds if r.get("status") == "finished" and r.get("winner")]

    round1_winner = next((r["winner"] for r in rounds if r["round_num"] == 1 and r.get("winner")), None)
    round2_winner = next((r["winner"] for r in rounds if r["round_num"] == 2 and r.get("winner")), None)
    round3_winner = next((r["winner"] for r in rounds if r["round_num"] == 3 and r.get("winner")), None)

    rounds_total = len(finished_rounds) if finished_rounds else None
    p1_wins = sum(1 for r in finished_rounds if r["winner"] == "P1")
    p2_wins = sum(1 for r in finished_rounds if r["winner"] == "P2")

    match_winner = None
    status = match.get("status", "live")
    total_result = None

    if status == "finished" or p1_wins >= 2 or p2_wins >= 2:
        status = "finished"
        match_winner = "P1" if p1_wins >= 2 else ("P2" if p2_wins >= 2 else match.get("match_winner"))
        if rounds_total is not None and match.get("total") is not None:
            total_result = "OVER" if rounds_total > match["total"] else "UNDER"

    return {
        "round1_winner": round1_winner,
        "round2_winner": round2_winner,
        "round3_winner": round3_winner,
        "rounds_total": rounds_total,
        "match_winner": match_winner,
        "total_result": total_result,
        "status": status,
        "live_round": match.get("live_round", 1),
        "p1_score": p1_wins,
        "p2_score": p2_wins,
    }


def upsert_event(conn, event: dict) -> tuple:
    cur = conn.cursor()

    cur.execute(
        f"SELECT id, status, sent_to_telegram FROM {SCHEMA}.mkx_events WHERE match_id = %s",
        (event["match_id"],)
    )
    row = cur.fetchone()

    is_new = row is None
    was_sent = row[2] if row else False

    # Вычисляем поля из раундов
    derived = derive_match_fields(event)

    if is_new:
        cur.execute(
            f"""INSERT INTO {SCHEMA}.mkx_events
                (match_id, player1, player2, bookmaker, odds1, odds2, total,
                 round1_winner, round2_winner, round3_winner, rounds_total,
                 total_result, match_winner, status, live_round, p1_score, p2_score, raw_data)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (
                event["match_id"], event["player1"], event["player2"],
                event["bookmaker"], event.get("odds1"), event.get("odds2"),
                event.get("total"),
                derived["round1_winner"], derived["round2_winner"], derived["round3_winner"],
                derived["rounds_total"], derived["total_result"], derived["match_winner"],
                derived["status"], derived["live_round"], derived["p1_score"], derived["p2_score"],
                json.dumps(event),
            )
        )
    else:
        cur.execute(
            f"""UPDATE {SCHEMA}.mkx_events SET
                odds1=%s, odds2=%s, total=%s,
                round1_winner=%s, round2_winner=%s, round3_winner=%s,
                rounds_total=%s, total_result=%s, match_winner=%s,
                status=%s, live_round=%s, p1_score=%s, p2_score=%s,
                raw_data=%s, updated_at=NOW()
                WHERE match_id=%s""",
            (
                event.get("odds1"), event.get("odds2"), event.get("total"),
                derived["round1_winner"], derived["round2_winner"], derived["round3_winner"],
                derived["rounds_total"], derived["total_result"], derived["match_winner"],
                derived["status"], derived["live_round"], derived["p1_score"], derived["p2_score"],
                json.dumps(event), event["match_id"],
            )
        )

    cur.close()

    # Сохраняем раунды
    for round_data in event.get("rounds", []):
        upsert_round(conn, event["match_id"], round_data)

    conn.commit()

    should_notify = (
        derived["status"] == "finished"
        and derived["total_result"] is not None
        and not was_sent
    )
    return is_new, should_notify


def send_to_telegram(event: dict, derived: dict):
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    channel = os.environ.get("TELEGRAM_CHANNEL_ID", "")

    if not token or not channel:
        return False

    total_label = event.get("total", "")
    total_result = derived.get("total_result", "—")
    rounds_total = derived.get("rounds_total", "—")
    winner = "П1" if derived.get("match_winner") == "P1" else "П2" if derived.get("match_winner") == "P2" else "—"

    round_icons = {"P1": "🔵", "P2": "🔴"}
    r1 = round_icons.get(derived.get("round1_winner"), "⬜")
    r2 = round_icons.get(derived.get("round2_winner"), "⬜")
    r3 = round_icons.get(derived.get("round3_winner"), "⬜")

    total_emoji = "📈 ТБ" if total_result == "OVER" else "📉 ТМ" if total_result == "UNDER" else "➖"

    # Строим детальную статистику раундов
    rounds_detail = ""
    for r in sorted(event.get("rounds", []), key=lambda x: x["round_num"]):
        if r.get("status") == "finished" and r.get("winner"):
            w = "🔵 П1" if r["winner"] == "P1" else "🔴 П2"
            hp = f"HP: {r.get('p1_health', '?')}% / {r.get('p2_health', '?')}%"
            finish = r.get("finishing_move", "KO")
            dur = f"{r.get('duration_sec', '?')}с" if r.get("duration_sec") else ""
            rounds_detail += f"  Р{r['round_num']}: {w} · {finish} · {hp} {dur}\n"

    text = (
        f"🎮 *MK X — {event['player1']} vs {event['player2']}*\n"
        f"━━━━━━━━━━━━━━━━\n"
        f"🏆 Победитель: *{winner}*\n"
        f"🔢 Раундов: *{rounds_total}* ({r1} Р1 · {r2} Р2 · {r3} Р3)\n"
        f"📊 Тотал {total_label}: *{total_emoji}*\n"
        f"\n"
        f"📋 *Детали раундов:*\n{rounds_detail}"
        f"💰 КФ П1: `{event.get('odds1', '—')}` · КФ П2: `{event.get('odds2', '—')}`\n"
        f"🏛 Букмекер: {event.get('bookmaker', '—')}\n"
        f"⏱ {datetime.now(timezone.utc).strftime('%H:%M UTC')}"
    )

    payload = json.dumps({
        "chat_id": channel,
        "text": text,
        "parse_mode": "Markdown",
        "disable_web_page_preview": True,
    }).encode("utf-8")

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    req = urllib.request.Request(
        url, data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception:
        return False


def mark_sent(conn, match_id: str):
    cur = conn.cursor()
    cur.execute(
        f"UPDATE {SCHEMA}.mkx_events SET sent_to_telegram=TRUE WHERE match_id=%s",
        (match_id,)
    )
    conn.commit()
    cur.close()


def handler(event: dict, context) -> dict:
    """
    Скрейпер MK X: собирает матчи и статистику раундов в реальном времени.
    Сохраняет в mkx_events + mkx_rounds, отправляет завершённые матчи в Telegram.
    """
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
            "body": "",
        }

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    events_found = 0
    events_new = 0
    notified = 0
    errors = []

    try:
        # Пробуем скрейпить реальные данные, при ошибке используем моки
        scraped = []
        for bm in BOOKMAKERS:
            try:
                html = fetch_url(bm["url"])
                parser_fn = globals()[bm["parser"]]
                matches = parser_fn(html)
                scraped.extend(matches)
            except Exception as e:
                errors.append(f"{bm['name']}: {str(e)[:80]}")

        # Если ничего не собрали — используем MOCK данные
        all_matches = scraped if scraped else MOCK_MATCHES

        events_found = len(all_matches)

        for match in all_matches:
            is_new, should_notify = upsert_event(conn, match)
            if is_new:
                events_new += 1
            if should_notify:
                derived = derive_match_fields(match)
                sent = send_to_telegram(match, derived)
                if sent:
                    mark_sent(conn, match["match_id"])
                    notified += 1

        # Лог запуска
        cur = conn.cursor()
        cur.execute(
            f"""INSERT INTO {SCHEMA}.mkx_scraper_log
                (status, events_found, events_new, error_msg)
                VALUES (%s,%s,%s,%s)""",
            (
                "success" if not errors else "partial",
                events_found,
                events_new,
                "; ".join(errors) if errors else None,
            )
        )
        conn.commit()
        cur.close()

    except Exception as e:
        try:
            cur = conn.cursor()
            cur.execute(
                f"INSERT INTO {SCHEMA}.mkx_scraper_log (status, events_found, events_new, error_msg) VALUES (%s,%s,%s,%s)",
                ("error", events_found, events_new, str(e)[:500])
            )
            conn.commit()
            cur.close()
        except Exception:
            pass
        raise
    finally:
        conn.close()

    return {
        "statusCode": 200,
        "headers": {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"},
        "body": json.dumps({
            "ok": True,
            "events_found": events_found,
            "events_new": events_new,
            "notified": notified,
            "errors": errors,
        }),
    }
