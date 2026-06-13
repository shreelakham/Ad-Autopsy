import os, json, glob
from dotenv import load_dotenv
from openai import OpenAI
load_dotenv()

BASE = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE, "cache", "output")

client = OpenAI(
    api_key=os.environ["TOKENROUTER_API_KEY"],
    base_url=os.environ["TOKENROUTER_BASE_URL"],
    timeout=90,
)
MODEL = "moonshotai/kimi-k2.5"

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
   "gap": str,
   "opportunity_for_{BRAND.lower()}": str,
   "counter_creative": {{ "angle": str, "script": str }} }}"""

SKIP_FILES = {"final_output.json"}

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
    per_ad = []
    files = sorted(glob.glob(os.path.join(OUTPUT_DIR, "*.json")))
    for path in files:
        if os.path.basename(path) in SKIP_FILES:
            continue
        try:
            v = json.load(open(path))
        except (json.JSONDecodeError, ValueError):
            print(f"skipping bad file: {path}")
            continue
        ad_id = v.get("video_id", os.path.basename(path))
        segs = v.get("unified", [])
        per_ad.append({
            "ad_id": ad_id
        })
    return per_ad

def run():
    per_ad = load_per_ad()
    print(f"Loaded {len(per_ad)} ads")
    if not per_ad:
        print("❌ No ad files found in cache/output/")
        return
    cross = ask(f"{CROSS_SCHEMA}\n\n{COMPETITOR} ADS:\n{json.dumps(per_ad, indent=2)}")
    out = {"competitor": COMPETITOR, "brand": BRAND, "per_ad": per_ad, **cross}
    json.dump(out, open(os.path.join(BASE, "cache", "autopsy.json"), "w"), indent=2)
    print("✅ Wrote cache/autopsy.json")

if __name__ == "__main__":
    run()