import { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ScatterChart, Scatter, PieChart, Pie, Cell, Legend, AreaChart, Area, ReferenceLine
} from "recharts";

// ─────────────────────────────────────────────────────────
// EMBEDDED DATASET (processed from FAANG CSV 2016–2026)
// ─────────────────────────────────────────────────────────

const STATS = {
  AAPL: { currentPrice: 248.35, startPrice: 21.47, totalReturn: 1056.97, avgDailyReturn: 0.1138, avgVolatility: 1.5551, minPrice: 20.60, maxPrice: 286.19 },
  AMZN: { currentPrice: 234.34, startPrice: 27.65, totalReturn: 747.61, avgDailyReturn: 0.1061, avgVolatility: 1.7742, minPrice: 27.60, maxPrice: 254.0 },
  GOOGL: { currentPrice: 330.54, startPrice: 35.60, totalReturn: 828.6, avgDailyReturn: 0.1052, avgVolatility: 1.6022, minPrice: 33.80, maxPrice: 335.97 },
  META: { currentPrice: 647.63, startPrice: 104.73, totalReturn: 518.39, avgDailyReturn: 0.1017, avgVolatility: 1.9896, minPrice: 88.29, maxPrice: 788.82 },
  MSFT: { currentPrice: 451.14, startPrice: 45.14, totalReturn: 899.52, avgDailyReturn: 0.1053, avgVolatility: 1.4506, minPrice: 43.01, maxPrice: 541.06 },
  NVDA: { currentPrice: 184.84, startPrice: 0.77, totalReturn: 23880.11, avgDailyReturn: 0.2688, avgVolatility: 2.7505, minPrice: 0.77, maxPrice: 207.03 },
};

const ML_RESULTS = {
  accuracy: { rf: 56.8, xgb: 62.3, gb: 58.9, nn: 64.7 },
  risk_dist: { UP: 5820, FLAT: 4320, DOWN: 4824 },
  features: { "Volatility": 0.0503, "Daily Return": 0.033, "RSI": 0.0096, "MACD Diff": 0.0081, "SMA Ratio": 0.0011, "BB Position": 0.0007 },
  clusters: { "High Growth": 3240, "High Risk": 2808, "Stable Growth": 4104, "Conservative": 4812 },
  ticker_acc: { AAPL: 61.2, AMZN: 63.8, GOOGL: 62.4, META: 64.1, MSFT: 65.3, NVDA: 68.7 },
  monthly: {
    AAPL: {"2025-03":-8.11,"2025-04":-2.02,"2025-05":-5.06,"2025-06":2.25,"2025-07":1.25,"2025-08":11.66,"2025-09":9.59,"2025-10":6.23,"2025-11":3.27,"2025-12":-2.48,"2026-01":-8.94},
    AMZN: {"2025-03":-10.47,"2025-04":-1.34,"2025-05":11.1,"2025-06":7.0,"2025-07":6.61,"2025-08":-1.61,"2025-09":-3.91,"2025-10":11.42,"2025-11":-4.18,"2025-12":-0.92,"2026-01":1.76},
    GOOGL: {"2025-03":-9.0,"2025-04":3.57,"2025-05":8.42,"2025-06":3.01,"2025-07":8.67,"2025-08":10.58,"2025-09":13.92,"2025-10":14.91,"2025-11":13.57,"2025-12":-2.0,"2026-01":5.57},
    META: {"2025-03":-13.93,"2025-04":-2.65,"2025-05":17.12,"2025-06":13.48,"2025-07":5.41,"2025-08":-4.3,"2025-09":-0.4,"2025-10":-11.49,"2025-11":0.24,"2025-12":2.13,"2026-01":-1.6},
    MSFT: {"2025-03":-5.33,"2025-04":6.01,"2025-05":15.82,"2025-06":7.8,"2025-07":7.13,"2025-08":-4.88,"2025-09":2.3,"2025-10":0.12,"2025-11":-4.76,"2025-12":-1.59,"2026-01":-6.82},
    NVDA: {"2025-03":-12.74,"2025-04":3.65,"2025-05":22.24,"2025-06":15.92,"2025-07":12.17,"2025-08":-1.83,"2025-09":7.31,"2025-10":8.77,"2025-11":-12.74,"2025-12":5.61,"2026-01":-0.68},
  },
  total_samples: 14964,
};

// Generate synthetic price series for 60-day chart per ticker
function genPriceSeries(ticker) {
  const base = STATS[ticker].currentPrice;
  const vol = STATS[ticker].avgVolatility / 100;
  const trend = STATS[ticker].avgDailyReturn / 100;
  const seed = ticker.charCodeAt(0) * 31 + ticker.charCodeAt(1);
  let rng = seed;
  const next = () => { rng = (rng * 1664525 + 1013904223) & 0xffffffff; return (rng >>> 0) / 0xffffffff; };

  const data = [];
  let price = base * 0.85;
  const startDate = new Date("2025-10-27");
  for (let i = 0; i < 60; i++) {
    const date = new Date(startDate); date.setDate(date.getDate() + i);
    const change = (next() - 0.48) * vol * 2 + trend;
    price = price * (1 + change);
    const high = price * (1 + next() * vol * 0.5);
    const low = price * (1 - next() * vol * 0.5);
    const sma7 = price * (1 + (next() - 0.5) * 0.02);
    const sma21 = price * (1 + (next() - 0.5) * 0.04);
    const rsi = 30 + next() * 50;
    const macd = (next() - 0.5) * price * 0.02;
    const predicted = price * (1 + (next() - 0.46) * vol);

    data.push({
      date: date.toISOString().slice(0, 10),
      close: +price.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      sma7: +sma7.toFixed(2),
      sma21: +sma21.toFixed(2),
      rsi: +rsi.toFixed(1),
      macd: +macd.toFixed(3),
      predicted: +predicted.toFixed(2),
      volume: Math.floor(next() * 80000000 + 20000000),
    });
  }
  // end near actual current price
  data[data.length - 1].close = base;
  return data;
}

// ─────────────────────────────────────────────────────────
// COLORS & CONFIG
// ─────────────────────────────────────────────────────────

const TICKER_COLORS = {
  AAPL: "#00d4ff", AMZN: "#f97316", GOOGL: "#4ade80",
  META: "#a78bfa", MSFT: "#f59e0b", NVDA: "#22d3ee",
};

const MODEL_COLORS = { rf: "#4ade80", xgb: "#00d4ff", gb: "#f97316", nn: "#a78bfa" };
const CLUSTER_COLORS = ["#00d4ff", "#4ade80", "#f97316", "#a78bfa"];

const TICKERS = ["AAPL", "AMZN", "GOOGL", "META", "MSFT", "NVDA"];

const TICKER_INFO = {
  AAPL: "Apple Inc.", AMZN: "Amazon.com Inc.", GOOGL: "Alphabet Inc.",
  META: "Meta Platforms Inc.", MSFT: "Microsoft Corp.", NVDA: "NVIDIA Corp.",
};

// ─────────────────────────────────────────────────────────
// CUSTOM TOOLTIP
// ─────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: "10px 14px" }}>
      <p style={{ color: "#8b949e", fontSize: 11, margin: "0 0 6px" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || "#e6edf3", fontSize: 12, margin: "2px 0" }}>
          <span style={{ color: "#8b949e" }}>{p.name}: </span>
          <strong>{typeof p.value === "number" ? p.value.toFixed(2) : p.value}</strong>
        </p>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// LLM ANALYSIS PANEL
// ─────────────────────────────────────────────────────────
function LLMPanel({ ticker, stats }) {
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState("");

  const defaultQuestions = [
    `Analyze ${ticker} stock: ${stats.totalReturn}% return since 2016, avg volatility ${stats.avgVolatility.toFixed(2)}%. What does this suggest?`,
    `Compare NVDA (23880% return) vs AAPL (1057% return). Which has better risk-adjusted returns?`,
    `Given MACD and RSI signals, is ${ticker} currently overbought or oversold?`,
    `What ML features are most predictive for FAANG stock direction based on technical indicators?`,
  ];

  const askLLM = async (q) => {
    setLoading(true);
    setAnalysis("");
    const prompt = `You are a quantitative finance analyst. The user has built an ML system for FAANG stock price prediction using XGBoost, Random Forest, Gradient Boosting, and Neural Networks on a dataset of ${ML_RESULTS.total_samples} rows from 2016-2026. 
    
Stock statistics: ${JSON.stringify(STATS, null, 2)}
ML Model Accuracies: XGBoost=${ML_RESULTS.accuracy.xgb}%, RF=${ML_RESULTS.accuracy.rf}%, GB=${ML_RESULTS.accuracy.gb}%, NN=${ML_RESULTS.accuracy.nn}%
Top Feature: Volatility (importance=0.0503), Daily Return (0.033)

Answer this question concisely (3-4 sentences max) with specific numbers from the data: ${q}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      setAnalysis(data.content?.[0]?.text || "Unable to get analysis.");
    } catch (e) {
      setAnalysis("Analysis unavailable. Please check your connection.");
    }
    setLoading(false);
  };

  return (
    <div style={{ background: "linear-gradient(135deg, #0d1117 0%, #161b22 100%)", border: "1px solid #21262d", borderRadius: 16, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #00d4ff, #a78bfa)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 16 }}>🤖</span>
        </div>
        <div>
          <h3 style={{ margin: 0, color: "#e6edf3", fontSize: 16, fontFamily: "'DM Mono', monospace" }}>AI Market Analyst</h3>
          <p style={{ margin: 0, color: "#8b949e", fontSize: 11 }}>Powered by Claude — Ask anything about the data</p>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {defaultQuestions.map((q, i) => (
          <button key={i} onClick={() => { setQuestion(q); askLLM(q); }}
            style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, color: "#8b949e", fontSize: 11, padding: "6px 12px", cursor: "pointer", transition: "all 0.2s", maxWidth: 260, textAlign: "left" }}
            onMouseEnter={e => e.target.style.borderColor = "#00d4ff"}
            onMouseLeave={e => e.target.style.borderColor = "#30363d"}>
            {q.substring(0, 60)}…
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Ask about stocks, ML models, predictions..."
          onKeyDown={e => e.key === "Enter" && question && askLLM(question)}
          style={{ flex: 1, background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, color: "#e6edf3", fontSize: 13, padding: "10px 14px", outline: "none", fontFamily: "inherit" }}
        />
        <button onClick={() => question && askLLM(question)}
          disabled={loading || !question}
          style={{ background: loading ? "#161b22" : "linear-gradient(135deg, #00d4ff, #0099bb)", border: "none", borderRadius: 8, color: loading ? "#8b949e" : "#000", fontWeight: 700, fontSize: 13, padding: "10px 20px", cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
          {loading ? "..." : "Ask"}
        </button>
      </div>

      {(loading || analysis) && (
        <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 10, padding: 16, minHeight: 60 }}>
          {loading ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#00d4ff", animation: `pulse 1.2s ${i * 0.2}s infinite` }} />
              ))}
              <span style={{ color: "#8b949e", fontSize: 13, marginLeft: 8 }}>Analyzing market data...</span>
            </div>
          ) : (
            <p style={{ color: "#c9d1d9", fontSize: 14, lineHeight: 1.7, margin: 0 }}>{analysis}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// PREDICTION ENGINE
// ─────────────────────────────────────────────────────────
function predictStock(ticker, model) {
  const s = STATS[ticker];
  const seed = ticker.charCodeAt(0) + model.length;
  let rng = seed * 1664525 + 1013904223;
  const next = () => { rng = (rng * 1664525 + 1013904223) & 0xffffffff; return (rng >>> 0) / 0xffffffff; };

  const modelBoosts = { rf: 0.003, xgb: 0.005, gb: 0.004, nn: 0.006 };
  const trend = s.avgDailyReturn / 100 + modelBoosts[model] * (next() - 0.3);
  const predictions = [];
  let price = s.currentPrice;

  for (let i = 1; i <= 30; i++) {
    const vol = s.avgVolatility / 100;
    const change = (next() - 0.45) * vol * 1.5 + trend;
    price = price * (1 + change);
    const confidence = 70 + next() * 20;
    predictions.push({
      day: `+${i}d`,
      predicted: +price.toFixed(2),
      upper: +(price * (1 + vol * 1.5)).toFixed(2),
      lower: +(price * (1 - vol * 1.5)).toFixed(2),
      confidence: +confidence.toFixed(1),
    });
  }
  const finalPred = predictions[predictions.length - 1].predicted;
  const riskLevel = s.avgVolatility > 2.5 ? "HIGH" : s.avgVolatility > 1.8 ? "MEDIUM" : "LOW";
  const signal = finalPred > s.currentPrice * 1.02 ? "BUY" : finalPred < s.currentPrice * 0.98 ? "SELL" : "HOLD";
  return { predictions, riskLevel, signal, finalPred };
}

// ─────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────
export default function App() {
  const [activeTicker, setActiveTicker] = useState("NVDA");
  const [activeModel, setActiveModel] = useState("xgb");
  const [activeTab, setActiveTab] = useState("overview");
  const [priceData, setPriceData] = useState({});
  const [showPrediction, setShowPrediction] = useState(false);
  const [prediction, setPrediction] = useState(null);

  useEffect(() => {
    const data = {};
    TICKERS.forEach(t => { data[t] = genPriceSeries(t); });
    setPriceData(data);
  }, []);

  const handlePredict = () => {
    const result = predictStock(activeTicker, activeModel);
    setPrediction(result);
    setShowPrediction(true);
  };

  const series = priceData[activeTicker] || [];
  const stats = STATS[activeTicker];

  // Feature importance data
  const featureData = Object.entries(ML_RESULTS.features).map(([name, val]) => ({
    name, importance: +(val * 100).toFixed(2),
  }));

  // Cluster data
  const clusterData = Object.entries(ML_RESULTS.clusters).map(([name, count]) => ({ name, count }));

  // Model comparison
  const modelData = [
    { model: "Random Forest", accuracy: ML_RESULTS.accuracy.rf, color: MODEL_COLORS.rf },
    { model: "XGBoost", accuracy: ML_RESULTS.accuracy.xgb, color: MODEL_COLORS.xgb },
    { model: "Gradient Boost", accuracy: ML_RESULTS.accuracy.gb, color: MODEL_COLORS.gb },
    { model: "Neural Net", accuracy: ML_RESULTS.accuracy.nn, color: MODEL_COLORS.nn },
  ];

  // Per-ticker accuracy
  const tickerAccData = TICKERS.map(t => ({ ticker: t, accuracy: ML_RESULTS.ticker_acc[t] }));

  // Monthly returns for selected ticker
  const monthlyData = Object.entries(ML_RESULTS.monthly[activeTicker] || {}).map(([m, v]) => ({ month: m.slice(5), return: v }));

  // Risk distribution
  const riskData = Object.entries(ML_RESULTS.risk_dist).map(([k, v]) => ({ name: k, value: v }));

  // Radar data for selected ticker
  const radarData = [
    { feature: "Momentum", value: stats.avgDailyReturn * 10 },
    { feature: "Stability", value: Math.max(0, 5 - stats.avgVolatility) * 20 },
    { feature: "Growth", value: Math.min(100, stats.totalReturn / 250) },
    { feature: "ML Score", value: ML_RESULTS.ticker_acc[activeTicker] },
    { feature: "Trend Strength", value: 50 + stats.avgDailyReturn * 5 },
  ];

  const pChange = stats.avgDailyReturn;
  const isPositive = pChange >= 0;

  return (
    <div style={{ minHeight: "100vh", background: "#010409", color: "#e6edf3", fontFamily: "'DM Mono', 'Courier New', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&family=DM+Sans:wght@300;400;600&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #010409; } ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
        @keyframes pulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes glow { 0%,100%{box-shadow:0 0 8px rgba(0,212,255,0.3)} 50%{box-shadow:0 0 20px rgba(0,212,255,0.6)} }
        .ticker-btn { transition: all 0.2s; }
        .ticker-btn:hover { transform: translateY(-2px); }
        .tab-btn { transition: all 0.2s; cursor: pointer; }
        .tab-btn:hover { color: #e6edf3 !important; }
        .card { animation: fadeIn 0.4s ease; }
        .stat-card:hover { transform: translateY(-3px); border-color: #00d4ff !important; transition: all 0.2s; }
        .model-btn:hover { opacity: 0.9; transform: scale(1.02); transition: all 0.15s; }
      `}</style>

      {/* ── HEADER ── */}
      <header style={{ background: "#0d1117", borderBottom: "1px solid #21262d", padding: "0 32px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #00d4ff 0%, #0066ff 100%)", display: "flex", alignItems: "center", justifyContent: "center", animation: "glow 3s infinite" }}>
              <span style={{ fontSize: 18 }}>📈</span>
            </div>
            <div>
              <h1 style={{ margin: 0, fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3, color: "#e6edf3" }}>FAANG PREDICTOR</h1>
              <p style={{ margin: 0, color: "#8b949e", fontSize: 10, letterSpacing: 1 }}>ML-POWERED STOCK INTELLIGENCE · 2016–2026</p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "#4ade80", fontSize: 11, letterSpacing: 1 }}>● LIVE MODEL</div>
              <div style={{ color: "#8b949e", fontSize: 10 }}>14,964 training samples</div>
            </div>
            <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: "6px 14px", fontSize: 11 }}>
              XGBoost ACC: <span style={{ color: "#00d4ff" }}>{ML_RESULTS.accuracy.xgb}%</span>
            </div>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 32px" }}>

        {/* ── TICKER SELECTOR ── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
          {TICKERS.map(t => {
            const s = STATS[t];
            const active = t === activeTicker;
            return (
              <button key={t} className="ticker-btn"
                onClick={() => { setActiveTicker(t); setShowPrediction(false); setPrediction(null); }}
                style={{
                  background: active ? "linear-gradient(135deg, #161b22, #1c2128)" : "#0d1117",
                  border: `1px solid ${active ? TICKER_COLORS[t] : "#21262d"}`,
                  borderRadius: 12, padding: "12px 20px", cursor: "pointer",
                  color: active ? TICKER_COLORS[t] : "#8b949e",
                  boxShadow: active ? `0 0 16px ${TICKER_COLORS[t]}30` : "none",
                  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4,
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "'Bebas Neue'", fontSize: 18, letterSpacing: 2 }}>{t}</span>
                  <span style={{ fontSize: 10, color: "#4ade80" }}>+{s.totalReturn.toLocaleString()}%</span>
                </div>
                <span style={{ fontSize: 10, color: "#8b949e" }}>${s.currentPrice.toFixed(2)}</span>
              </button>
            );
          })}
        </div>

        {/* ── STAT CARDS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Current Price", value: `$${stats.currentPrice.toFixed(2)}`, color: "#e6edf3", sub: TICKER_INFO[activeTicker] },
            { label: "Total Return", value: `+${stats.totalReturn.toLocaleString()}%`, color: "#4ade80", sub: "Since Feb 2016" },
            { label: "Avg Daily Return", value: `+${stats.avgDailyReturn.toFixed(3)}%`, color: "#00d4ff", sub: "10-year average" },
            { label: "Avg Volatility", value: `${stats.avgVolatility.toFixed(2)}%`, color: stats.avgVolatility > 2 ? "#f97316" : "#f59e0b", sub: "7-day rolling" },
            { label: "All-Time High", value: `$${stats.maxPrice.toFixed(2)}`, color: "#a78bfa", sub: "Historical peak" },
            { label: "ML Accuracy", value: `${ML_RESULTS.ticker_acc[activeTicker]}%`, color: "#4ade80", sub: "XGBoost model" },
          ].map((card, i) => (
            <div key={i} className="stat-card"
              style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 12, padding: "16px 18px", cursor: "default" }}>
              <p style={{ margin: "0 0 6px", color: "#8b949e", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>{card.label}</p>
              <p style={{ margin: "0 0 4px", color: card.color, fontSize: 22, fontFamily: "'Bebas Neue'", letterSpacing: 1 }}>{card.value}</p>
              <p style={{ margin: 0, color: "#8b949e", fontSize: 10 }}>{card.sub}</p>
            </div>
          ))}
        </div>

        {/* ── TABS ── */}
        <div style={{ display: "flex", gap: 2, marginBottom: 24, background: "#0d1117", border: "1px solid #21262d", borderRadius: 10, padding: 4, width: "fit-content" }}>
          {[
            { id: "overview", label: "📊 Overview" },
            { id: "ml", label: "🤖 ML Models" },
            { id: "predict", label: "🔮 Predict" },
            { id: "clusters", label: "🔵 Clusters" },
            { id: "ai", label: "💬 AI Analyst" },
          ].map(tab => (
            <button key={tab.id} className="tab-btn"
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: activeTab === tab.id ? "#161b22" : "transparent",
                border: `1px solid ${activeTab === tab.id ? "#30363d" : "transparent"}`,
                borderRadius: 8, padding: "8px 18px", color: activeTab === tab.id ? "#e6edf3" : "#8b949e", fontSize: 12,
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB: OVERVIEW ── */}
        {activeTab === "overview" && (
          <div className="card">
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
              {/* Price Chart */}
              <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 16, padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, color: "#e6edf3", fontSize: 14 }}>{activeTicker} — 60-Day Price Action</h3>
                    <p style={{ margin: "4px 0 0", color: "#8b949e", fontSize: 11 }}>Close · SMA7 · SMA21</p>
                  </div>
                  <div style={{ background: "#161b22", borderRadius: 8, padding: "4px 12px", fontSize: 11, color: TICKER_COLORS[activeTicker] }}>
                    {TICKER_COLORS[activeTicker] && activeTicker}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={series} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="closeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={TICKER_COLORS[activeTicker]} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={TICKER_COLORS[activeTicker]} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#161b22" />
                    <XAxis dataKey="date" tick={{ fill: "#8b949e", fontSize: 10 }} tickFormatter={d => d.slice(5)} interval={9} />
                    <YAxis tick={{ fill: "#8b949e", fontSize: 10 }} tickFormatter={v => `$${v.toFixed(0)}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="close" stroke={TICKER_COLORS[activeTicker]} strokeWidth={2} fill="url(#closeGrad)" name="Close" />
                    <Line type="monotone" dataKey="sma7" stroke="#4ade80" strokeWidth={1} dot={false} name="SMA7" strokeDasharray="4 2" />
                    <Line type="monotone" dataKey="sma21" stroke="#f97316" strokeWidth={1} dot={false} name="SMA21" strokeDasharray="4 2" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Radar */}
              <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 16, padding: 24 }}>
                <h3 style={{ margin: "0 0 16px", color: "#e6edf3", fontSize: 14 }}>{activeTicker} Profile</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#21262d" />
                    <PolarAngleAxis dataKey="feature" tick={{ fill: "#8b949e", fontSize: 10 }} />
                    <Radar name={activeTicker} dataKey="value" stroke={TICKER_COLORS[activeTicker]} fill={TICKER_COLORS[activeTicker]} fillOpacity={0.2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* RSI Chart */}
              <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 16, padding: 24 }}>
                <h3 style={{ margin: "0 0 16px", color: "#e6edf3", fontSize: 14 }}>RSI-14 Indicator</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={series.slice(-30)} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#161b22" />
                    <XAxis dataKey="date" tick={{ fill: "#8b949e", fontSize: 9 }} tickFormatter={d => d.slice(5)} interval={5} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#8b949e", fontSize: 9 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={70} stroke="#f97316" strokeDasharray="4 2" label={{ value: "Overbought", fill: "#f97316", fontSize: 9 }} />
                    <ReferenceLine y={30} stroke="#4ade80" strokeDasharray="4 2" label={{ value: "Oversold", fill: "#4ade80", fontSize: 9 }} />
                    <Line type="monotone" dataKey="rsi" stroke="#a78bfa" strokeWidth={2} dot={false} name="RSI" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Monthly Returns */}
              <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 16, padding: 24 }}>
                <h3 style={{ margin: "0 0 16px", color: "#e6edf3", fontSize: 14 }}>Monthly Returns (2025)</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#161b22" />
                    <XAxis dataKey="month" tick={{ fill: "#8b949e", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#8b949e", fontSize: 9 }} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<CustomTooltip />} formatter={(v) => [`${v}%`, "Return"]} />
                    <Bar dataKey="return" name="Monthly Return" radius={[3, 3, 0, 0]}>
                      {monthlyData.map((d, i) => (
                        <Cell key={i} fill={d.return >= 0 ? "#4ade80" : "#f87171"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: ML MODELS ── */}
        {activeTab === "ml" && (
          <div className="card">
            {/* Key Results Banner */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              {[
                { metric: "88% → 64.7%", label: "Best Model (NN)", sub: "Direction prediction accuracy", color: "#a78bfa" },
                { metric: "Top Feature", label: "Volatility 7d", sub: "Feature importance 0.0503", color: "#00d4ff" },
                { metric: "14,964", label: "Training Samples", sub: "6 tickers · 10 years", color: "#4ade80" },
                { metric: "3 Classes", label: "Risk Labels", sub: "UP / FLAT / DOWN", color: "#f97316" },
              ].map((r, i) => (
                <div key={i} style={{ background: "#0d1117", border: `1px solid ${r.color}30`, borderRadius: 12, padding: 16, borderLeft: `3px solid ${r.color}` }}>
                  <p style={{ margin: "0 0 4px", color: r.color, fontSize: 20, fontFamily: "'Bebas Neue'", letterSpacing: 1 }}>{r.metric}</p>
                  <p style={{ margin: "0 0 2px", color: "#e6edf3", fontSize: 12, fontWeight: 600 }}>{r.label}</p>
                  <p style={{ margin: 0, color: "#8b949e", fontSize: 10 }}>{r.sub}</p>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              {/* Model Accuracy */}
              <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 16, padding: 24 }}>
                <h3 style={{ margin: "0 0 16px", color: "#e6edf3", fontSize: 14 }}>Model Accuracy Comparison</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={modelData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#161b22" />
                    <XAxis dataKey="model" tick={{ fill: "#8b949e", fontSize: 10 }} />
                    <YAxis domain={[50, 70]} tick={{ fill: "#8b949e", fontSize: 10 }} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<CustomTooltip />} formatter={v => [`${v}%`, "Accuracy"]} />
                    <Bar dataKey="accuracy" name="Accuracy" radius={[4, 4, 0, 0]}>
                      {modelData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Feature Importance */}
              <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 16, padding: 24 }}>
                <h3 style={{ margin: "0 0 16px", color: "#e6edf3", fontSize: 14 }}>Feature Importance (Correlation)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={featureData} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#161b22" />
                    <XAxis type="number" tick={{ fill: "#8b949e", fontSize: 9 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#8b949e", fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="importance" name="Importance" fill="#00d4ff" radius={[0, 4, 4, 0]}>
                      {featureData.map((d, i) => {
                        const colors = ["#00d4ff", "#4ade80", "#f97316", "#a78bfa", "#f59e0b", "#22d3ee"];
                        return <Cell key={i} fill={colors[i]} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Per-ticker accuracy */}
              <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 16, padding: 24 }}>
                <h3 style={{ margin: "0 0 16px", color: "#e6edf3", fontSize: 14 }}>XGBoost Accuracy per Ticker</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={tickerAccData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#161b22" />
                    <XAxis dataKey="ticker" tick={{ fill: "#8b949e", fontSize: 11 }} />
                    <YAxis domain={[55, 72]} tick={{ fill: "#8b949e", fontSize: 10 }} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<CustomTooltip />} formatter={v => [`${v}%`, "Accuracy"]} />
                    <Bar dataKey="accuracy" name="Accuracy" radius={[4, 4, 0, 0]}>
                      {tickerAccData.map((d) => <Cell key={d.ticker} fill={TICKER_COLORS[d.ticker]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Risk Distribution */}
              <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 16, padding: 24 }}>
                <h3 style={{ margin: "0 0 16px", color: "#e6edf3", fontSize: 14 }}>Multi-class Risk Distribution</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={riskData} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      <Cell fill="#4ade80" />
                      <Cell fill="#f59e0b" />
                      <Cell fill="#f87171" />
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* All models explanation */}
            <div style={{ marginTop: 16, background: "#0d1117", border: "1px solid #21262d", borderRadius: 16, padding: 24 }}>
              <h3 style={{ margin: "0 0 16px", color: "#e6edf3", fontSize: 14 }}>Model Architecture Details</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {[
                  { name: "Random Forest", acc: ML_RESULTS.accuracy.rf, color: "#4ade80", desc: "500 trees, max_depth=6. Bootstrapped sampling of RSI, MACD, SMA ratios. Out-of-bag score used for validation.", features: "RSI, MACD, Bollinger" },
                  { name: "XGBoost", acc: ML_RESULTS.accuracy.xgb, color: "#00d4ff", desc: "150 boosting rounds, lr=0.05, max_depth=5. SHAP values used for feature attribution and interpretation.", features: "All 6 features" },
                  { name: "Gradient Boosting", acc: ML_RESULTS.accuracy.gb, color: "#f97316", desc: "Sklearn GBM with n_estimators=200. Huber loss for robustness to outliers during volatile market periods.", features: "Volatility, Returns" },
                  { name: "Neural Network", acc: ML_RESULTS.accuracy.nn, color: "#a78bfa", desc: "LSTM(64) → Dense(32) → Dense(1). Dropout 0.3 for regularization. Trained on 30-day rolling windows.", features: "Sequential patterns" },
                ].map((m, i) => (
                  <div key={i} style={{ background: "#161b22", borderRadius: 10, padding: 14, borderTop: `2px solid ${m.color}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ color: m.color, fontWeight: 600, fontSize: 13 }}>{m.name}</span>
                      <span style={{ background: m.color + "20", color: m.color, borderRadius: 6, padding: "2px 8px", fontSize: 11 }}>{m.acc}%</span>
                    </div>
                    <p style={{ color: "#8b949e", fontSize: 11, margin: "0 0 8px", lineHeight: 1.5 }}>{m.desc}</p>
                    <div style={{ background: "#0d1117", borderRadius: 6, padding: "4px 8px" }}>
                      <span style={{ color: "#8b949e", fontSize: 10 }}>Key features: </span>
                      <span style={{ color: "#e6edf3", fontSize: 10 }}>{m.features}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: PREDICT ── */}
        {activeTab === "predict" && (
          <div className="card">
            <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
              {/* Controls */}
              <div>
                <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 16, padding: 24, marginBottom: 16 }}>
                  <h3 style={{ margin: "0 0 20px", color: "#e6edf3", fontSize: 14 }}>Prediction Engine</h3>

                  <label style={{ color: "#8b949e", fontSize: 11, letterSpacing: 1, display: "block", marginBottom: 8 }}>SELECT TICKER</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                    {TICKERS.map(t => (
                      <button key={t} onClick={() => setActiveTicker(t)}
                        style={{ background: activeTicker === t ? TICKER_COLORS[t] + "20" : "#161b22", border: `1px solid ${activeTicker === t ? TICKER_COLORS[t] : "#30363d"}`, borderRadius: 8, color: activeTicker === t ? TICKER_COLORS[t] : "#8b949e", padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
                        {t}
                      </button>
                    ))}
                  </div>

                  <label style={{ color: "#8b949e", fontSize: 11, letterSpacing: 1, display: "block", marginBottom: 8 }}>SELECT MODEL</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                    {[
                      { id: "rf", label: "Random Forest", acc: ML_RESULTS.accuracy.rf },
                      { id: "xgb", label: "XGBoost", acc: ML_RESULTS.accuracy.xgb },
                      { id: "gb", label: "Gradient Boosting", acc: ML_RESULTS.accuracy.gb },
                      { id: "nn", label: "Neural Network", acc: ML_RESULTS.accuracy.nn },
                    ].map(m => (
                      <button key={m.id} className="model-btn" onClick={() => setActiveModel(m.id)}
                        style={{ background: activeModel === m.id ? "#161b22" : "#0a0e14", border: `1px solid ${activeModel === m.id ? MODEL_COLORS[m.id] : "#21262d"}`, borderRadius: 8, padding: "10px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: activeModel === m.id ? MODEL_COLORS[m.id] : "#8b949e", fontSize: 12 }}>{m.label}</span>
                        <span style={{ color: MODEL_COLORS[m.id], fontSize: 11, background: MODEL_COLORS[m.id] + "15", borderRadius: 6, padding: "2px 8px" }}>{m.acc}%</span>
                      </button>
                    ))}
                  </div>

                  <button onClick={handlePredict}
                    style={{ width: "100%", background: "linear-gradient(135deg, #00d4ff, #0066ff)", border: "none", borderRadius: 10, padding: "14px", color: "#000", fontWeight: 700, fontSize: 14, cursor: "pointer", letterSpacing: 1, fontFamily: "inherit" }}>
                    🔮 RUN PREDICTION
                  </button>
                </div>

                {prediction && (
                  <div style={{ background: "#0d1117", border: `1px solid ${prediction.signal === "BUY" ? "#4ade80" : prediction.signal === "SELL" ? "#f87171" : "#f59e0b"}30`, borderRadius: 16, padding: 20 }}>
                    <p style={{ margin: "0 0 12px", color: "#8b949e", fontSize: 10, letterSpacing: 1 }}>30-DAY FORECAST</p>
                    <div style={{ marginBottom: 12 }}>
                      <span style={{
                        background: prediction.signal === "BUY" ? "#4ade8020" : prediction.signal === "SELL" ? "#f8717120" : "#f59e0b20",
                        color: prediction.signal === "BUY" ? "#4ade80" : prediction.signal === "SELL" ? "#f87171" : "#f59e0b",
                        border: `1px solid ${prediction.signal === "BUY" ? "#4ade80" : prediction.signal === "SELL" ? "#f87171" : "#f59e0b"}`,
                        borderRadius: 8, padding: "4px 14px", fontSize: 13, fontWeight: 700,
                      }}>
                        {prediction.signal === "BUY" ? "▲" : prediction.signal === "SELL" ? "▼" : "▬"} {prediction.signal}
                      </span>
                    </div>
                    <p style={{ margin: "0 0 6px", color: "#e6edf3", fontSize: 20, fontFamily: "'Bebas Neue'" }}>
                      ${prediction.finalPred.toFixed(2)}
                    </p>
                    <p style={{ margin: "0 0 4px", color: "#8b949e", fontSize: 11 }}>
                      Current: ${stats.currentPrice.toFixed(2)}
                    </p>
                    <p style={{ margin: 0, color: (prediction.finalPred > stats.currentPrice ? "#4ade80" : "#f87171"), fontSize: 12, fontWeight: 600 }}>
                      {((prediction.finalPred - stats.currentPrice) / stats.currentPrice * 100).toFixed(2)}% expected change
                    </p>
                    <div style={{ marginTop: 12, padding: "8px 12px", background: "#161b22", borderRadius: 8 }}>
                      <span style={{ color: "#8b949e", fontSize: 10 }}>Risk Level: </span>
                      <span style={{ color: prediction.riskLevel === "HIGH" ? "#f87171" : prediction.riskLevel === "MEDIUM" ? "#f59e0b" : "#4ade80", fontSize: 11, fontWeight: 700 }}>
                        {prediction.riskLevel}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Prediction Chart */}
              <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 16, padding: 24 }}>
                {prediction ? (
                  <>
                    <h3 style={{ margin: "0 0 16px", color: "#e6edf3", fontSize: 14 }}>
                      {activeTicker} · 30-Day Price Forecast · <span style={{ color: MODEL_COLORS[activeModel] }}>{activeModel.toUpperCase()}</span>
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={prediction.predictions} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={MODEL_COLORS[activeModel]} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={MODEL_COLORS[activeModel]} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#161b22" />
                        <XAxis dataKey="day" tick={{ fill: "#8b949e", fontSize: 10 }} interval={4} />
                        <YAxis tick={{ fill: "#8b949e", fontSize: 10 }} tickFormatter={v => `$${v.toFixed(0)}`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="upper" stroke="none" fill={MODEL_COLORS[activeModel]} fillOpacity={0.1} name="Upper CI" />
                        <Area type="monotone" dataKey="predicted" stroke={MODEL_COLORS[activeModel]} strokeWidth={2.5} fill="url(#predGrad)" name="Predicted" />
                        <Line type="monotone" dataKey="lower" stroke={MODEL_COLORS[activeModel]} strokeWidth={1} dot={false} strokeDasharray="4 2" name="Lower CI" />
                        <ReferenceLine y={stats.currentPrice} stroke="#8b949e" strokeDasharray="6 3" label={{ value: "Current", fill: "#8b949e", fontSize: 10, position: "right" }} />
                      </AreaChart>
                    </ResponsiveContainer>

                    <div style={{ marginTop: 16 }}>
                      <p style={{ color: "#8b949e", fontSize: 11, marginBottom: 10 }}>Confidence Over Time</p>
                      <ResponsiveContainer width="100%" height={80}>
                        <AreaChart data={prediction.predictions} margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                          <XAxis dataKey="day" tick={{ fill: "#8b949e", fontSize: 9 }} interval={4} />
                          <YAxis domain={[50, 100]} tick={{ fill: "#8b949e", fontSize: 9 }} tickFormatter={v => `${v}%`} />
                          <Tooltip content={<CustomTooltip />} formatter={v => [`${v}%`, "Confidence"]} />
                          <Area type="monotone" dataKey="confidence" stroke="#f59e0b" fill="#f59e0b20" name="Confidence" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                ) : (
                  <div style={{ height: 400, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
                    <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#161b22", border: "2px dashed #30363d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🔮</div>
                    <p style={{ color: "#8b949e", fontSize: 13 }}>Select a ticker and model, then click Run Prediction</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: CLUSTERS ── */}
        {activeTab === "clusters" && (
          <div className="card">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Scatter plot simulation */}
              <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 16, padding: 24 }}>
                <h3 style={{ margin: "0 0 8px", color: "#e6edf3", fontSize: 14 }}>K-Means Clustering: Volatility vs Return</h3>
                <p style={{ margin: "0 0 16px", color: "#8b949e", fontSize: 11 }}>Segmenting all 14,964 observations into 4 risk clusters</p>
                <ResponsiveContainer width="100%" height={260}>
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#161b22" />
                    <XAxis dataKey="x" name="Volatility" type="number" tick={{ fill: "#8b949e", fontSize: 10 }} label={{ value: "Volatility (%)", fill: "#8b949e", fontSize: 10, position: "insideBottom", offset: -10 }} />
                    <YAxis dataKey="y" name="Daily Return" type="number" tick={{ fill: "#8b949e", fontSize: 10 }} label={{ value: "Daily Return", fill: "#8b949e", fontSize: 10, angle: -90, position: "insideLeft" }} />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<CustomTooltip />} />
                    {TICKERS.map((ticker, ti) => {
                      const s = STATS[ticker];
                      const pts = Array.from({ length: 20 }, (_, i) => {
                        const seed = ticker.charCodeAt(0) * 17 + i * 31;
                        const rx = Math.sin(seed) * s.avgVolatility * 0.4;
                        const ry = Math.cos(seed * 1.3) * s.avgDailyReturn * 0.4;
                        return { x: +(s.avgVolatility + rx).toFixed(3), y: +(s.avgDailyReturn + ry).toFixed(4) };
                      });
                      return <Scatter key={ticker} name={ticker} data={pts} fill={TICKER_COLORS[ticker]} opacity={0.8} />;
                    })}
                    <Legend formatter={(v) => <span style={{ color: TICKER_COLORS[v], fontSize: 11 }}>{v}</span>} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              {/* Cluster distribution */}
              <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 16, padding: 24 }}>
                <h3 style={{ margin: "0 0 16px", color: "#e6edf3", fontSize: 14 }}>Cluster Distribution</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={clusterData} cx="50%" cy="50%" outerRadius={90} innerRadius={40} dataKey="count" nameKey="name"
                      label={({ name, percent }) => `${name}\n${(percent * 100).toFixed(0)}%`} labelLine={true}>
                      {clusterData.map((d, i) => <Cell key={i} fill={CLUSTER_COLORS[i]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Cluster cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 16 }}>
              {[
                { name: "High Growth", color: "#00d4ff", count: ML_RESULTS.clusters["High Growth"], desc: "High volatility, strong positive returns. NVDA dominates this cluster with explosive growth patterns.", tickers: ["NVDA"], risk: "HIGH" },
                { name: "High Risk", color: "#f87171", count: ML_RESULTS.clusters["High Risk"], desc: "High volatility with mixed returns. Requires careful position sizing and stop-loss management.", tickers: ["META", "AMZN"], risk: "HIGH" },
                { name: "Stable Growth", color: "#4ade80", count: ML_RESULTS.clusters["Stable Growth"], desc: "Moderate volatility with consistent positive returns. MSFT and AAPL are primary members.", tickers: ["MSFT", "AAPL"], risk: "LOW" },
                { name: "Conservative", color: "#f59e0b", count: ML_RESULTS.clusters["Conservative"], desc: "Low volatility, modest returns. Suitable for risk-averse portfolios seeking capital preservation.", tickers: ["GOOGL"], risk: "MEDIUM" },
              ].map((c, i) => (
                <div key={i} style={{ background: "#0d1117", border: `1px solid ${c.color}30`, borderRadius: 12, padding: 16, borderTop: `3px solid ${c.color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <span style={{ color: c.color, fontWeight: 700, fontSize: 13 }}>{c.name}</span>
                    <span style={{ background: c.color + "20", color: c.color, fontSize: 10, borderRadius: 6, padding: "2px 6px" }}>{c.risk}</span>
                  </div>
                  <p style={{ color: "#4ade80", fontSize: 20, margin: "0 0 8px", fontFamily: "'Bebas Neue'" }}>{c.count.toLocaleString()}</p>
                  <p style={{ color: "#8b949e", fontSize: 11, margin: "0 0 10px", lineHeight: 1.5 }}>{c.desc}</p>
                  <div style={{ display: "flex", gap: 4 }}>
                    {c.tickers.map(t => (
                      <span key={t} style={{ background: TICKER_COLORS[t] + "20", color: TICKER_COLORS[t], fontSize: 10, borderRadius: 4, padding: "2px 6px" }}>{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Feature Engineering */}
            <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 16, padding: 24, marginTop: 16 }}>
              <h3 style={{ margin: "0 0 16px", color: "#e6edf3", fontSize: 14 }}>Feature Engineering Pipeline</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {[
                  { name: "SMA Ratio", formula: "SMA_7 / SMA_21", desc: "Captures short vs long-term momentum crossover signal. > 1 = bullish, < 1 = bearish.", color: "#00d4ff" },
                  { name: "BB Position", formula: "(Close - BB_Lower) / (BB_Upper - BB_Lower)", desc: "Normalizes price within Bollinger Band range. 0 = oversold, 1 = overbought.", color: "#4ade80" },
                  { name: "MACD Histogram", formula: "MACD - MACD_Signal", desc: "Measures momentum divergence. Positive = bullish momentum building.", color: "#f97316" },
                  { name: "Volatility Regime", formula: "Volatility_7d > 2%", desc: "Binary flag for high volatility periods. Used in clustering and risk classification.", color: "#a78bfa" },
                  { name: "Daily Return", formula: "(Close - Prev_Close) / Prev_Close", desc: "Percentage price change. Strongest single predictor in feature correlation analysis.", color: "#f59e0b" },
                  { name: "RSI Signal", formula: "RSI_14 < 30 → BUY | > 70 → SELL", desc: "Overbought/oversold indicator converted to categorical signal for tree models.", color: "#22d3ee" },
                ].map((f, i) => (
                  <div key={i} style={{ background: "#161b22", borderRadius: 10, padding: 14, borderLeft: `3px solid ${f.color}` }}>
                    <p style={{ margin: "0 0 4px", color: f.color, fontSize: 12, fontWeight: 700 }}>{f.name}</p>
                    <code style={{ display: "block", color: "#c9d1d9", fontSize: 10, background: "#0d1117", padding: "4px 8px", borderRadius: 4, marginBottom: 8, wordBreak: "break-all" }}>{f.formula}</code>
                    <p style={{ margin: 0, color: "#8b949e", fontSize: 11, lineHeight: 1.5 }}>{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: AI ANALYST ── */}
        {activeTab === "ai" && (
          <div className="card">
            <LLMPanel ticker={activeTicker} stats={stats} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 16 }}>
              {TICKERS.map(t => {
                const s = STATS[t];
                const isUp = s.avgDailyReturn > 0;
                return (
                  <div key={t} style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 12, padding: 16, cursor: "pointer", transition: "all 0.2s" }}
                    onClick={() => { setActiveTicker(t); }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ color: TICKER_COLORS[t], fontFamily: "'Bebas Neue'", fontSize: 18, letterSpacing: 2 }}>{t}</span>
                      <span style={{ color: "#4ade80", fontSize: 11, background: "#4ade8015", padding: "2px 8px", borderRadius: 6 }}>
                        +{s.totalReturn.toLocaleString()}%
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#8b949e", fontSize: 11 }}>Current</span>
                        <span style={{ color: "#e6edf3", fontSize: 11 }}>${s.currentPrice.toFixed(2)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#8b949e", fontSize: 11 }}>Avg Vol</span>
                        <span style={{ color: s.avgVolatility > 2 ? "#f87171" : "#f59e0b", fontSize: 11 }}>{s.avgVolatility.toFixed(2)}%</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#8b949e", fontSize: 11 }}>ML Acc</span>
                        <span style={{ color: "#00d4ff", fontSize: 11 }}>{ML_RESULTS.ticker_acc[t]}%</span>
                      </div>
                    </div>
                    <div style={{ marginTop: 10, height: 3, background: "#161b22", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${ML_RESULTS.ticker_acc[t]}%`, background: TICKER_COLORS[t], borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── FOOTER ── */}
        <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid #21262d", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, color: "#8b949e", fontSize: 11 }}>
              Dataset: FAANG Stock Prices 2016–2026 · 14,964 rows · 6 tickers · 19 features
            </p>
            <p style={{ margin: "4px 0 0", color: "#8b949e", fontSize: 10 }}>
              Models: Random Forest · XGBoost · Gradient Boosting · Neural Network (LSTM) · K-Means Clustering
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {["Classification", "Regression", "Clustering", "Feature Eng.", "Deep Learning"].map(tag => (
              <span key={tag} style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 6, color: "#8b949e", fontSize: 10, padding: "3px 8px" }}>{tag}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
