import os, json, glob
from dotenv import load_dotenv
from openai import OpenAI
load_dotenv()

client = OpenAI(
    api_key=os.environ["TOKENROUTER_API_KEY"],
    base_url=os.environ["TOKENROUTER_BASE_URL"],
    timeout=90,
)
MODEL = "moonshotai/kimi-k2.5"

# We are NIVEA. The competitor we analysed is DOVE.
BRAND = "Nivea"
COMPETITOR = "Dove"

SYS = f"""You are an advertising strategist at {BRAND}. You have analysed a set of
{COMPETITOR}'s video ads. For each ad you are given its hook, emotional arc, visual
pattern, and spoken/text cues, each with timestamps. Analyse what is ACTUALLY in the
data — never invent metrics. Find the recurring patterns across {COMPETITOR}'s ads,
identify the strategic GAP {BRAND} could exploit, and draft counter-creative.
Respond with ONLY valid JSON, no markdown, no preamble."""

CROSS_SCHEMA = f"""Return JSON:
{{ "patterns": [ {{ "insight": str, "ad_ids": [str] }} ],
   "gap": str,                                  // what {COMPETITOR} never does that {BRAND} could own
   "opportunity_for_{BRAND.lower()}": str,      // how {BRAND} should position against this
   "counter_creative": {{ "angle": str, "script": str }} }}"""

def ask(user_text):
    r = client.chat.completions.create(
        model=MODEL, temperature=1,
        response_format={"type": "json_object"},
        messages=[{"role": "system", "content": SYS},
                  {"role": "user", "content": user_text}],
    )
    content = r.choices[0].message.content.strip()
    content = content.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(content)

def load_per_ad():
    """Reshape each VideoDB file into a flat per-ad summary."""
    per_ad = []
    for path in sorted(glob.glob("cache/video_*.json")):
        try:
            v = json.load(open(path))
        except (json.JSONDecodeError, ValueError):
            print(f"skipping bad file: {path}")
            continue
        ad_id = v.get("video_id", path)
        segs = v.get("unified", [])
        # Pull the analysis VideoDB already produced, with timestamps
        per_ad.append({
            "ad_id": ad_id,
            "segments": [{
                "t": int(s.get("start", 0)),
                "hook": s.get("hook", ""),
                "emotional_arc": s.get("emotional_arc", ""),
                "visual_pattern": s.get("visual_pattern", ""),
                "spoken": s.get("spoken", ""),
                "cues": s.get("spoken_cues", "")
            } for s in segs]
        })
    return per_ad

def run():
    per_ad = load_per_ad()
    print(f"Loaded {len(per_ad)} ads")
    cross = ask(f"{CROSS_SCHEMA}\n\n{COMPETITOR} ADS:\n{json.dumps(per_ad, indent=2)}")
    out = {"competitor": COMPETITOR, "brand": BRAND, "per_ad": per_ad, **cross}
    json.dump(out, open("cache/autopsy.json", "w"), indent=2)
    print("Wrote cache/autopsy.json")

if __name__ == "__main__":
    run()