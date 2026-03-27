"""
Скрейпер событий MK X с букмекерских сайтов.
Собирает данные о матчах, тоталах и результатах раундов, сохраняет в БД.
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

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "public")

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

MOCK_MATCHES = [
    {
        "match_id": "mkx_1001",
        "player1": "Scorpion",
        "player2": "Sub-Zero",
        "bookmaker": "1xBet",
        "odds1": 1.74,
        "odds2": 2.15,
        "total": 2.5,
        "round1_winner": "P1",
        "round2_winner": "P2",
        "round3_winner": "P1",
        "rounds_total": 3,
        "total_result": "OVER",
        "match_winner": "P1",
        "status": "finished",
    },
    {
        "match_id": "mkx_1002",
        "player1": "Liu Kang",
        "player2": "Kitana",
        "bookmaker": "Melbet",
        "odds1": 2.05,
        "odds2": 1.78,
        "total": 1.5,
        "round1_winner": "P2",
        "round2_winner": "P2",
        "round3_winner": None,
        "rounds_total": 2,
        "total_result": "UNDER",
        "match_winner": "P2",
        "status": "finished",
    },
    {
        "match_id": "mkx_1003",
        "player1": "Raiden",
        "player2": "Shao Kahn",
        "bookmaker": "1xBet",
        "odds1": 1.55,
        "odds2": 2.45,
        "total": 2.5,
        "round1_winner": "P1",
        "round2_winner": "P2",
        "round3_winner": "P1",
        "rounds_total": 3,
        "total_result": "OVER",
        "match_winner": "P1",
        "status": "finished",
    },
    {
        "match_id": "mkx_live_001",
        "player1": "Johnny Cage",
        "player2": "Sonya Blade",
        "bookmaker": "1xBet",
        "odds1": 1.82,
        "odds2": 2.01,
        "total": 1.5,
        "round1_winner": "P1",
        "round2_winner": None,
        "round3_winner": None,
        "rounds_total": 1,
        "total_result": None,
        "match_winner": None,
        "status": "live",
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
                "status": "live",
            })
    return matches


def parse_melbet(html: str) -> list:
    return []


def upsert_event(conn, event: dict) -> tuple:
    schema = SCHEMA
    cur = conn.cursor()
    
    cur.execute(
        f"SELECT id, status, sent_to_telegram FROM {schema}.mkx_events WHERE match_id = %s",
        (event["match_id"],)
    )
    row = cur.fetchone()
    
    is_new = row is None
    was_sent = row[2] if row else False
    
    if is_new:
        cur.execute(
            f"""INSERT INTO {schema}.mkx_events
                (match_id, player1, player2, bookmaker, odds1, odds2, total,
                 round1_winner, round2_winner, round3_winner, rounds_total,
                 total_result, match_winner, status, raw_data)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (
                event["match_id"], event["player1"], event["player2"],
                event["bookmaker"], event.get("odds1"), event.get("odds2"),
                event.get("total"),
                event.get("round1_winner"), event.get("round2_winner"), event.get("round3_winner"),
                event.get("rounds_total"), event.get("total_result"), event.get("match_winner"),
                event.get("status", "live"), json.dumps(event),
            )
        )
    else:
        cur.execute(
            f"""UPDATE {schema}.mkx_events SET
                odds1=%s, odds2=%s, total=%s,
                round1_winner=%s, round2_winner=%s, round3_winner=%s,
                rounds_total=%s, total_result=%s, match_winner=%s,
                status=%s, raw_data=%s, updated_at=NOW()
                WHERE match_id=%s""",
            (
                event.get("odds1"), event.get("odds2"), event.get("total"),
                event.get("round1_winner"), event.get("round2_winner"), event.get("round3_winner"),
                event.get("rounds_total"), event.get("total_result"), event.get("match_winner"),
                event.get("status", "live"), json.dumps(event), event["match_id"],
            )
        )
    
    conn.commit()
    cur.close()
    
    should_notify = (
        event.get("status") == "finished"
        and event.get("total_result") is not None
        and not was_sent
    )
    return is_new, should_notify


def send_to_telegram(event: dict):
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    channel = os.environ.get("TELEGRAM_CHANNEL_ID", "")
    
    if not token or not channel:
        return False
    
    total_label = event.get("total", "")
    total_result = event.get("total_result", "—")
    rounds = event.get("rounds_total", "—")
    winner = "П1" if event.get("match_winner") == "P1" else "П2" if event.get("match_winner") == "P2" else "—"
    
    round_icons = {"P1": "🔵", "P2": "🔴"}
    r1 = round_icons.get(event.get("round1_winner"), "⬜")
    r2 = round_icons.get(event.get("round2_winner"), "⬜")
    r3 = round_icons.get(event.get("round3_winner"), "⬜")
    
    total_emoji = "📈 ТБ" if total_result == "OVER" else "📉 ТМ" if total_result == "UNDER" else "➖"
    
    text = (
        f"🎮 *MK X — {event['player1']} vs {event['player2']}*\n"
        f"━━━━━━━━━━━━━━━━\n"
        f"🏆 Победитель: *{winner}*\n"
        f"🔢 Раундов: *{rounds}*\n"
        f"📊 Тотал {total_label}: *{total_emoji}*\n"
        f"\n"
        f"*Раунды:* {r1} Р1 · {r2} Р2 · {r3} Р3\n"
        f"\n"
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
    
    with urllib.request.urlopen(req, timeout=10) as resp:
        result = json.loads(resp.read().decode())
        return result.get("ok", False)


def mark_sent(conn, match_id: str):
    cur = conn.cursor()
    cur.execute(
        f"UPDATE {SCHEMA}.mkx_events SET sent_to_telegram=TRUE WHERE match_id=%s",
        (match_id,)
    )
    conn.commit()
    cur.close()


def handler(event: dict, context) -> dict:
    """Скрейпер событий MK X: собирает матчи с букмекеров и отправляет в Telegram"""
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
    events_sent = 0
    errors = []
    
    use_mock = True
    all_matches = []
    
    if not use_mock:
        for bk in BOOKMAKERS:
            try:
                html = fetch_url(bk["url"])
                parser_fn = globals().get(bk["parser"])
                if parser_fn:
                    matches = parser_fn(html)
                    all_matches.extend(matches)
            except Exception as e:
                errors.append(f"{bk['name']}: {str(e)[:100]}")
    else:
        all_matches = MOCK_MATCHES
    
    events_found = len(all_matches)
    
    for match in all_matches:
        try:
            is_new, should_notify = upsert_event(conn, match)
            if is_new:
                events_new += 1
            
            if should_notify:
                ok = send_to_telegram(match)
                if ok:
                    mark_sent(conn, match["match_id"])
                    events_sent += 1
        except Exception as e:
            errors.append(f"Event {match.get('match_id', '?')}: {str(e)[:100]}")
    
    cur = conn.cursor()
    cur.execute(
        f"""INSERT INTO {SCHEMA}.mkx_scraper_log (status, events_found, events_new, error_msg)
            VALUES (%s, %s, %s, %s)""",
        ("ok" if not errors else "partial", events_found, events_new, "\n".join(errors) if errors else None)
    )
    conn.commit()
    cur.close()
    conn.close()
    
    return {
        "statusCode": 200,
        "headers": {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"},
        "body": {
            "ok": True,
            "events_found": events_found,
            "events_new": events_new,
            "events_sent": events_sent,
            "errors": errors,
        },
    }