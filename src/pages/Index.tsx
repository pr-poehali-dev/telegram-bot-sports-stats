import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

const API_URL = "https://functions.poehali.dev/210b78af-97ea-4d9e-86e0-52624db54074";
const SCRAPER_URL = "https://functions.poehali.dev/4f082b1d-3759-4220-88fd-8587b1ab9b42";

interface MkxEvent {
  id: number;
  match_id: string;
  player1: string;
  player2: string;
  bookmaker: string;
  odds1: number;
  odds2: number;
  total: number;
  round1_winner: string | null;
  round2_winner: string | null;
  round3_winner: string | null;
  rounds_total: number;
  total_result: string | null;
  match_winner: string | null;
  status: string;
  sent_to_telegram: boolean;
  created_at: string;
}

interface StatsData {
  general: { matches_today: number; sent_today: number; total_matches: number; avg_odds1: number; avg_odds2: number };
  totals: { total: number; over_count: number; under_count: number; total_count: number }[];
  rounds: { r1_p1: number; r1_p2: number; r2_p1: number; r2_p2: number; r3_p1: number; r3_p2: number };
  bookmakers: { bookmaker: string; events_count: number; avg_odds1: number }[];
  last_scrape: { status: string; events_found: number; events_new: number; created_at: string } | null;
}

interface Channel {
  id: number;
  channel_id: string;
  channel_name: string;
  active: boolean;
  events_sent: number;
}

type Tab = "feed" | "analytics" | "settings";

export default function Index() {
  const [activeTab, setActiveTab] = useState<Tab>("feed");
  const [botStatus, setBotStatus] = useState<"running" | "stopped">("running");
  const [scraperStatus, setScraperStatus] = useState<"active" | "error" | "loading">("active");
  const [currentTime, setCurrentTime] = useState("");
  const [events, setEvents] = useState<MkxEvent[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("ru-RU"));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [eventsRes, statsRes, channelsRes] = await Promise.all([
        fetch(`${API_URL}?action=events&limit=50`),
        fetch(`${API_URL}?action=stats`),
        fetch(`${API_URL}?action=channels`),
      ]);
      const eventsData = await eventsRes.json();
      const statsData = await statsRes.json();
      const channelsData = await channelsRes.json();
      if (eventsData.ok) setEvents(eventsData.events);
      if (statsData.ok) setStats(statsData);
      if (channelsData.ok) setChannels(channelsData.channels);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const runScraper = async () => {
    setScraperStatus("loading");
    try {
      const res = await fetch(SCRAPER_URL, { method: "POST" });
      const data = await res.json();
      setScraperStatus(data.ok ? "active" : "error");
      fetchData();
    } catch {
      setScraperStatus("error");
    }
  };

  const liveEvent = events.find(e => e.status === "live");
  const finishedEvents = events.filter(e => e.status === "finished");

  const heatData = stats ? [
    { label: "Р1 → П1", value: pct(stats.rounds.r1_p1, stats.rounds.r1_p1 + stats.rounds.r1_p2), color: "#4488ff" },
    { label: "Р1 → П2", value: pct(stats.rounds.r1_p2, stats.rounds.r1_p1 + stats.rounds.r1_p2), color: "#ff6444" },
    { label: "Р2 → П1", value: pct(stats.rounds.r2_p1, stats.rounds.r2_p1 + stats.rounds.r2_p2), color: "#4488ff" },
    { label: "Р2 → П2", value: pct(stats.rounds.r2_p2, stats.rounds.r2_p1 + stats.rounds.r2_p2), color: "#ff6444" },
    { label: "Р3 → П1", value: pct(stats.rounds.r3_p1, stats.rounds.r3_p1 + stats.rounds.r3_p2), color: "#4488ff" },
    { label: "Р3 → П2", value: pct(stats.rounds.r3_p2, stats.rounds.r3_p1 + stats.rounds.r3_p2), color: "#ff6444" },
  ] : [];

  const totalsStats = stats?.totals.map(t => ({
    label: `ТБ ${t.total}`,
    over: pct(t.over_count, t.total_count),
    under: pct(t.under_count, t.total_count),
  })) ?? [];

  function pct(val: number, total: number) {
    if (!total) return 0;
    return Math.round((val / total) * 100);
  }

  function formatTime(iso: string) {
    try { return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
    catch { return iso; }
  }

  return (
    <div className="min-h-screen font-rubik">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-primary/20 border border-primary/30 flex items-center justify-center">
              <span className="text-sm">🎮</span>
            </div>
            <div>
              <span className="font-oswald text-base font-semibold tracking-widest uppercase text-foreground">MK X</span>
              <span className="text-muted-foreground text-xs ml-2 font-mono">STATS BOT</span>
            </div>
            <div className="w-px h-5 bg-border mx-1" />
            <div className="flex items-center gap-1.5">
              <span className={`status-dot ${scraperStatus === "active" ? "active" : "error"}`} />
              <span className="text-xs font-mono text-muted-foreground">
                SCRAPER {scraperStatus === "active" ? "ONLINE" : "ERROR"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-muted-foreground hidden sm:block">{currentTime}</span>
            <div className="flex items-center gap-2 bg-accent/10 border border-accent/20 rounded px-3 py-1.5">
              <span className={`status-dot ${botStatus === "running" ? "active" : "inactive"}`} />
              <span className="text-xs font-mono text-accent">
                {botStatus === "running" ? "БОТ АКТИВЕН" : "ОСТАНОВЛЕН"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Матчей сегодня", value: loading ? "…" : String(stats?.general.matches_today ?? 0), icon: "Swords", color: "text-primary", delta: `${stats?.general.total_matches ?? 0} всего` },
            { label: "Событий отправлено", value: loading ? "…" : String(stats?.general.sent_today ?? 0), icon: "Send", color: "text-accent", delta: "сегодня" },
            { label: "ТБ 2.5 (win rate)", value: loading ? "…" : (() => { const t = stats?.totals.find(x => Number(x.total) === 2.5); return t ? `${pct(t.over_count, t.total_count)}%` : "—"; })(), icon: "TrendingUp", color: "text-blue-400", delta: "матчей ТБ" },
            { label: "Ср. коэфф. P1", value: loading ? "…" : String(stats?.general.avg_odds1 ?? "—"), icon: "BarChart2", color: "text-orange-400", delta: `П2: ${stats?.general.avg_odds2 ?? "—"}` },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className="card-glow bg-card rounded-lg p-4 animate-fade-in"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-muted-foreground text-xs font-mono uppercase tracking-wider leading-tight">{stat.label}</span>
                <Icon name={stat.icon} size={14} className={`${stat.color} opacity-70 shrink-0 ml-1`} />
              </div>
              <div className={`text-2xl font-oswald font-semibold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs font-mono text-muted-foreground mt-1">{stat.delta} за 24ч</div>
            </div>
          ))}
        </div>

        {/* Live match banner */}
        {liveEvent && (
          <div className="card-teal bg-card rounded-lg p-4 mb-6 border border-accent/20 animate-fade-in">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="badge-live">● LIVE</span>
                <span className="font-oswald text-lg tracking-wide">{liveEvent.player1} vs {liveEvent.player2}</span>
              </div>
              <div className="flex items-center gap-4 font-mono text-sm">
                <div className="text-center">
                  <div className="text-muted-foreground text-xs mb-0.5">КФ П1</div>
                  <div className="neon-teal font-semibold">{liveEvent.odds1}</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground text-xs mb-0.5">КФ П2</div>
                  <div className="text-orange-400 font-semibold">{liveEvent.odds2}</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground text-xs mb-0.5">Раунд 1</div>
                  <span className={`badge-winner ${liveEvent.round1_winner === "P1" ? "badge-p1" : "badge-p2"}`}>{liveEvent.round1_winner ?? "—"}</span>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground text-xs mb-0.5">Источник</div>
                  <div className="text-muted-foreground text-xs">{liveEvent.bookmaker}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-muted/30 rounded-lg p-1 w-fit">
          {([
            { id: "feed", label: "Лента событий", icon: "Activity" },
            { id: "analytics", label: "Аналитика", icon: "BarChart3" },
            { id: "settings", label: "Настройки", icon: "Settings2" },
          ] as { id: Tab; label: string; icon: string }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-card text-primary shadow-sm border border-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon name={tab.icon} size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB: Feed */}
        {activeTab === "feed" && (
          <div className="animate-fade-in">
            <div className="card-glow bg-card rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name="Activity" size={14} className="text-primary" />
                  <span className="text-sm font-semibold font-oswald tracking-wide">ЛЕНТА МАТЧЕЙ</span>
                  <span className="font-mono text-xs text-muted-foreground ml-1 hidden sm:block">— последние события</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{finishedEvents.length} завершено</span>
                  <button
                    onClick={fetchData}
                    className="text-xs font-mono text-primary border border-primary/20 rounded px-2 py-1 hover:bg-primary/10 transition-colors"
                  >
                    {loading ? "…" : "Обновить"}
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-border/50">
                      {["Время", "Матч", "Раундов", "Тотал", "Итог", "Р1 / Р2 / Р3", "Победитель", "Букмекер"].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-mono text-muted-foreground uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {finishedEvents.map((event, i) => (
                      <tr
                        key={event.id}
                        className="event-row animate-fade-in"
                        style={{ animationDelay: `${i * 0.05}s` }}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{formatTime(event.created_at)}</td>
                        <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">{event.player1} vs {event.player2}</td>
                        <td className="px-4 py-3 font-mono text-sm text-center">{event.rounds_total ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-sm text-center text-muted-foreground">{event.total ?? "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-mono text-xs font-semibold ${
                            event.total_result === "OVER" ? "neon-teal" :
                            event.total_result === "UNDER" ? "text-orange-400" : "text-muted-foreground"
                          }`}>
                            {event.total_result === "OVER" ? "ТБ ✓" : event.total_result === "UNDER" ? "ТМ ✓" : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-center">
                            {[event.round1_winner, event.round2_winner, event.round3_winner].map((r, idx) =>
                              r ? (
                                <span key={idx} className={`badge-winner text-[10px] px-1.5 py-0.5 ${r === "P1" ? "badge-p1" : "badge-p2"}`}>{r}</span>
                              ) : (
                                <span key={idx} className="font-mono text-xs text-border">—</span>
                              )
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {event.match_winner ? (
                            <span className={`badge-winner ${event.match_winner === "P1" ? "badge-p1" : "badge-p2"}`}>{event.match_winner}</span>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground text-center">{event.bookmaker}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Analytics */}
        {activeTab === "analytics" && (
          <div className="animate-fade-in grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card-glow bg-card rounded-lg p-5">
              <div className="flex items-center gap-2 mb-5">
                <Icon name="TrendingUp" size={14} className="text-primary" />
                <span className="font-oswald text-sm font-semibold tracking-widest uppercase">Тоталы раундов</span>
              </div>
              <div className="space-y-4">
                {totalsStats.map(t => (
                  <div key={t.label}>
                    <div className="flex justify-between mb-1.5">
                      <span className="font-mono text-xs text-muted-foreground">{t.label}</span>
                      <div className="flex gap-3 font-mono text-xs">
                        <span className="neon-teal">ТБ {t.over}%</span>
                        <span className="text-orange-400">ТМ {t.under}%</span>
                      </div>
                    </div>
                    <div className="flex h-2 rounded overflow-hidden bg-muted">
                      <div className="h-full bg-accent transition-all duration-700" style={{ width: `${t.over}%` }} />
                      <div className="h-full bg-orange-500 transition-all duration-700" style={{ width: `${t.under}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-glow bg-card rounded-lg p-5">
              <div className="flex items-center gap-2 mb-5">
                <Icon name="Flame" size={14} className="text-orange-400" />
                <span className="font-oswald text-sm font-semibold tracking-widest uppercase">Победы по раундам</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {heatData.map((d, i) => (
                  <div key={i} className="heat-cell bg-muted/40 rounded p-3 border border-border/50 cursor-default">
                    <div className="text-xs font-mono text-muted-foreground mb-1">{d.label}</div>
                    <div className="text-xl font-oswald font-semibold" style={{ color: d.color }}>{d.value}%</div>
                    <div className="mt-1.5 h-1 bg-border rounded overflow-hidden">
                      <div className="h-full rounded transition-all duration-700" style={{ width: `${d.value}%`, background: d.color, opacity: 0.8 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-glow bg-card rounded-lg p-5 md:col-span-2">
              <div className="flex items-center gap-2 mb-5">
                <Icon name="Building2" size={14} className="text-primary" />
                <span className="font-oswald text-sm font-semibold tracking-widest uppercase">Активность букмекеров</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(stats?.bookmakers ?? []).map((bk, idx) => {
                  const total = stats?.bookmakers.reduce((s, b) => s + Number(b.events_count), 0) ?? 1;
                  const share = pct(Number(bk.events_count), total);
                  return (
                  <div key={bk.bookmaker} className="bg-muted/40 rounded-lg p-4 border border-border/30">
                    <div className="font-oswald font-semibold text-foreground mb-3">{bk.bookmaker}</div>
                    <div className="space-y-2 font-mono text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Событий</span>
                        <span className="text-foreground">{bk.events_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ср. КФ</span>
                        <span className="neon-orange">{bk.avg_odds1}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Доля</span>
                        <span className="text-accent">{share}%</span>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 bg-border rounded overflow-hidden">
                      <div className="h-full rounded bg-primary/60 transition-all duration-700" style={{ width: `${share}%` }} />
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB: Settings */}
        {activeTab === "settings" && (
          <div className="animate-fade-in grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card-glow bg-card rounded-lg p-5">
              <div className="flex items-center gap-2 mb-5">
                <Icon name="Bot" size={14} className="text-primary" />
                <span className="font-oswald text-sm font-semibold tracking-widest uppercase">Управление ботом</span>
              </div>
              <div className="space-y-3">
                {[
                  {
                    title: "Telegram бот",
                    sub: "@mkx_statsbot",
                    isBot: true,
                  },
                  {
                    title: "Скрейпер",
                    sub: "Интервал: 30 сек",
                    isBot: false,
                  },
                ].map((item) => (
                  <div key={item.title} className="flex items-center justify-between bg-muted/40 rounded p-3 border border-border/30">
                    <div>
                      <div className="text-sm font-medium">{item.title}</div>
                      <div className="font-mono text-xs text-muted-foreground mt-0.5">{item.sub}</div>
                    </div>
                    {item.isBot ? (
                      <button
                        onClick={() => setBotStatus(s => s === "running" ? "stopped" : "running")}
                        className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-all ${
                          botStatus === "running"
                            ? "bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30"
                            : "bg-accent/20 text-accent border border-accent/30 hover:bg-accent/30"
                        }`}
                      >
                        {botStatus === "running" ? "Остановить" : "Запустить"}
                      </button>
                    ) : (
                      <button
                        onClick={runScraper}
                        className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-all ${
                          scraperStatus === "active"
                            ? "bg-accent/20 text-accent border border-accent/30 hover:bg-accent/30"
                            : scraperStatus === "loading"
                            ? "bg-muted/40 text-muted-foreground border border-border/30"
                            : "bg-destructive/20 text-destructive border border-destructive/30"
                        }`}
                      >
                        {scraperStatus === "loading" ? "Запуск…" : scraperStatus === "active" ? "Запустить" : "Ошибка"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="card-glow bg-card rounded-lg p-5">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Icon name="Send" size={14} className="text-primary" />
                  <span className="font-oswald text-sm font-semibold tracking-widest uppercase">Каналы отправки</span>
                </div>
                <button className="text-xs font-mono text-primary border border-primary/20 rounded px-2 py-1 hover:bg-primary/10 transition-colors">
                  + Добавить
                </button>
              </div>
              <div className="space-y-2">
                {channels.map(ch => (
                  <div key={ch.id} className="flex items-center justify-between bg-muted/40 rounded p-3 border border-border/30">
                    <div className="flex items-center gap-2">
                      <span className={`status-dot ${ch.active ? "active" : "inactive"}`} />
                      <div>
                        <div className="font-mono text-sm text-foreground">{ch.channel_id}</div>
                        <div className="font-mono text-xs text-muted-foreground">{ch.events_sent} событий</div>
                      </div>
                    </div>
                    <Icon name="ChevronRight" size={14} className="text-muted-foreground" />
                  </div>
                ))}
              </div>
            </div>

            <div className="card-glow bg-card rounded-lg p-5 md:col-span-2">
              <div className="flex items-center gap-2 mb-5">
                <Icon name="Filter" size={14} className="text-primary" />
                <span className="font-oswald text-sm font-semibold tracking-widest uppercase">Фильтры событий</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Минимальный КФ", value: "1.70", active: true },
                  { label: "Тип тотала", value: "ТБ 1.5 / ТБ 2.5", active: true },
                  { label: "Только раунд 3", value: "Включено", active: false },
                  { label: "Только P1 победы", value: "Выключено", active: false },
                ].map(f => (
                  <div key={f.label} className={`rounded p-3 border transition-colors ${f.active ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border/30"}`}>
                    <div className="text-xs text-muted-foreground font-mono mb-1">{f.label}</div>
                    <div className={`text-sm font-medium ${f.active ? "text-primary" : "text-muted-foreground"}`}>{f.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-8 py-4">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between flex-wrap gap-2">
          <span className="font-mono text-xs text-muted-foreground">MK X Stats Bot v1.0.0</span>
          <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
            <span>API: <span className={loading ? "text-muted-foreground" : "neon-teal"}>{loading ? "…" : "CONNECTED"}</span></span>
            <span>Матчей в БД: <span className="text-foreground">{stats?.general.total_matches ?? 0}</span></span>
            <span>Скрейпер: <span className={scraperStatus === "active" ? "neon-teal" : scraperStatus === "error" ? "neon-red" : "text-muted-foreground"}>{scraperStatus === "active" ? "OK" : scraperStatus === "loading" ? "…" : "ERR"}</span></span>
          </div>
        </div>
      </footer>
    </div>
  );
}