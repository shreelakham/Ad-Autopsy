// mocks.json — one valid sample of every stage
{
  "ads": [
    { "ad_id": "a1", "video_url": "https://www.youtube.com/watch?v=DUMMY1",
      "youtube_id": "DUMMY1", "caption": "New! Save hours every week", "engagement": 12400 }
  ],
  "videos": {
    "a1": { "ad_id": "a1", "duration": 22,
      "transcript_text": "Tired of wasting your evenings? ...",
      "scenes": [ { "t": 0, "desc": "person frustrated at a messy desk" },
                  { "t": 3, "desc": "bright cut, product box appears" } ] }
  },
  "autopsy": {
    "per_ad": [
      { "ad_id": "a1",
        "hook": { "desc": "opens on the problem, not the product", "t": 0 },
        "emotional_arc": "frustration -> relief",
        "visual_pattern": "fast cuts, logo only at the very end",
        "claims": [ { "text": "saves three hours a week", "t": 11 } ] }
    ],
    "patterns": [
      { "insight": "6 of 8 ads open with a problem-shot before the product",
        "ad_ids": ["a1"] }
    ],
    "gap": "they never show a real person using the product",
    "counter_creative": {
      "angle": "real-customer proof",
      "script": "0-3s: real user mid-task...\n3-8s: product in their hands..." }
  }
}
