import json
from pathlib import Path

# --- paths ---
RAW_PATH = Path("cache/raw_data.json")  # the Bright Data snapshot
OUT_PATH = Path("cache/ads.json")


def load_raw(path: Path) -> list[dict]:
    """Load the raw Bright Data Instagram Reels snapshot."""
    with open(path, encoding="utf-8") as f:
        return json.load(f)

def to_contract(raw: list[dict]) -> list[dict]:
    ads = []
    for i, rec in enumerate(raw, start=1):
        video_url = rec.get("video_url")
        if not video_url:
            continue  # skip non-video posts; we only autopsy video ads

        ads.append({
            "ad_id": f"a{i}",
            "video_url": video_url,
        })
    return ads

def main() -> None:
    raw = load_raw(RAW_PATH)
    ads = to_contract(raw)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(ads, f, indent=2, ensure_ascii=False)

    print(f"Wrote {len(ads)} ads -> {OUT_PATH}")

if __name__ == "__main__":
    main()