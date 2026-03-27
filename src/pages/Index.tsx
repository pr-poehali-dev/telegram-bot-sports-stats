import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

type IconName = string;

const MOCK_EVENTS = [
  { id: 1, time: "14:32:11", match: "Scorpion vs Sub-Zero", round: 3, total: 2.5, result: "OVER", winner: "P1", r1: "P1", r2: "P2", r3: "P1", odds1: 1.74, odds2: 2.15, bookmaker: "1xBet", status: "finished" },
  { id: 2, time: "14:29:44", match: "Liu Kang vs Kitana", round: 2, total: 1.5, result: "UNDER", winner: "P2", r1: "P2", r2: "P2", r3: null, odds1: 2.05, odds2: 1.78, bookmaker: "Melbet", status: "finished" },
  { id: 3, time: "14:27:18", match: "Raiden vs Shao Kahn", round: 3, total: 2.5, result: "OVER", winner: "P1", r1: "P1", r2: "P2", r3: "P1", odds1: 1.55, odds2: 2.45, bookmaker: "1xBet", status: "finished" },
  { id: 4, time: "14:25:03", match: "Cassie Cage vs Jacqui", round: 1, total: 0.5, result: "OVER", winner: "P2", r1: "P2", r2: null, r3: null, odds1: 1.90, odds2: 1.90, bookmaker: "Parimatch", status: "finished" },
  { id: 5, time: "14:22:55", match: "Erron Black vs Kenshi", round: 2, total: 1.5, result: "OVER", winner: "P1", r1: "P2", r2: "P1", r3: null, odds1: 1.68, odds2: 2.22, bookmaker: "Melbet", status: "finished" },
  { id: 6, time: "14:20:30", match: "Kung Jin vs Takeda", round: 3, total: 2.5, result: "UNDER", winner: "P2", r1: "P1", r2: "P2", r3: "P2", odds1: 2.10, odds2: 1.75, bookmaker: "1xBet", status: "finished" },
  { id: 7, time: "14:33:40", match: "Johnny Cage vs Sonya", round: 2, total: 1.5, result: "—", winner: "—", r1: "P1", r2: null, r3: null, odds1: 1.82, odds2: 2.01, bookmaker: "1xBet", status: "live" },
];

const HEAT_DATA = [
  { label: "Р1 → П1", value: 62, color: "#4488ff" },
  { label: "Р1 → П2", value: 38, color: "#ff6444" },
  { label: "Р2 → П1", value: 48, color: "#4488ff" },
  { label: "Р2 → П2", value: 52, color: "#ff6444" },
  { label: "Р3 → П1", value: 55, color: "#4488ff" },
  { label: "Р3 → П2", value: 45, color: "#ff6444" },
];

const TOTALS_STATS = [
  { label: "ТБ 0.5", over: 78, under: 22 },
  { label: "ТБ 1.5", over: 58, under: 42 },
  { label: "ТБ 2.5", over: 44, under: 56 },
];

const CHANNELS = [
  { name: "@mkx_totals", status: "active", events: 1247, today: 34 },
  { name: "@mkx_rounds", status: "active", events: 891, today: 28 },
  { name: "@mkx_alerts", status: "inactive", events: 0, today: 0 },
];

type Tab = "feed" | "analytics" | "settings";

export default function Index() {
  const [activeTab, setActiveTab] = useState<Tab>("feed");
  const [botStatus, setBotStatus] = useState<"running" | "stopped">("running");
  const [scraperStatus, setScraperStatus] = useState<"active" | "error">("active");
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("ru-RU"));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const liveEvent = MOCK_EVENTS.find(e => e.status === "live");
  const finishedEvents = MOCK_EVENTS.filter(e => e.status === "finished");

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
            { label: "Матчей сегодня", value: "62", icon: "Swords", color: "text-primary", delta: "+8" },
            { label: "Событий отправлено", value: "1 138", icon: "Send", color: "text-accent", delta: "+34" },
            { label: "ТБ 2.5 (win rate)", value: "56%", icon: "TrendingUp", color: "text-blue-400", delta: "+2%" },
            { label: "Ср. коэфф. P1", value: "1.82", icon: "BarChart2", color: "text-orange-400", delta: "−0.04" },
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
                <span className="font-oswald text-lg tracking-wide">{liveEvent.match}</span>
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
                  <span className={`badge-winner ${liveEvent.r1 === "P1" ? "badge-p1" : "badge-p2"}`}>{liveEvent.r1}</span>
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
                  <button className="text-xs font-mono text-primary border border-primary/20 rounded px-2 py-1 hover:bg-primary/10 transition-colors">
                    Обновить
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
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{event.time}</td>
                        <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">{event.match}</td>
                        <td className="px-4 py-3 font-mono text-sm text-center">{event.round}</td>
                        <td className="px-4 py-3 font-mono text-sm text-center text-muted-foreground">{event.total}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-mono text-xs font-semibold ${
                            event.result === "OVER" ? "neon-teal" :
                            event.result === "UNDER" ? "text-orange-400" : "text-muted-foreground"
                          }`}>
                            {event.result === "OVER" ? "ТБ ✓" : event.result === "UNDER" ? "ТМ ✓" : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-center">
                            {[event.r1, event.r2, event.r3].map((r, idx) =>
                              r ? (
                                <span key={idx} className={`badge-winner text-[10px] px-1.5 py-0.5 ${r === "P1" ? "badge-p1" : "badge-p2"}`}>{r}</span>
                              ) : (
                                <span key={idx} className="font-mono text-xs text-border">—</span>
                              )
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`badge-winner ${event.winner === "P1" ? "badge-p1" : "badge-p2"}`}>{event.winner}</span>
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
                {TOTALS_STATS.map(t => (
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
                {HEAT_DATA.map((d, i) => (
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
                {[
                  { name: "1xBet", events: 734, avgOdds: 1.87, share: 64 },
                  { name: "Melbet", events: 289, avgOdds: 1.79, share: 25 },
                  { name: "Parimatch", events: 115, avgOdds: 1.92, share: 11 },
                ].map(bk => (
                  <div key={bk.name} className="bg-muted/40 rounded-lg p-4 border border-border/30">
                    <div className="font-oswald font-semibold text-foreground mb-3">{bk.name}</div>
                    <div className="space-y-2 font-mono text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Событий</span>
                        <span className="text-foreground">{bk.events}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ср. КФ</span>
                        <span className="neon-orange">{bk.avgOdds}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Доля</span>
                        <span className="text-accent">{bk.share}%</span>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 bg-border rounded overflow-hidden">
                      <div className="h-full rounded bg-primary/60 transition-all duration-700" style={{ width: `${bk.share}%` }} />
                    </div>
                  </div>
                ))}
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
                        onClick={() => setScraperStatus(s => s === "active" ? "error" : "active")}
                        className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-all ${
                          scraperStatus === "active"
                            ? "bg-accent/20 text-accent border border-accent/30"
                            : "bg-destructive/20 text-destructive border border-destructive/30"
                        }`}
                      >
                        {scraperStatus === "active" ? "Работает" : "Ошибка"}
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
                {CHANNELS.map(ch => (
                  <div key={ch.name} className="flex items-center justify-between bg-muted/40 rounded p-3 border border-border/30">
                    <div className="flex items-center gap-2">
                      <span className={`status-dot ${ch.status}`} />
                      <div>
                        <div className="font-mono text-sm text-foreground">{ch.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{ch.events} событий · {ch.today} сегодня</div>
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
            <span>API: <span className="neon-teal">CONNECTED</span></span>
            <span>Uptime: <span className="text-foreground">4h 32m</span></span>
            <span>Задержка: <span className="text-primary">142ms</span></span>
          </div>
        </div>
      </footer>
    </div>
  );
}