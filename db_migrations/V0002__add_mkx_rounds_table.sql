
-- Таблица для детальной статистики раундов каждого матча
CREATE TABLE IF NOT EXISTS t_p39733363_telegram_bot_sports_.mkx_rounds (
    id SERIAL PRIMARY KEY,
    match_id VARCHAR(128) NOT NULL,
    round_num INTEGER NOT NULL,           -- номер раунда: 1, 2, 3
    winner VARCHAR(4),                    -- 'P1', 'P2' или NULL если не завершён
    p1_health INTEGER,                    -- здоровье P1 в конце раунда (0-100)
    p2_health INTEGER,                    -- здоровье P2 в конце раунда (0-100)
    finishing_move VARCHAR(64),           -- тип финиша: 'KO', 'Fatality', 'Brutality', 'TK'
    duration_sec INTEGER,                 -- длительность раунда в секундах
    status VARCHAR(16) DEFAULT 'live',    -- 'live' или 'finished'
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(match_id, round_num)
);

CREATE INDEX IF NOT EXISTS idx_mkx_rounds_match_id ON t_p39733363_telegram_bot_sports_.mkx_rounds(match_id);
CREATE INDEX IF NOT EXISTS idx_mkx_rounds_created ON t_p39733363_telegram_bot_sports_.mkx_rounds(created_at DESC);

-- Добавляем поле live_round в mkx_events для отслеживания текущего раунда
ALTER TABLE t_p39733363_telegram_bot_sports_.mkx_events 
    ADD COLUMN IF NOT EXISTS live_round INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS p1_score INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS p2_score INTEGER DEFAULT 0;
