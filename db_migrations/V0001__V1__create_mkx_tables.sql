CREATE TABLE t_p39733363_telegram_bot_sports_.mkx_events (
    id SERIAL PRIMARY KEY,
    match_id VARCHAR(128) UNIQUE NOT NULL,
    player1 VARCHAR(128) NOT NULL,
    player2 VARCHAR(128) NOT NULL,
    bookmaker VARCHAR(64) NOT NULL,
    odds1 NUMERIC(6,2),
    odds2 NUMERIC(6,2),
    total NUMERIC(4,1),
    round1_winner VARCHAR(4),
    round2_winner VARCHAR(4),
    round3_winner VARCHAR(4),
    rounds_total INTEGER,
    total_result VARCHAR(8),
    match_winner VARCHAR(4),
    status VARCHAR(16) DEFAULT 'live',
    sent_to_telegram BOOLEAN DEFAULT FALSE,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE t_p39733363_telegram_bot_sports_.mkx_channels (
    id SERIAL PRIMARY KEY,
    channel_id VARCHAR(128) NOT NULL,
    channel_name VARCHAR(128),
    active BOOLEAN DEFAULT TRUE,
    events_sent INTEGER DEFAULT 0,
    filter_min_odds NUMERIC(4,2) DEFAULT 1.70,
    filter_totals VARCHAR(64) DEFAULT '0.5,1.5,2.5',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO t_p39733363_telegram_bot_sports_.mkx_channels (channel_id, channel_name)
VALUES ('@mkx_totals', 'MK X Тоталы');

CREATE TABLE t_p39733363_telegram_bot_sports_.mkx_scraper_log (
    id SERIAL PRIMARY KEY,
    status VARCHAR(16) NOT NULL,
    events_found INTEGER DEFAULT 0,
    events_new INTEGER DEFAULT 0,
    error_msg TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
