/**
 * AdAutopsy.jsx
 * Nivea Strategic Marketing — Competitive Ad Analyser
 *
 * Usage:
 *   1. Set ORCHESTRATOR_URL to wherever orchestrate.py is served (e.g. Flask /run endpoint).
 *   2. Drop this file into your React project and render <AdAutopsy />.
 *   3. Install deps if not already present:
 *        npm install lucide-react
 *
 * Expected orchestrator API contract:
 *   POST /run          { brand: string }  → { job_id: string }
 *   GET  /status/:id   → { stage: string, done: boolean, error?: string }
 *   GET  /result/:id   → { download_url: string, ...summary }
 *
 *   Stages the backend emits (must match STAGES[].key below):
 *     "scraping" | "perceiving" | "synthesising" | "building"
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Video,
  Lightbulb,
  LayoutDashboard,
  CheckCircle2,
  AlertCircle,
  Download,
  ArrowRight,
  RefreshCw,
  Dot,
} from "lucide-react";

// ─── CONFIG ────────────────────────────────────────────────────────────────

const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL ?? "http://localhost:5000";
const POLL_INTERVAL_MS = 1800;

// ─── DESIGN TOKENS ─────────────────────────────────────────────────────────
// Nivea palette: cream warmth, deep navy anchor, powder-blue accent
// Signature element: the animated "pulse ring" on the active stage icon

const tokens = {
  cream:      "#FAF7F2",
  sand:       "#F0EAE0",
  warmBorder: "#E4DAC8",
  ink:        "#1A1A2E",
  inkMuted:   "#5C5C72",
  inkLight:   "#9494A8",
  niveaBlue:  "#003FA5",
  blueMid:    "#4A7FCB",
  blueLight:  "#D6E4F7",
  bluePale:   "#EEF4FC",
  green:      "#2E7D4F",
  greenPale:  "#E8F5EE",
  amber:      "#A0611A",
  amberPale:  "#FEF3E2",
  rose:       "#C0392B",
  rosePale:   "#FDECEA",
};

// ─── DATA ──────────────────────────────────────────────────────────────────

const STAGES = [
  {
    key:   "scraping",
    icon:  Search,
    label: "Scanning ad library",
    verb:  "Fetching live ads from the brand's library",
    micro: "Pulling creative from Meta, TikTok & YouTube",
  },
  {
    key:   "perceiving",
    icon:  Video,
    label: "Watching every ad",
    verb:  "Extracting transcripts, scenes & emotion cues",
    micro: "Your competitors' scripts, laid bare",
  },
  {
    key:   "synthesising",
    icon:  Lightbulb,
    label: "Finding the patterns",
    verb:  "Mapping hooks, arcs & the gaps nobody's filling",
    micro: "This is where the real insight lives",
  },
  {
    key:   "building",
    icon:  LayoutDashboard,
    label: "Building your deck",
    verb:  "Assembling the strategy brief",
    micro: "6 slides. Straight to the point.",
  },
];

// Rotating insight cards shown during analysis
const INSIGHT_CARDS = [
  {
    stat:  "3 sec",
    body:  "That's how long you have to hook someone before they scroll. Most brands waste all three.",
  },
  {
    stat:  "82%",
    body:  "of top-performing beauty ads open on a person's face, not a product.",
  },
  {
    stat:  "Pain-first",
    body:  "Ads that name a frustration in the first line outperform aspirational openers by 2×.",
  },
  {
    stat:  "UGC > studio",
    body:  "Shaky, authentic footage now outperforms polished studio ads in 6 out of 10 categories.",
  },
  {
    stat:  "€0",
    body:  "The most-shared Nivea ad in 2023 had no media spend on launch day. Community did it.",
  },
  {
    stat:  "No price",
    body:  "Premium skincare brands almost never show a price. That silence is your signal.",
  },
];

// ─── UTILITIES ─────────────────────────────────────────────────────────────

function useInterval(callback, delay) {
  const savedCallback = useRef(callback);
  useEffect(() => { savedCallback.current = callback; }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

function stageIndex(key) {
  return STAGES.findIndex((s) => s.key === key);
}

// ─── COMPONENTS ────────────────────────────────────────────────────────────

// Animated orbiting-dot scraper visualisation shown during "scraping" stage
function ScraperOrb({ active }) {
  if (!active) return null;
  return (
    <div style={styles.orbWrapper} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            ...styles.orbRing,
            width:  56 + i * 32,
            height: 56 + i * 32,
            animationDelay: `${i * 0.4}s`,
            opacity: 0.18 - i * 0.04,
          }}
        />
      ))}
      <div style={styles.orbCore}>
        <Search size={18} color={tokens.niveaBlue} strokeWidth={1.5} />
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            ...styles.orbDot,
            animationDelay: `${i * 0.7}s`,
          }}
        />
      ))}
    </div>
  );
}

// Single stage row in the progress list
function StageRow({ stage, status }) {
  // status: "waiting" | "active" | "done" | "error"
  const Icon = stage.icon;
  const isActive = status === "active";
  const isDone   = status === "done";
  const isError  = status === "error";

  return (
    <div
      style={{
        ...styles.stageRow,
        opacity: status === "waiting" ? 0.38 : 1,
      }}
    >
      {/* Icon bubble with pulse ring when active */}
      <div style={styles.iconWrap}>
        {isActive && <div style={styles.pulseRing} />}
        <div
          style={{
            ...styles.iconBubble,
            background: isDone
              ? tokens.greenPale
              : isError
              ? tokens.rosePale
              : isActive
              ? tokens.blueLight
              : tokens.sand,
            border: `1px solid ${
              isDone
                ? "#B7DFC8"
                : isError
                ? "#F5C4C0"
                : isActive
                ? tokens.blueMid
                : tokens.warmBorder
            }`,
          }}
        >
          {isDone ? (
            <CheckCircle2 size={18} color={tokens.green} strokeWidth={1.8} />
          ) : isError ? (
            <AlertCircle size={18} color={tokens.rose} strokeWidth={1.8} />
          ) : (
            <Icon
              size={18}
              color={isActive ? tokens.niveaBlue : tokens.inkLight}
              strokeWidth={1.5}
            />
          )}
        </div>
      </div>

      {/* Text */}
      <div style={styles.stageText}>
        <span
          style={{
            ...styles.stageLabel,
            color: isDone
              ? tokens.green
              : isError
              ? tokens.rose
              : isActive
              ? tokens.ink
              : tokens.inkLight,
          }}
        >
          {stage.label}
        </span>
        {isActive && (
          <span style={styles.stageMicro}>{stage.micro}</span>
        )}
        {isDone && (
          <span style={{ ...styles.stageMicro, color: tokens.green }}>
            Complete
          </span>
        )}
        {isError && (
          <span style={{ ...styles.stageMicro, color: tokens.rose }}>
            Failed — check your orchestrator logs
          </span>
        )}
      </div>

      {/* Active spinner */}
      {isActive && (
        <div style={styles.spinnerWrap}>
          <div style={styles.spinner} />
        </div>
      )}
    </div>
  );
}

// Rotating insight card
function InsightCard({ card }) {
  const [visible, setVisible] = useState(true);
  const [current, setCurrent] = useState(card);

  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => { setCurrent(card); setVisible(true); }, 350);
    return () => clearTimeout(t);
  }, [card]);

  return (
    <div
      style={{
        ...styles.insightCard,
        opacity:   visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(6px)",
        transition: "opacity 0.35s ease, transform 0.35s ease",
      }}
    >
      <div style={styles.insightStat}>{current.stat}</div>
      <p style={styles.insightBody}>{current.body}</p>
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────

export default function AdAutopsy() {
  // view: "input" | "running" | "done" | "error"
  const [view,          setView]          = useState("input");
  const [brand,         setBrand]         = useState("");
  const [jobId,         setJobId]         = useState(null);
  const [activeStage,   setActiveStage]   = useState(null); // key string
  const [completedKeys, setCompletedKeys] = useState([]);
  const [errorMsg,      setErrorMsg]      = useState(null);
  const [resultUrl,     setResultUrl]     = useState(null);
  const [cardIndex,     setCardIndex]     = useState(0);
  const [polling,       setPolling]       = useState(false);

  // Rotate insight cards every 6 s while running
  useInterval(
    () => setCardIndex((i) => (i + 1) % INSIGHT_CARDS.length),
    view === "running" ? 6000 : null
  );

  // Poll orchestrator status
  const pollStatus = useCallback(async () => {
    if (!jobId) return;
    try {
      const res  = await fetch(`${ORCHESTRATOR_URL}/status/${jobId}`);
      const data = await res.json();

      if (data.stage) {
        setActiveStage(data.stage);

        // Mark all stages before the current one as completed
        const idx = stageIndex(data.stage);
        setCompletedKeys(STAGES.slice(0, idx).map((s) => s.key));
      }

      if (data.done) {
        // Mark every stage done
        setCompletedKeys(STAGES.map((s) => s.key));
        setActiveStage(null);

        // Fetch result
        const rRes  = await fetch(`${ORCHESTRATOR_URL}/result/${jobId}`);
        const rData = await rRes.json();
        setResultUrl(rData.download_url ?? null);
        setPolling(false);
        setView("done");
      }

      if (data.error) {
        setErrorMsg(data.error);
        setPolling(false);
        setView("error");
      }
    } catch (err) {
      setErrorMsg("Lost connection to the orchestrator. Is it running?");
      setPolling(false);
      setView("error");
    }
  }, [jobId]);

  useInterval(pollStatus, polling ? POLL_INTERVAL_MS : null);

  // Submit brand name → kick off orchestrator
  const handleSubmit = async () => {
    const trimmed = brand.trim();
    if (!trimmed) return;

    setView("running");
    setActiveStage("scraping");
    setCompletedKeys([]);
    setErrorMsg(null);
    setResultUrl(null);

    try {
      const res  = await fetch(`${ORCHESTRATOR_URL}/run`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ brand: trimmed }),
      });
      const data = await res.json();
      setJobId(data.job_id);
      setPolling(true);
    } catch {
      setErrorMsg("Couldn't reach the orchestrator. Check that it's running on " + ORCHESTRATOR_URL);
      setView("error");
    }
  };

  const reset = () => {
    setBrand("");
    setView("input");
    setJobId(null);
    setActiveStage(null);
    setCompletedKeys([]);
    setErrorMsg(null);
    setResultUrl(null);
    setPolling(false);
  };

  // ── RENDER ──

  return (
    <div style={styles.root}>

      {/* ── Wordmark ── */}
      <header style={styles.header}>
        <span style={styles.wordmarkNivea}>NIVEA</span>
        <span style={styles.wordmarkSep}>/</span>
        <span style={styles.wordmarkProduct}>Ad Autopsy</span>
      </header>

      {/* ══════════ INPUT VIEW ══════════ */}
      {view === "input" && (
        <main style={styles.centreColumn}>
          <p style={styles.eyebrow}>Strategic intelligence</p>
          <h1 style={styles.headline}>
            Which brand are we<br />dissecting today?
          </h1>
          <p style={styles.subhead}>
            Enter a competitor's name and we'll watch their ads,<br />
            find the patterns, and hand you a strategy brief.
          </p>

          <div style={styles.inputRow}>
            <input
              style={styles.input}
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="e.g. Dove, L'Oréal, CeraVe…"
              aria-label="Brand name to analyse"
              autoFocus
            />
            <button
              style={{
                ...styles.primaryBtn,
                opacity: brand.trim() ? 1 : 0.45,
                cursor:  brand.trim() ? "pointer" : "default",
              }}
              onClick={handleSubmit}
              disabled={!brand.trim()}
              aria-label="Start analysis"
            >
              Analyse
              <ArrowRight size={16} strokeWidth={2} style={{ marginLeft: 6 }} />
            </button>
          </div>

          <div style={styles.inputHint}>
            Analysis takes 2–4 minutes. We'll keep you company.
          </div>
        </main>
      )}

      {/* ══════════ RUNNING VIEW ══════════ */}
      {view === "running" && (
        <main style={styles.runningLayout}>

          {/* Left col — stage list */}
          <section style={styles.leftCol} aria-label="Analysis progress">
            <p style={styles.eyebrow}>Analysing</p>
            <h2 style={styles.runningBrand}>{brand}</h2>

            {/* Overall progress bar */}
            <div style={styles.progressTrack} role="progressbar" aria-label="Overall progress">
              <div
                style={{
                  ...styles.progressFill,
                  width: `${
                    (completedKeys.length / STAGES.length) * 100
                  }%`,
                  transition: "width 0.8s ease",
                }}
              />
            </div>
            <p style={styles.progressLabel}>
              {completedKeys.length} of {STAGES.length} stages complete
            </p>

            {/* Scraper visualisation */}
            <ScraperOrb active={activeStage === "scraping"} />

            {/* Stage rows */}
            <div style={styles.stageList} role="list">
              {STAGES.map((stage) => {
                const status = completedKeys.includes(stage.key)
                  ? "done"
                  : activeStage === stage.key
                  ? "active"
                  : "waiting";
                return (
                  <StageRow key={stage.key} stage={stage} status={status} />
                );
              })}
            </div>
          </section>

          {/* Right col — rotating insight card */}
          <aside style={styles.rightCol} aria-label="While you wait">
            <p style={styles.insightEyebrow}>While we work…</p>
            <InsightCard card={INSIGHT_CARDS[cardIndex]} />

            {/* Active stage verbose description */}
            {activeStage && (
              <div style={styles.stageVerb}>
                {STAGES.find((s) => s.key === activeStage)?.verb ?? ""}
                <DotBlink />
              </div>
            )}

            <p style={styles.relaxNote}>
              Grab a coffee. This usually takes 2–4 minutes.
            </p>
          </aside>
        </main>
      )}

      {/* ══════════ DONE VIEW ══════════ */}
      {view === "done" && (
        <main style={styles.centreColumn}>
          <div style={styles.doneIcon}>
            <CheckCircle2 size={40} color={tokens.green} strokeWidth={1.5} />
          </div>
          <h2 style={styles.doneHeadline}>
            Your {brand} brief is ready.
          </h2>
          <p style={styles.doneSub}>
            We watched every ad, mapped the patterns, and found the gaps.<br />
            It's all in the deck.
          </p>

          {resultUrl ? (
            <a
              href={resultUrl}
              download
              style={styles.primaryBtn}
              aria-label={`Download ${brand} strategy deck`}
            >
              <Download size={16} strokeWidth={2} style={{ marginRight: 6 }} />
              Download deck (.pptx)
            </a>
          ) : (
            <p style={{ ...styles.inputHint, color: tokens.amber }}>
              Deck is building — download link will appear here shortly.
            </p>
          )}

          <button style={styles.ghostBtn} onClick={reset}>
            <RefreshCw size={14} strokeWidth={2} style={{ marginRight: 6 }} />
            Analyse another brand
          </button>
        </main>
      )}

      {/* ══════════ ERROR VIEW ══════════ */}
      {view === "error" && (
        <main style={styles.centreColumn}>
          <div style={{ ...styles.doneIcon, background: tokens.rosePale, borderColor: "#F5C4C0" }}>
            <AlertCircle size={36} color={tokens.rose} strokeWidth={1.5} />
          </div>
          <h2 style={{ ...styles.doneHeadline, color: tokens.rose }}>
            Something went wrong
          </h2>
          <p style={styles.doneSub}>{errorMsg}</p>
          <button style={styles.primaryBtn} onClick={reset}>
            Try again
          </button>
        </main>
      )}

      <footer style={styles.footer}>
        NIVEA Strategic Marketing · Internal tool · Not for distribution
      </footer>
    </div>
  );
}

// Three animated dots
function DotBlink() {
  return (
    <span aria-hidden="true" style={{ marginLeft: 2 }}>
      {[0, 1, 2].map((i) => (
        <Dot
          key={i}
          size={12}
          style={{
            display: "inline-block",
            animation: `dotFade 1.2s ${i * 0.3}s ease-in-out infinite`,
            color: tokens.blueMid,
          }}
        />
      ))}
    </span>
  );
}

// ─── STYLES ────────────────────────────────────────────────────────────────

const styles = {
  root: {
    minHeight:       "100vh",
    background:      tokens.cream,
    fontFamily:      "'Inter', system-ui, sans-serif",
    color:           tokens.ink,
    display:         "flex",
    flexDirection:   "column",
  },

  // Header
  header: {
    padding:      "20px 40px",
    borderBottom: `1px solid ${tokens.warmBorder}`,
    display:      "flex",
    alignItems:   "center",
    gap:          10,
  },
  wordmarkNivea: {
    fontFamily:    "'Inter', sans-serif",
    fontWeight:    800,
    fontSize:      15,
    letterSpacing: "0.18em",
    color:         tokens.niveaBlue,
  },
  wordmarkSep: {
    color:    tokens.inkLight,
    fontSize: 14,
  },
  wordmarkProduct: {
    fontSize: 13,
    color:    tokens.inkMuted,
    fontWeight: 500,
  },

  // Layout helpers
  centreColumn: {
    flex:           1,
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    padding:        "60px 24px",
    textAlign:      "center",
    maxWidth:       560,
    margin:         "0 auto",
    width:          "100%",
  },

  // Typography
  eyebrow: {
    fontSize:      11,
    fontWeight:    600,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color:         tokens.niveaBlue,
    marginBottom:  16,
  },
  headline: {
    fontSize:      36,
    fontWeight:    800,
    lineHeight:    1.1,
    letterSpacing: "-0.02em",
    color:         tokens.ink,
    marginBottom:  16,
  },
  subhead: {
    fontSize:   16,
    lineHeight: 1.65,
    color:      tokens.inkMuted,
    marginBottom: 36,
  },

  // Input
  inputRow: {
    display:      "flex",
    gap:          0,
    width:        "100%",
    maxWidth:     440,
    border:       `1px solid ${tokens.warmBorder}`,
    borderRadius: 12,
    overflow:     "hidden",
    background:   "#fff",
    boxShadow:    `0 2px 12px rgba(0,63,165,0.06)`,
  },
  input: {
    flex:        1,
    border:      "none",
    outline:     "none",
    padding:     "15px 18px",
    fontSize:    15,
    fontFamily:  "inherit",
    color:       tokens.ink,
    background:  "transparent",
  },
  primaryBtn: {
    display:        "inline-flex",
    alignItems:     "center",
    justifyContent: "center",
    background:     tokens.niveaBlue,
    color:          "#fff",
    border:         "none",
    borderRadius:   0,
    padding:        "15px 22px",
    fontSize:       14,
    fontWeight:     600,
    fontFamily:     "inherit",
    cursor:         "pointer",
    letterSpacing:  "0.02em",
    textDecoration: "none",
    transition:     "background 0.15s",
  },
  inputHint: {
    marginTop: 14,
    fontSize:  12,
    color:     tokens.inkLight,
  },

  // Running layout — two columns
  runningLayout: {
    flex:    1,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:     0,
    maxWidth: 960,
    margin:  "0 auto",
    width:   "100%",
    padding: "0 0 40px",
    "@media (max-width: 640px)": {
      gridTemplateColumns: "1fr",
    },
  },
  leftCol: {
    padding:      "48px 40px 40px",
    borderRight:  `1px solid ${tokens.warmBorder}`,
  },
  rightCol: {
    padding:     "48px 40px 40px",
    background:  tokens.bluePale,
    display:     "flex",
    flexDirection: "column",
    gap:          20,
  },
  runningBrand: {
    fontSize:      28,
    fontWeight:    800,
    letterSpacing: "-0.02em",
    marginBottom:  20,
  },

  // Progress bar
  progressTrack: {
    height:       3,
    background:   tokens.warmBorder,
    borderRadius: 2,
    overflow:     "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height:     "100%",
    background: tokens.niveaBlue,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize:     12,
    color:        tokens.inkLight,
    marginBottom: 28,
  },

  // Scraper orb
  orbWrapper: {
    position:   "relative",
    width:       120,
    height:      120,
    marginBottom: 28,
  },
  orbRing: {
    position:    "absolute",
    top:         "50%",
    left:        "50%",
    transform:   "translate(-50%, -50%)",
    borderRadius: "50%",
    border:      `1px solid ${tokens.niveaBlue}`,
    animation:   "orbPulse 2s ease-in-out infinite",
  },
  orbCore: {
    position:        "absolute",
    top:             "50%",
    left:            "50%",
    transform:       "translate(-50%, -50%)",
    width:           40,
    height:          40,
    borderRadius:    "50%",
    background:      tokens.blueLight,
    border:          `1px solid ${tokens.blueMid}`,
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "center",
  },
  orbDot: {
    position:    "absolute",
    width:        7,
    height:       7,
    borderRadius: "50%",
    background:   tokens.niveaBlue,
    top:          "50%",
    left:         "50%",
    animation:    "orbOrbit 3s linear infinite",
    transformOrigin: "-30px 0",
  },

  // Stage list
  stageList: {
    display:       "flex",
    flexDirection: "column",
    gap:            0,
  },
  stageRow: {
    display:    "flex",
    alignItems: "flex-start",
    gap:         14,
    padding:    "14px 0",
    borderBottom: `1px solid ${tokens.warmBorder}`,
    transition: "opacity 0.4s ease",
  },
  iconWrap: {
    position:   "relative",
    flexShrink: 0,
  },
  pulseRing: {
    position:    "absolute",
    inset:       -6,
    borderRadius: "50%",
    border:      `1.5px solid ${tokens.blueMid}`,
    animation:   "pulseRing 1.4s ease-out infinite",
  },
  iconBubble: {
    width:          36,
    height:         36,
    borderRadius:   "50%",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    transition:     "all 0.3s ease",
  },
  stageText: {
    flex:          1,
    display:       "flex",
    flexDirection: "column",
    gap:            2,
    paddingTop:     2,
  },
  stageLabel: {
    fontSize:   14,
    fontWeight: 600,
    lineHeight: 1.3,
    transition: "color 0.3s ease",
  },
  stageMicro: {
    fontSize:  12,
    color:     tokens.inkLight,
    fontStyle: "italic",
  },
  spinnerWrap: {
    paddingTop: 8,
  },
  spinner: {
    width:        18,
    height:       18,
    borderRadius: "50%",
    border:       `2px solid ${tokens.blueLight}`,
    borderTopColor: tokens.niveaBlue,
    animation:    "spin 0.8s linear infinite",
  },

  // Insight card
  insightEyebrow: {
    fontSize:      11,
    fontWeight:    600,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color:         tokens.blueMid,
  },
  insightCard: {
    background:   "#fff",
    border:       `1px solid ${tokens.warmBorder}`,
    borderRadius: 14,
    padding:      "24px",
    boxShadow:    `0 2px 16px rgba(0,63,165,0.06)`,
  },
  insightStat: {
    fontSize:      32,
    fontWeight:    800,
    color:         tokens.niveaBlue,
    letterSpacing: "-0.03em",
    marginBottom:  10,
  },
  insightBody: {
    fontSize:   14,
    lineHeight: 1.65,
    color:      tokens.inkMuted,
    margin:     0,
  },
  stageVerb: {
    fontSize:  13,
    color:     tokens.inkMuted,
    fontStyle: "italic",
    display:   "flex",
    alignItems: "center",
    gap:        2,
  },
  relaxNote: {
    fontSize:    12,
    color:       tokens.inkLight,
    marginTop:   "auto",
    paddingTop:  12,
  },

  // Done / error
  doneIcon: {
    width:          72,
    height:         72,
    borderRadius:   "50%",
    background:     tokens.greenPale,
    border:         `1px solid #B7DFC8`,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    marginBottom:   24,
  },
  doneHeadline: {
    fontSize:      28,
    fontWeight:    800,
    letterSpacing: "-0.02em",
    marginBottom:  12,
  },
  doneSub: {
    fontSize:     15,
    lineHeight:   1.65,
    color:        tokens.inkMuted,
    marginBottom: 32,
  },
  ghostBtn: {
    display:     "inline-flex",
    alignItems:  "center",
    marginTop:   16,
    background:  "transparent",
    border:      `1px solid ${tokens.warmBorder}`,
    borderRadius: 8,
    padding:     "10px 18px",
    fontSize:    13,
    color:       tokens.inkMuted,
    cursor:      "pointer",
    fontFamily:  "inherit",
    transition:  "border-color 0.15s, color 0.15s",
  },

  footer: {
    padding:    "16px 40px",
    borderTop:  `1px solid ${tokens.warmBorder}`,
    fontSize:   11,
    color:      tokens.inkLight,
    textAlign:  "center",
    letterSpacing: "0.04em",
  },
};

// ─── KEYFRAMES (injected once) ─────────────────────────────────────────────

const keyframes = `
  @keyframes spin        { to { transform: rotate(360deg); } }
  @keyframes pulseRing   { 0% { transform: scale(0.85); opacity: 0.7; } 100% { transform: scale(1.5); opacity: 0; } }
  @keyframes orbPulse    { 0%, 100% { opacity: 0.18; } 50% { opacity: 0.32; } }
  @keyframes orbOrbit    { from { transform: rotate(0deg)   translateX(50px); }
                           to   { transform: rotate(360deg) translateX(50px); } }
  @keyframes dotFade     { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; } }
`;

if (typeof document !== "undefined" && !document.getElementById("__ad-autopsy-kf")) {
  const s = document.createElement("style");
  s.id = "__ad-autopsy-kf";
  s.textContent = keyframes;
  document.head.appendChild(s);
}
