"""
Two jobs:
  1) scrape_brand(brand)  -> triggers the TikTok scraper (async), waits, caches cache/raw_data.json
  2) filter_ads()         -> reads raw_data.json, extracts id + video_url, writes cache/ads.json

Called from orchestrate.py:
    import scrapper
    scrapper.run("dove")

"""

import os, sys, json, time, requests
from dotenv import load_dotenv
load_dotenv()

# ----------------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------------
API_KEY    = os.environ.get("BRIGHTDATA_API_KEY")
DATASET_ID = "gd_lu702nij2f790tmv9h"

# This is a "discover by profile_url" scraper (note /profile_url/ in your dashboard URL),
# so the trigger needs discovery params. VERIFY these against the curl in the scraper's
# "Code examples" panel — copy that request verbatim if it differs.
DISCOVER_TYPE = "discover_new"
DISCOVER_BY   = "profile_url"

CACHE_DIR     = "cache"
RAW_DATA_PATH = os.path.join(CACHE_DIR, "raw_data.json")
ADS_PATH      = os.path.join(CACHE_DIR, "ads.json")

TRIGGER_URL  = "https://api.brightdata.com/datasets/v3/trigger"
PROGRESS_URL = "https://api.brightdata.com/datasets/v3/progress"
SNAPSHOT_URL = "https://api.brightdata.com/datasets/v3/snapshot"

POLL_INTERVAL_SECS = 10      # how often to check progress
POLL_TIMEOUT_SECS  = 600     # give up after 10 min

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def _tiktok_url(brand: str) -> str:
    """Turn a brand name into its TikTok profile URL.
    'dove' / 'Dove' / '@dove' -> https://www.tiktok.com/@dove
    """
    handle = brand.strip().lower().lstrip("@").replace(" ", "")
    return f"https://www.tiktok.com/@{handle}"

def _build_payload(brand: str) -> list:
    return [
        {
            "url": _tiktok_url(brand),
            "num_of_posts": 10,
            "what_to_collect": "Posts",   # "posts only"  -> VERIFY exact string
            "post_type": "Video Posts",         # "video posts" -> VERIFY exact string
            "country": "SG",
            "sort_by": "Popular",         # "popular"     -> VERIFY exact string
        }
    ]

# ----------------------------------------------------------------------------
# 1) Scrape (async: trigger -> poll -> download) and cache raw_data.json
# ----------------------------------------------------------------------------
def scrape_brand(brand: str) -> str:
    if not API_KEY:
        raise RuntimeError("BRIGHTDATA_API_KEY env var is not set.")

    os.makedirs(CACHE_DIR, exist_ok=True)

    # immediate feedback BEFORE the (possibly slow) network call
    print(f"[scraper] Starting scrape for '{brand}' ({_tiktok_url(brand)})...", flush=True)

    # --- trigger (async, discovery) ---
    trigger_resp = requests.post(
        TRIGGER_URL,
        headers=HEADERS,
        params={
            "dataset_id": DATASET_ID,
            "type": DISCOVER_TYPE,
            "discover_by": DISCOVER_BY,
            "format": "json",
            "include_errors": "true",
        },
        json=_build_payload(brand),
        timeout=30,
    )
    if not trigger_resp.ok:
        print("[scraper] TRIGGER FAILED", trigger_resp.status_code, flush=True)
        print(trigger_resp.text, flush=True)      # <-- Bright Data's real reason
        raise RuntimeError(
            f"Bright Data trigger failed ({trigger_resp.status_code}): {trigger_resp.text}"
        )
    snapshot_id = trigger_resp.json()["snapshot_id"]
    print(f"[scraper] Triggered -> snapshot {snapshot_id}. Polling every {POLL_INTERVAL_SECS}s...", flush=True)

    # --- poll progress until ready ---
    waited = 0
    while True:
        prog = requests.get(f"{PROGRESS_URL}/{snapshot_id}", headers=HEADERS, timeout=30)
        prog.raise_for_status()
        status = prog.json().get("status")

        if status == "ready":
            print(f"[scraper] Ready after {waited}s. Downloading...", flush=True)
            break
        if status == "failed":
            raise RuntimeError(f"Scrape failed for '{brand}' (snapshot {snapshot_id})")
        if waited >= POLL_TIMEOUT_SECS:
            raise RuntimeError(f"Scrape timed out after {POLL_TIMEOUT_SECS}s")

        print(f"[scraper] status='{status}', waiting... ({waited}s)", flush=True)
        time.sleep(POLL_INTERVAL_SECS)
        waited += POLL_INTERVAL_SECS

    # --- download snapshot ---
    for attempt in range(3):
        dl = requests.get(f"{SNAPSHOT_URL}/{snapshot_id}", headers=HEADERS,
                          params={"format": "json"}, timeout=120)
        if dl.status_code == 202:
            print("[scraper] snapshot still finalizing, retrying...", flush=True)
            time.sleep(POLL_INTERVAL_SECS)
            continue
        dl.raise_for_status()
        break
    else:
        raise RuntimeError("Snapshot never became downloadable")

    with open(RAW_DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(dl.json(), f, indent=2, ensure_ascii=False)

    print("Raw Data has been retrieved, data is now being filtered for VideoDB's usage.", flush=True)
    return RAW_DATA_PATH

# ----------------------------------------------------------------------------
# 2) Filter: raw_data.json -> ads.json (id + video_url)
# ----------------------------------------------------------------------------
def filter_ads() -> str:
    with open(RAW_DATA_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)

    if isinstance(raw, dict):
        raw = raw.get("data") or raw.get("results") or [raw]

    ads = []
    for i, post in enumerate(raw, start=1):
        ads.append({
            "ad_id":      f"a{i}",
            "video_url":  post.get("url"),
        })

    with open(ADS_PATH, "w", encoding="utf-8") as f:
        json.dump(ads, f, indent=2, ensure_ascii=False)

    print(f"[scraper] Wrote {len(ads)} ads -> {ADS_PATH}")
    return ADS_PATH

# ----------------------------------------------------------------------------
# Entry point for orchestrate.py
# ----------------------------------------------------------------------------
def run(brand: str) -> str:
    """Full scraper stage: scrape the brand, then produce ads.json."""
    scrape_brand(brand)
    return filter_ads()

if __name__ == "__main__":
    brand_arg = sys.argv[1] if len(sys.argv) > 1 else "dove"
    run(brand_arg)