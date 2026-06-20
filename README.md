# Ad-Autopsy

**Analyse a competitor's video ads end to end, find the strategic gap they leave open and auto-generate a counter-creative pitch deck.**

Ad-Autopsy is an agentic pipeline that takes a single competitor brand name, scrapes its recent video ads, "watches" each one with multimodal video understanding, synthesises the recurring patterns across them into a strategic gap analysis and exports a ready-to-present pitch deck recommending a counter-creative angle — all from one input.

## How it works

The system is a four-stage pipeline orchestrated by a Flask server. A job runs asynchronously: the client submits a brand, polls for stage progress and receives a download link when the deck is ready.

```
brand name
   │
   ▼
1. SCRAPE       Bright Data    → pull the brand's recent TikTok video ads (cache/ads.json)
   │
   ▼
2. PERCEIVE     VideoDB        → for each ad: transcribe speech + shot-based scene analysis
   │                             (hook, emotional arc, visual pattern, spoken cues per scene)
   │
   ▼
3. SYNTHESISE   Kimi (LLM)     → find recurring patterns across all ads, identify the
   │                             strategic gap, draft counter-creative (autopsy.json)
   │
   ▼
4. BUILD DECK   Kimi + pptx    → design slide content from the analysis, render a .pptx
   │
   ▼
pitch.pptx
```

### Stage detail

1. **Scrape** (`scraper.py`) - Triggers a Bright Data dataset scrape of the brand's TikTok profile (async trigger → poll progress → download snapshot), then filters the raw response down to the ad video URLs.
2. **Perceive** (`perceive.py`) - Uploads each video to VideoDB, indexes spoken words and runs shot-based scene indexing with a structured prompt that classifies every scene's hook, emotional arc, visual pattern (talking head / b-roll / text overlay / product shot) and spoken cues (CTA, open loop, social proof, power words). Transcript and scene data are merged into a unified, timestamped timeline per ad.
3. **Synthesise** (`synthesize.py`) - Feeds the per-ad analysis to an LLM (Kimi K2.5, via TokenRouter) prompted as a strategist for the attacking brand. It returns structured JSON: cross-ad patterns, the strategic gap the competitor leaves open, the opportunity and a counter-creative angle + script. The prompt is constrained to analyse only what's in the data - never to invent metrics.
4. **Build deck** (`deck.py`) - A second LLM call turns the analysis into slide-level content (titles, short bullets, speaker notes), which is rendered into a real, editable `.pptx` with `python-pptx`.

## Tech stack

- **Backend / orchestration:** Python, Flask (async jobs via threading, status polling, file serving)
- **Ad scraping:** Bright Data (TikTok dataset API)
- **Video understanding:** VideoDB (spoken-word indexing + shot-based scene analysis); `yt-dlp` fallback for local download
- **LLM analysis & deck design:** Kimi K2.5 via TokenRouter (OpenAI-compatible API, JSON-mode structured outputs)
- **Deck export:** `python-pptx`
- **Frontend:** React 19 + Vite

## Project structure

```
Ad-Autopsy/
├── orchestrate.py      # Flask server — runs the pipeline, exposes /run, /status, /result
├── scraper.py          # Stage 1: Bright Data scrape → ads.json
├── perceive.py         # Stage 2: VideoDB transcription + scene analysis
├── synthesize.py       # Stage 3: cross-ad pattern + gap analysis (LLM)
├── deck.py             # Stage 4: deck design (LLM) + .pptx render
├── contracts.md        # Sample JSON shape for every pipeline stage
├── requirements.txt
├── frontend/           # React + Vite UI
└── cache/              # Pipeline outputs (ads.json, per-video JSON, autopsy.json, pitch.pptx)
```

## Setup

1. **Install backend dependencies**

   ```bash
   pip install -r requirements.txt
   ```

   You'll also need [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) available on your PATH for the local video-download fallback.

2. **Configure environment variables.** Copy `.env.example` to `.env` and fill in your credentials:

   ```
   BRIGHTDATA_API_KEY=        # Bright Data API key
   VIDEO_DB_API_KEY=          # VideoDB API key
   TOKENROUTER_API_KEY=       # TokenRouter API key (routes to Kimi)
   TOKENROUTER_BASE_URL=      # TokenRouter base URL (OpenAI-compatible)
   ```

   > `.env` is gitignored and should never be committed.

3. **Run the backend**

   ```bash
   python orchestrate.py
   ```

   The server starts on `http://localhost:5000`.

4. **Run the frontend** (in a separate terminal)

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Notes

- **Configurable brand vs. competitor.** The synthesis and deck stages frame the analysis as one brand attacking another (the proof of concept uses Nivea vs. Dove). These are set at the top of `synthesize.py` and `deck.py`.
- **Grounded, not hallucinated.** Both LLM stages use JSON-mode structured outputs and are explicitly prompted to analyse only what's present in the scraped data, rather than inventing engagement metrics or claims.
- **Async by design.** Scraping and video indexing are slow (minutes), so the orchestrator runs each job on a background thread and the client polls for stage updates.
- **`contracts.md`** documents the expected JSON shape at every stage - useful when extending the pipeline or swapping a provider.