import { useState, useEffect } from "react";

const SYSTEM_PROMPT = `You are an elite Wyckoff Market Technician combining Wyckoff Method, Smart Money Concepts, Volume Profile, and 4C MACD. Apply this 10-filter framework:

FILTER 1 - HTF Bias: Weekly/Monthly MACD direction = master trend. Only trade aligned with it.
FILTER 2 - Wyckoff Phase (4H): Identify phase and key event (SC/AR/ST/Spring/LPS/SOS/BU or BC/UT/UTAD/LPSY/SOW)
FILTER 3 - Liquidity: Equal Highs/Lows swept? FVG filled? Orderblock respected?
FILTER 4 - Volume Profile: Entry at VAL/POC? Target at VAH?
FILTER 5 - 4C MACD Divergence: Price lower low + MACD higher low (bullish) or vice versa. Entry on color shift Dark Red→Light Red/Green
FILTER 6 - 1H Structure: CHoCH or BOS confirmed?
FILTER 7 - 15M Trigger: Impulse+Correction complete? MACD color changed?
FILTER 8 - Session: London Open (07-10 UTC) or NY Open (12:30-16 UTC) = optimal. Dead zone = reduce confidence -2
FILTER 9 - Correlation: Max 2 correlated positions (BTC/ETH/SOL/BNB all correlated)
FILTER 10 - Risk: Confidence 8-10=1.5% risk, 6-7=1.0%, under 6=0.5% or no trade

WYCKOFF GLOSSARY (always explain terms used in plain language):
SC=Selling Climax (panic sell + volume spike, institutions buy), AR=Automatic Rally (bounce after SC), ST=Secondary Test (return to SC area on low volume), Spring=fake breakdown below range (trap for shorts, best long entry), LPS=Last Point of Support (higher low before breakout), SOS=Sign of Strength (breakout above range with volume), BU=Back-Up (retest of broken resistance), CHoCH=Change of Character (structure shifts direction), BOS=Break of Structure (key level broken), FVG=Fair Value Gap (price imbalance that must be filled), OB=Orderblock (last opposing candle before strong move), POC=Point of Control (most traded price level), VAH/VAL=Value Area High/Low (70% of volume boundary)

RULES:
- If 4H trend and 15M MACD don't align → NO SETUP - TREND DIVERGENCE
- Always explain every Wyckoff term you use in plain language
- Count filters passed (0-10)

Return ONLY valid JSON, no markdown:
{
  "signal": "LONG or SHORT or NO SETUP",
  "no_setup_reason": "string or null",
  "filters_passed": 0,
  "bias_4h": "Bullish/Bearish/Neutral",
  "bias_1h": "Bullish/Bearish/Neutral",
  "wyckoff_phase": "string",
  "wyckoff_event": "string",
  "wyckoff_plain": "plain language explanation of what this means",
  "macd_analysis": "string",
  "liquidity_note": "string",
  "volume_profile_note": "string",
  "session_ok": true,
  "correlation_warning": "string or null",
  "entry": "string",
  "stop": "string",
  "stop_reason": "string",
  "tp1": "string",
  "tp1_reason": "string",
  "tp2": "string",
  "tp2_reason": "string",
  "rrr": "string",
  "risk_pct": "string",
  "confidence": 0,
  "invalidation": "string",
  "narrative": "3-4 sentences explaining the full setup with all Wyckoff terms explained inline in plain language"
}`;

const store = {
  get: async (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: async (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

const SIG = {
  LONG:  { bg:"#071a0f", border:"#00e676", text:"#00e676" },
  SHORT: { bg:"#1a0707", border:"#ff1744", text:"#ff1744" },
  "NO SETUP": { bg:"#130e00", border:"#ffab00", text:"#ffab00" },
};

const getSession = () => {
  const h = new Date().getUTCHours();
  if (h >= 7 && h < 10)  return { label:"🟢 LONDON OPEN", good:true };
  if (h >= 10 && h < 12) return { label:"🔵 LONDON", good:true };
  if (h >= 12 && h < 16) return { label:"🟢 NEW YORK OPEN", good:true };
  if (h >= 16 && h < 21) return { label:"🔵 NEW YORK", good:true };
  return { label:"🔴 DEAD ZONE", good:false };
};

export default function SignalBot() {
  const [proxyUrl, setProxyUrl] = useState("");
  const [proxyOk, setProxyOk]   = useState(false);
  const [pair, setPair]         = useState("BTCUSDT");
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [running, setRunning]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState("");
  const [tab, setTab]           = useState("input");
  const [history, setHistory]   = useState([]);

  // inputs
  const [f4h, setF4h]   = useState("");
  const [f1h, setF1h]   = useState("");
  const [f15m, setF15m] = useState("");
  const [eqH, setEqH]   = useState("");
  const [eqL, setEqL]   = useState("");
  const [fvg, setFvg]   = useState("");
  const [ob, setOb]     = useState("");
  const [poc, setPoc]   = useState("");
  const [vah, setVah]   = useState("");
  const [val_, setVal]  = useState("");
  const [open_, setOpen] = useState("");

  const session = getSession();

  useEffect(() => {
    store.get("proxy").then(v => { if(v){ setProxyUrl(v); setProxyOk(true); }});
    store.get("history").then(v => { if(v) setHistory(v); });
  }, []);

  const saveProxy = () => {
    if (!proxyUrl.trim()) return;
    store.set("proxy", proxyUrl.trim());
    setProxyOk(true);
    setError("");
  };

  const fetchKlines = async (symbol, interval, limit = 180) => {
    const url = `${proxyUrl.trim()}/?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Proxy ${res.status}`);
    return await res.json();
  };

  const summarize = (candles) => {
    if (!candles || candles.length < 10) return null;
    const cl = candles.map(c => parseFloat(c[4]));
    const hi = candles.map(c => parseFloat(c[2]));
    const lo = candles.map(c => parseFloat(c[3]));
    const vo = candles.map(c => parseFloat(c[5]));
    const avgVol = vo.reduce((a,b)=>a+b,0)/vo.length;
    const last = cl[cl.length-1];
    const h20 = Math.max(...hi.slice(-20));
    const l20 = Math.min(...lo.slice(-20));
    const h60 = Math.max(...hi.slice(-60));
    const l60 = Math.min(...lo.slice(-60));
    const volRatio = (vo[vo.length-1]/avgVol).toFixed(2);
    const ema = (arr, p) => arr.reduce((acc,v,i) => i===0?v:v*(2/(p+1))+acc*(1-2/(p+1)), arr[0]);
    const macd = (ema(cl,12)-ema(cl,26)).toFixed(2);
    return { last, h20, l20, h60, l60, volRatio, macd, n:candles.length };
  };

  const loadLive = async () => {
    if (!proxyOk) { setError("Proxy URL zuerst speichern"); return; }
    setLoading(true); setError(""); setLiveData(null);
    try {
      const [c4h, c1h, c15m] = await Promise.all([
        fetchKlines(pair, "4h", 180),
        fetchKlines(pair, "1h", 180),
        fetchKlines(pair, "15m", 180),
      ]);
      setLiveData({ "4h": summarize(c4h), "1h": summarize(c1h), "15m": summarize(c15m) });
    } catch(e) { setError("Fetch Fehler: " + e.message); }
    setLoading(false);
  };

  const run = async () => {
    setRunning(true); setResult(null); setError(""); setTab("result");

    let liveCtx = "";
    if (liveData) {
      const d4 = liveData["4h"], d1 = liveData["1h"], d15 = liveData["15m"];
      liveCtx = `
LIVE BINANCE DATA (${pair}, 180 candles each):
4H:  Close=$${d4?.last} | Range: $${d4?.l20}–$${d4?.h20} | Vol ratio: ${d4?.volRatio}x | MACD approx: ${d4?.macd}
1H:  Close=$${d1?.last} | Range: $${d1?.l20}–$${d1?.h20} | Vol ratio: ${d1?.volRatio}x | MACD approx: ${d1?.macd}
15M: Close=$${d15?.last} | Range: $${d15?.l20}–$${d15?.h20} | Vol ratio: ${d15?.volRatio}x | MACD approx: ${d15?.macd}`;
    }

    const msg = `Analyze ${pair} with all 10 filters.

SESSION: ${session.label} (UTC: ${new Date().getUTCHours()}h)
${liveCtx}

CHART OBSERVATIONS:
4H Wyckoff + MACD 4C: ${f4h || "Not provided"}
1H Structure CHoCH/BOS: ${f1h || "Not provided"}
15M Trigger + MACD color: ${f15m || "Not provided"}

LIQUIDITY:
Equal Highs: ${eqH || "Not observed"}
Equal Lows: ${eqL || "Not observed"}
FVG: ${fvg || "Not observed"}
Orderblock: ${ob || "Not observed"}

VOLUME PROFILE:
POC: ${poc || "Not provided"}
VAH: ${vah || "Not provided"}
VAL: ${val_ || "Not provided"}

OPEN POSITIONS: ${open_ || "None"}

Score each filter. Return signal only if 6+ filters pass.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: msg }]
        })
      });
      if (!res.ok) throw new Error(`Claude API ${res.status}`);
      const data = await res.json();
      const raw = data.content.map(b => b.text||"").join("").trim().replace(/```json|```/g,"").trim();
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("Kein JSON");
      const parsed = JSON.parse(m[0]);
      setResult(parsed);
      const h = [{ pair, result: parsed, ts: new Date().toLocaleTimeString("de-AT") }, ...history.slice(0,4)];
      setHistory(h);
      store.set("history", h);
    } catch(e) { setError("Fehler: " + e.message); setTab("input"); }
    setRunning(false);
  };

  const s = {
    wrap: { minHeight:"100vh", background:"#07090c", color:"#b8ccd8", fontFamily:"'JetBrains Mono','Courier New',monospace", fontSize:13 },
    inp:  { background:"#0a0f15", border:"1px solid #1a2530", color:"#b8ccd8", padding:"6px 10px", fontFamily:"inherit", fontSize:12, borderRadius:3, outline:"none" },
    ta:   { background:"#060a0d", border:"1px solid #1a2530", color:"#b8ccd8", padding:"7px 10px", fontFamily:"inherit", fontSize:11, borderRadius:3, outline:"none", width:"100%", resize:"vertical", lineHeight:1.6 },
    btn:  (col, active) => ({ background:active?col+"22":"transparent", border:`1px solid ${col}`, color:col, padding:"7px 16px", fontFamily:"inherit", fontSize:10, letterSpacing:2, cursor:"pointer", borderRadius:3, fontWeight:700 }),
    box:  (col) => ({ background:"#060a0d", border:`1px solid ${col||"#1a2530"}`, borderRadius:4, padding:"10px 12px" }),
    lbl:  { fontSize:8, color:"#2a3a4a", letterSpacing:2, marginBottom:3 },
  };

  const confColor = (c) => c >= 8 ? "#00e676" : c >= 6 ? "#ffab00" : "#ff6d00";
  const fpColor = (f) => f >= 8 ? "#00e676" : f >= 6 ? "#ffab00" : "#ff1744";

  return (
    <div style={s.wrap}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Bebas+Neue&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-thumb { background:#1a2530; border-radius:2px; }
        input,select,textarea { font-family:'JetBrains Mono',monospace; outline:none; }
        @keyframes pu { 0%,100%{opacity:1} 50%{opacity:0.3} } .pu { animation:pu 1.2s infinite; }
        @keyframes si { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} } .si { animation:si 0.3s ease-out; }
        .ch:hover { filter:brightness(1.15); }
        select option { background:#0a0f15; }
      `}</style>

      {/* HEADER */}
      <div style={{ background:"#090d12", borderBottom:"1px solid #141e28", padding:"12px 16px", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, letterSpacing:4, color:"#7c4dff" }}>SIGNAL BOT</div>
        <div style={{ color:"#2a2a5a", fontSize:9, letterSpacing:3, marginTop:2 }}>WYCKOFF · SMC · VOLUME PROFILE · 4C MACD · 10 FILTER</div>
        <div style={{ marginLeft:"auto", display:"flex", gap:6, alignItems:"center" }}>
          <span style={{ fontSize:9, padding:"3px 8px", borderRadius:3, background:session.good?"#071a0f":"#1a0707", border:`1px solid ${session.good?"#00e676":"#ff1744"}`, color:session.good?"#00e676":"#ff1744", fontWeight:700 }}>{session.label}</span>
          {liveData && <span style={{ fontSize:9, padding:"3px 8px", borderRadius:3, background:"#071a0f", border:"1px solid #00e676", color:"#00e676" }}>📡 LIVE · {pair} · ${liveData["4h"]?.last?.toLocaleString()}</span>}
          {proxyOk && <span style={{ fontSize:9, padding:"3px 8px", borderRadius:3, background:"#0a1520", border:"1px solid #2a6aad", color:"#4a9ad4" }}>🔧 PROXY OK</span>}
        </div>
      </div>

      {/* TABS */}
      <div style={{ display:"flex", background:"#080b0f", borderBottom:"1px solid #141e28" }}>
        {[["input","📋 EINGABE"],["result","⚡ SIGNAL"],["guide","📚 GUIDE"]].map(([id,l]) => (
          <button key={id} onClick={()=>setTab(id)} style={{ padding:"10px 16px", cursor:"pointer", fontSize:10, letterSpacing:1, fontWeight:700, borderBottom:tab===id?"2px solid #7c4dff":"2px solid transparent", color:tab===id?"#b39ddb":"#2a4a6a", background:"transparent", border:"none", fontFamily:"inherit" }}>{l}</button>
        ))}
      </div>

      <div style={{ padding:16 }}>

        {/* ── PROXY BANNER ── */}
        {!proxyOk && (
          <div style={{ background:"#0a0f15", border:"1px solid #2a6aad", borderRadius:4, padding:"12px 14px", marginBottom:14 }}>
            <div style={{ fontSize:10, color:"#4a9ad4", fontWeight:700, marginBottom:6 }}>🔧 Cloudflare Worker URL (einmalig)</div>
            <div style={{ display:"flex", gap:8 }}>
              <input style={{ ...s.inp, flex:1 }} placeholder="https://binance-proxy.DEINNAME.workers.dev" value={proxyUrl} onChange={e=>setProxyUrl(e.target.value)} />
              <button onClick={saveProxy} style={s.btn("#4a9ad4", false)}>SPEICHERN</button>
            </div>
          </div>
        )}

        {/* ══ INPUT TAB ══ */}
        {tab==="input" && (
          <div className="si">
            {/* Pair + Live */}
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"flex-end", marginBottom:14 }}>
              <div>
                <div style={s.lbl}>PAIR</div>
                <select style={s.inp} value={pair} onChange={e=>{setPair(e.target.value);setLiveData(null);}}>
                  {["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","LINKUSDT","AVAXUSDT","BTCUSDC","ETHUSDC","BNBUSDC","ETHBTC","SOLBTC"].map(p=><option key={p}>{p}</option>)}
                </select>
              </div>
              {proxyOk && (
                <button onClick={loadLive} disabled={loading} className="ch" style={{ ...s.btn(liveData?"#00e676":"#4a9ad4", !!liveData), opacity:loading?0.6:1 }}>
                  {loading ? "⏳ LADEN..." : liveData ? "✅ NEU LADEN" : "📡 LIVE LADEN"}
                </button>
              )}
              {liveData && (
                <div style={{ fontSize:10, color:"#00e676", background:"#071a0f", border:"1px solid #00e67644", borderRadius:4, padding:"6px 10px" }}>
                  180 Kerzen · 4H·1H·15M · ${liveData["4h"]?.last?.toLocaleString()} aktuell
                </div>
              )}
            </div>

            {/* KERN: Wyckoff + MACD */}
            <div style={{ background:"#090d12", border:"1px solid #1a2a4a", borderRadius:6, padding:14, marginBottom:10 }}>
              <div style={{ fontSize:9, color:"#4a9ad4", letterSpacing:2, fontWeight:700, marginBottom:10 }}>KERN — WYCKOFF + 4C MACD</div>
              {[
                ["4H","#4a9ad4","Wyckoff Phase + MACD Farbe","z.B. 'Accumulation Phase C — Spring bei $69.400 gedruckt. 4H MACD Dark Red→Light Red am drehen.'",f4h,setF4h],
                ["1H","#b39ddb","Strukturwechsel CHoCH / BOS","z.B. 'CHoCH: Preis hat letztes Lower High bei $71.200 gebrochen. 1H MACD ins Grüne.'",f1h,setF1h],
                ["15M","#00e676","MACD 4C Farbe + Trigger","z.B. 'MACD Histogram: Dark Red→Light Red. Preis bei 61.8% Fib. Kleine grüne Kerze nach Tief.'",f15m,setF15m],
              ].map(([lbl,col,title,ph,val,set]) => (
                <div key={lbl} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
                    <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:14, color:col, letterSpacing:2 }}>{lbl}</span>
                    <span style={{ fontSize:10, color:"#3a5a7a" }}>{title}</span>
                  </div>
                  <textarea style={s.ta} rows={2} placeholder={ph} value={val} onChange={e=>set(e.target.value)} />
                </div>
              ))}
            </div>

            {/* LIQUIDITÄT */}
            <div style={{ background:"#090d12", border:"1px solid #2a1a4a", borderRadius:6, padding:14, marginBottom:10 }}>
              <div style={{ fontSize:9, color:"#7c4dff", letterSpacing:2, fontWeight:700, marginBottom:8 }}>LIQUIDITÄT — Smart Money (optional)</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[
                  ["Equal Highs (EQH)","Zwei gleiche Hochs?","z.B. '$72.800 — doppeltes Hoch'",eqH,setEqH],
                  ["Equal Lows (EQL)","Zwei gleiche Tiefs?","z.B. '$69.400 — Spring-Zone'",eqL,setEqL],
                  ["Fair Value Gap","FVG auf 4H/1H?","z.B. '$70.100–$70.800 auf 4H offen'",fvg,setFvg],
                  ["Orderblock","Letzte rote Kerze vor Move?","z.B. '$69.800–$70.200'",ob,setOb],
                ].map(([l,sub,ph,val,set]) => (
                  <div key={l}>
                    <div style={{ fontSize:9, color:"#7c4dff", marginBottom:2 }}>{l}</div>
                    <div style={{ fontSize:8, color:"#3a2a6a", marginBottom:3 }}>{sub}</div>
                    <input style={{ ...s.inp, width:"100%" }} placeholder={ph} value={val} onChange={e=>set(e.target.value)} />
                  </div>
                ))}
              </div>
            </div>

            {/* VOLUME PROFILE */}
            <div style={{ background:"#090d12", border:"1px solid #1a3a2a", borderRadius:6, padding:14, marginBottom:10 }}>
              <div style={{ fontSize:9, color:"#00b84a", letterSpacing:2, fontWeight:700, marginBottom:8 }}>VOLUME PROFILE (optional)</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                {[["POC","Meistgehandelt","z.B. '$70.500'",poc,setPoc],["VAH","Value Area High","z.B. '$72.800'",vah,setVah],["VAL","Value Area Low","z.B. '$68.900'",val_,setVal]].map(([l,sub,ph,val,set]) => (
                  <div key={l}>
                    <div style={{ fontSize:9, color:"#00b84a", marginBottom:2 }}>{l}</div>
                    <div style={{ fontSize:8, color:"#1a3a2a", marginBottom:3 }}>{sub}</div>
                    <input style={{ ...s.inp, width:"100%" }} placeholder={ph} value={val} onChange={e=>set(e.target.value)} />
                  </div>
                ))}
              </div>
            </div>

            {/* OPEN POSITIONS */}
            <div style={{ background:"#090d12", border:"1px solid #2a1a0a", borderRadius:6, padding:14, marginBottom:14 }}>
              <div style={{ fontSize:9, color:"#ffab00", letterSpacing:2, fontWeight:700, marginBottom:6 }}>OFFENE POSITIONEN (Korrelation)</div>
              <input style={{ ...s.inp, width:"100%" }} placeholder="z.B. 'Long BTCUSDT 0.1 BTC seit $70.500' — leer lassen wenn keine" value={open_} onChange={e=>setOpen(e.target.value)} />
            </div>

            {error && <div style={{ background:"#1a0707", border:"1px solid #ff1744", borderRadius:4, padding:"10px 14px", fontSize:11, color:"#ff6b6b", marginBottom:12 }}>{error}</div>}

            <button disabled={running} onClick={run} className="ch" style={{ background:"linear-gradient(135deg,#2a0a3a,#1a0528)", border:"1px solid #7c4dff", color:"#b39ddb", padding:"13px 24px", fontFamily:"'Bebas Neue',sans-serif", fontSize:20, letterSpacing:3, cursor:running?"not-allowed":"pointer", borderRadius:4, width:"100%", opacity:running?0.6:1 }}>
              {running ? "⏳ ANALYSIERT 10 FILTER..." : "⚡ SIGNAL GENERIEREN"}
            </button>
          </div>
        )}

        {/* ══ RESULT TAB ══ */}
        {tab==="result" && (
          <div>
            {running && (
              <div style={{ textAlign:"center", padding:"48px 0" }}>
                <div className="pu" style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:"#7c4dff", letterSpacing:3, marginBottom:16 }}>ANALYSIERT {pair}...</div>
                {["Wyckoff Phase + MACD","Liquidität & FVG","Volume Profile","Session & Korrelation","Signal generieren"].map((t,i) => (
                  <div key={i} style={{ fontSize:10, color:"#2a2a5a", marginBottom:4 }}>Filter {i*2+1}-{i*2+2}: {t}</div>
                ))}
              </div>
            )}

            {!running && !result && (
              <div style={{ textAlign:"center", padding:"48px 0", color:"#1a2a3a" }}>
                <div style={{ fontSize:36, marginBottom:10 }}>⚡</div>
                <div style={{ letterSpacing:3, fontSize:10 }}>NOCH KEIN SIGNAL</div>
                <button onClick={()=>setTab("input")} style={{ ...s.btn("#3a5a7a",false), marginTop:12, fontSize:10 }}>← EINGABE</button>
              </div>
            )}

            {!running && result && (() => {
              const r = result;
              const sigKey = ["LONG","SHORT"].includes(r.signal) ? r.signal : "NO SETUP";
              const st = SIG[sigKey];
              const conf = r.confidence || 0;
              const fp = r.filters_passed || 0;
              const noSetup = sigKey === "NO SETUP";

              return (
                <div className="si">
                  {/* Main signal card */}
                  <div style={{ background:st.bg, border:`2px solid ${st.border}`, borderRadius:6, padding:16, marginBottom:12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:10 }}>
                      <div>
                        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:noSetup?16:40, color:st.text, letterSpacing:3, lineHeight:1, marginBottom:4 }}>
                          {noSetup ? "⛔ " + r.signal : r.signal}
                        </div>
                        <div style={{ fontSize:11, color:"#b8ccd8", fontWeight:700 }}>{pair} · {new Date().toLocaleTimeString("de-AT")}</div>
                        {r.no_setup_reason && <div style={{ fontSize:11, color:"#c8a820", marginTop:6, lineHeight:1.6 }}>{r.no_setup_reason}</div>}
                      </div>
                      <div style={{ display:"flex", gap:8 }}>
                        <div style={{ textAlign:"center", background:"#060a0d", border:`1px solid ${fpColor(fp)}`, borderRadius:5, padding:"8px 12px" }}>
                          <div style={{ fontSize:8, color:"#2a3a4a", letterSpacing:2, marginBottom:2 }}>FILTER</div>
                          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:fpColor(fp) }}>{fp}/10</div>
                        </div>
                        <div style={{ textAlign:"center", background:"#060a0d", border:`1px solid ${confColor(conf)}`, borderRadius:5, padding:"8px 12px" }}>
                          <div style={{ fontSize:8, color:"#2a3a4a", letterSpacing:2, marginBottom:2 }}>CONF</div>
                          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:confColor(conf) }}>{conf}/10</div>
                          <div style={{ fontSize:8, color:confColor(conf) }}>{r.risk_pct}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {!noSetup && (
                    <>
                      {/* Bias row */}
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 }}>
                        {[["4H BIAS",r.bias_4h,r.bias_4h==="Bullish"?"#00e676":r.bias_4h==="Bearish"?"#ff1744":"#ffab00"],["1H BIAS",r.bias_1h,r.bias_1h==="Bullish"?"#00e676":r.bias_1h==="Bearish"?"#ff1744":"#ffab00"],["SESSION",r.session_ok?"OK":"POOR",r.session_ok?"#00e676":"#ff1744"]].map(([l,v,c])=>(
                          <div key={l} style={{ ...s.box(), textAlign:"center" }}>
                            <div style={s.lbl}>{l}</div>
                            <div style={{ fontSize:13, color:c, fontWeight:700 }}>{v}</div>
                          </div>
                        ))}
                      </div>

                      {/* Wyckoff */}
                      <div style={{ ...s.box("#1a2a4a"), marginBottom:10 }}>
                        <div style={{ fontSize:8, color:"#4a9ad4", letterSpacing:2, marginBottom:4 }}>WYCKOFF PHASE & BEDEUTUNG</div>
                        <div style={{ fontSize:13, color:"#7ec8f0", fontWeight:700, marginBottom:6 }}>{r.wyckoff_phase} — {r.wyckoff_event}</div>
                        <div style={{ fontSize:11, color:"#4a6a8a", lineHeight:1.8 }}>{r.wyckoff_plain}</div>
                      </div>

                      {/* MACD + Liquidity + Volume in grid */}
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                        <div style={s.box("#2a2040")}>
                          <div style={{ fontSize:8, color:"#b39ddb", letterSpacing:2, marginBottom:4 }}>4C MACD</div>
                          <div style={{ fontSize:11, color:"#9a7acc", lineHeight:1.7 }}>{r.macd_analysis}</div>
                        </div>
                        <div style={s.box("#2a1a4a")}>
                          <div style={{ fontSize:8, color:"#7c4dff", letterSpacing:2, marginBottom:4 }}>LIQUIDITÄT</div>
                          <div style={{ fontSize:11, color:"#9a7acc", lineHeight:1.7 }}>{r.liquidity_note}</div>
                        </div>
                        <div style={{ ...s.box("#1a3a2a"), gridColumn:"1/-1" }}>
                          <div style={{ fontSize:8, color:"#00b84a", letterSpacing:2, marginBottom:4 }}>VOLUME PROFILE</div>
                          <div style={{ fontSize:11, color:"#4a8a6a", lineHeight:1.7 }}>{r.volume_profile_note}</div>
                        </div>
                      </div>

                      {/* Trade levels */}
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                        <div style={s.box()}>
                          <div style={s.lbl}>ENTRY</div>
                          <div style={{ fontSize:16, color:"#c8d8e8", fontWeight:700 }}>{r.entry}</div>
                          <div style={{ fontSize:9, color:"#3a5a7a", marginTop:3 }}>Typ: {r.wyckoff_event}</div>
                        </div>
                        <div style={s.box("#2a1010")}>
                          <div style={{ ...s.lbl, color:"#ff6b6b" }}>STOP LOSS</div>
                          <div style={{ fontSize:16, color:"#ff6b6b", fontWeight:700 }}>{r.stop}</div>
                          <div style={{ fontSize:9, color:"#5a2020", marginTop:3 }}>{r.stop_reason}</div>
                        </div>
                        <div style={s.box("#0a2a1a")}>
                          <div style={{ ...s.lbl, color:"#00e676" }}>TARGET 1</div>
                          <div style={{ fontSize:16, color:"#00e676", fontWeight:700 }}>{r.tp1}</div>
                          <div style={{ fontSize:9, color:"#1a5a2a", marginTop:3 }}>{r.tp1_reason}</div>
                        </div>
                        <div style={s.box("#0a2a1a")}>
                          <div style={{ ...s.lbl, color:"#00b84a" }}>TARGET 2</div>
                          <div style={{ fontSize:16, color:"#00b84a", fontWeight:700 }}>{r.tp2}</div>
                          <div style={{ fontSize:9, color:"#1a5a2a", marginTop:3 }}>{r.tp2_reason}</div>
                        </div>
                      </div>

                      {/* RRR */}
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                        <div style={{ ...s.box(), textAlign:"center" }}>
                          <div style={s.lbl}>RISK/REWARD</div>
                          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:30, color:"#ffab00", letterSpacing:2 }}>{r.rrr}</div>
                        </div>
                        <div style={{ ...s.box(), textAlign:"center" }}>
                          <div style={s.lbl}>RISIKO / TRADE</div>
                          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:30, color:"#ff6d00", letterSpacing:2 }}>{r.risk_pct}</div>
                        </div>
                      </div>

                      {/* Correlation warning */}
                      {r.correlation_warning && (
                        <div style={{ background:"#1a1000", border:"1px solid #3a2a00", borderRadius:4, padding:"8px 12px", fontSize:11, color:"#c8a820", marginBottom:10 }}>
                          ⚠ KORRELATION: {r.correlation_warning}
                        </div>
                      )}

                      {/* Narrative */}
                      <div style={{ ...s.box(), borderLeft:`3px solid ${st.border}`, marginBottom:10 }}>
                        <div style={s.lbl}>TRADE THESIS (alle Begriffe erklärt)</div>
                        <div style={{ fontSize:12, color:"#8a9aaa", lineHeight:1.9, marginTop:6 }}>{r.narrative}</div>
                      </div>

                      {/* Invalidation */}
                      <div style={{ background:"#120f00", border:"1px solid #2a2000", borderRadius:4, padding:"8px 12px", fontSize:11, color:"#c8a820", marginBottom:14 }}>
                        ⛔ INVALIDIERUNG: {r.invalidation}
                      </div>

                      {/* Buttons */}
                      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                        <button onClick={()=>setBotTab?.("input")||setTab("input")} style={s.btn("#3a5a7a", false)}>← NEU</button>
                      </div>
                    </>
                  )}

                  {/* History */}
                  {history.length > 0 && (
                    <div style={{ marginTop:20 }}>
                      <div style={{ fontSize:9, color:"#2a4a6a", letterSpacing:3, marginBottom:8 }}>LETZTE SIGNALE</div>
                      {history.map((h,i) => {
                        const sk = ["LONG","SHORT"].includes(h.result.signal)?h.result.signal:"NO SETUP";
                        const sc = SIG[sk]?.border||"#ffab00";
                        return (
                          <div key={i} onClick={()=>setResult(h.result)} className="ch"
                            style={{ background:"#090d12", border:`1px solid ${sc}33`, borderLeft:`3px solid ${sc}`, borderRadius:4, padding:"8px 12px", marginBottom:5, cursor:"pointer" }}>
                            <div style={{ display:"flex", justifyContent:"space-between" }}>
                              <span style={{ color:sc, fontFamily:"'Bebas Neue',sans-serif", fontSize:13, letterSpacing:2 }}>{h.result.signal}</span>
                              <span style={{ color:"#2a4a6a", fontSize:10 }}>{h.pair} · F:{h.result.filters_passed}/10 · {h.ts}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ══ GUIDE TAB ══ */}
        {tab==="guide" && (
          <div className="si">
            {/* Proxy code */}
            <div style={{ background:"#090d12", border:"1px solid #2a6aad", borderRadius:6, padding:14, marginBottom:12 }}>
              <div style={{ fontSize:10, color:"#4a9ad4", fontWeight:700, letterSpacing:2, marginBottom:8 }}>🔧 CLOUDFLARE WORKER CODE</div>
              <div style={{ fontSize:9, color:"#3a5a7a", marginBottom:8 }}>Kopiere diesen Code in den Cloudflare Worker Editor:</div>
              <div style={{ background:"#060a0d", border:"1px solid #1a2530", borderRadius:4, padding:10, fontSize:10, color:"#4a8a6a", fontFamily:"monospace", lineHeight:1.9, whiteSpace:"pre-wrap" }}>{`export default {
  async fetch(request) {
    const url = new URL(request.url);
    const sym = url.searchParams.get("symbol");
    const iv  = url.searchParams.get("interval") || "4h";
    const lim = url.searchParams.get("limit") || "180";
    if (!sym) return new Response("Missing symbol", {status:400});
    const r = await fetch(
      \`https://api.binance.com/api/v3/klines?symbol=\${sym}&interval=\${iv}&limit=\${lim}\`
    );
    const data = await r.text();
    return new Response(data, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
};`}</div>
              <div style={{ fontSize:9, color:"#3a5a7a", marginTop:8 }}>Deine URL: <span style={{ color:"#4a9ad4" }}>https://binance-proxy.mail-schlabitz.workers.dev</span> ✅ bereits aktiv</div>
            </div>

            {/* What to enter */}
            <div style={{ background:"#090d12", border:"1px solid #1a2a3a", borderRadius:6, padding:14, marginBottom:12 }}>
              <div style={{ fontSize:10, color:"#c8d8e8", fontWeight:700, letterSpacing:2, marginBottom:10 }}>📋 WAS EINGEBEN — SCHRITT FÜR SCHRITT</div>
              {[
                ["📡 Live Daten laden","Klick 'LIVE LADEN' — App holt automatisch 180 Kerzen auf 4H/1H/15M direkt von Binance via deinen Proxy. Aktuellster Preis wird direkt angezeigt."],
                ["4H — Wyckoff Phase beschreiben","Schau auf deinen 4H Chart. Wo ist der Preis? In einer Range? Hat er gerade ein neues Tief gemacht und zurückgeschnappt (Spring)? Beschreibe die MACD 4C Farbe."],
                ["1H — CHoCH oder BOS?","Hat der Preis auf 1H das letzte Lower High gebrochen? = CHoCH. Hat er einen wichtigen Widerstand gebrochen? = BOS. Schreib den Preis auf."],
                ["15M — MACD Farbe ist entscheidend","Die 4C MACD Histogrammfarbe auf 15M ist der Entry-Trigger. Dark Red→Light Red = früh. Light Red→Grün = bestätigt. Schreib die aktuelle Farbe."],
                ["Equal Highs/Lows","TradingView: Schau ob zwei Hochs/Tiefs auf fast gleichem Level. Das sind Liquiditätspools wo Stops liegen. Spring = Equal Lows werden geholt."],
                ["Volume Profile","Indicators → Volume Profile Fixed Range → letzte 2-3 Wochen → POC (längste Linie), VAH/VAL (70% Grenze oben/unten) ablesen."],
              ].map(([t,d]) => (
                <div key={t} style={{ marginBottom:10, paddingBottom:10, borderBottom:"1px solid #141e28" }}>
                  <div style={{ fontSize:11, color:"#7ec8f0", fontWeight:700, marginBottom:4 }}>{t}</div>
                  <div style={{ fontSize:11, color:"#4a6a7a", lineHeight:1.7 }}>{d}</div>
                </div>
              ))}
            </div>

            {/* Glossary */}
            <div style={{ background:"#090d12", border:"1px solid #1a2a3a", borderRadius:6, padding:14 }}>
              <div style={{ fontSize:10, color:"#c8d8e8", fontWeight:700, letterSpacing:2, marginBottom:10 }}>📚 WYCKOFF + SMC GLOSSAR</div>
              {[
                ["SC","Selling Climax — Panik-Ausverkauf mit riesigem Volumen-Spike. Institutionen kaufen alles. Markiert das Tief. Phase A Start."],
                ["AR","Automatic Rally — Starker Bounce nach SC. Verkäufer erschöpft. Zeigt Range-Oberkante."],
                ["ST","Secondary Test — Rückkehr zum SC-Tief auf niedrigerem Volumen. Bestätigt dass Tief hält."],
                ["Spring","Falscher Ausbruch UNTER die Range. Falle für Short-Trader. Institutionen kaufen. Bester Long-Einstieg. Phase C."],
                ["LPS","Last Point of Support — Letzter Rücksetzer vor Ausbruch. Höheres Tief. Phase D Einstieg."],
                ["SOS","Sign of Strength — Ausbruch ÜBER Range-Oberkante mit Volumen. Phase D bestätigt."],
                ["BU","Back-Up — Retest der gebrochenen Resistance (jetzt Support). Phase E Einstieg."],
                ["CHoCH","Change of Character — 1H Struktur wechselt: Preis bricht letztes Lower High."],
                ["BOS","Break of Structure — Wichtiger Level gebrochen, Richtung bestätigt."],
                ["FVG","Fair Value Gap — Lücke zwischen 3 schnellen Kerzen. Preis muss sie immer füllen = Magnetziel."],
                ["OB","Orderblock — Letzte rote Kerze vor starkem bullischen Move. Institutionelle Kaufzone."],
                ["EQH/EQL","Equal Highs/Lows — Gleiche Hochs/Tiefs = Stopclusters. Spring = EQL werden geholt dann reversal."],
                ["POC","Point of Control — Meistgehandelter Preis. Stärkstes Magnetlevel — Preis kehrt immer zurück."],
                ["VAH/VAL","Value Area High/Low — 70% des Volumens liegt dazwischen. Ausbrüche daraus = starke Moves."],
              ].map(([t,d]) => (
                <div key={t} style={{ display:"flex", gap:10, marginBottom:7, paddingBottom:7, borderBottom:"1px solid #141e28" }}>
                  <span style={{ color:"#4a9ad4", minWidth:70, fontSize:11, fontWeight:700, flexShrink:0 }}>{t}</span>
                  <span style={{ fontSize:11, color:"#4a6a7a", lineHeight:1.6 }}>{d}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
