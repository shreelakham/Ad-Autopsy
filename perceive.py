import videodb
from videodb import SceneExtractionType
import os
import json
from dotenv import load_dotenv

load_dotenv()

def parse_scene_analysis(text: str) -> dict:
    try:
        clean = text.strip().replace("```json", "").replace("```", "").strip()
        return json.loads(clean)
    except Exception:
        return {
            "hook": "—",
            "emotional_arc": "—",
            "visual_pattern": "—",
            "spoken_cues": "—"
        }

def perceive_video(url: str) -> dict:
    conn = videodb.connect(api_key=os.environ.get("VIDEO_DB_API_KEY"))
    video = conn.get_collection().upload(url=url)

    video.index_spoken_words()

    scene_index = video.index_scenes(
        extraction_type=SceneExtractionType.shot_based,
        extraction_config={"threshold": 20},
        prompt="""Analyze each scene and respond ONLY with a JSON object, no extra text:
{
  "hook": "one sentence on whether this is attention-grabbing in first 10s and why",
  "emotional_arc": "one sentence on the emotion this evokes",
  "visual_pattern": "one of: talking head / b-roll / text overlay / product shot",
  "spoken_cues": "one sentence listing any CTA, open loop, social proof, or power words"
}"""
    )

    scene_id = scene_index if isinstance(scene_index, str) else scene_index.id
    transcript = video.get_transcript() or []
    raw_scenes = video.get_scene_index(scene_id)

    unified = []
    for seg in transcript:
        matching_scene = next(
            (s for s in raw_scenes if s["start"] <= seg["start"] < s["end"]),
            None
        )
        parsed = parse_scene_analysis(matching_scene["description"]) if matching_scene else {}
        unified.append({
            "start": seg["start"],
            "end": seg["end"],
            "spoken": seg["text"],
            "hook": parsed.get("hook", "—"),
            "emotional_arc": parsed.get("emotional_arc", "—"),
            "visual_pattern": parsed.get("visual_pattern", "—"),
            "spoken_cues": parsed.get("spoken_cues", "—")
        })

    return {
        "video_id": video.id,
        "url": url,
        "unified": unified
    }

def perceive_multiple(urls: list) -> list:
    results = []
    for i, url in enumerate(urls):
        print(f"Processing video {i+1}/{len(urls)}: {url}")
        try:
            result = perceive_video(url)
            results.append(result)
            print(f"✅ Done: {url}")
        except Exception as e:
            print(f"❌ Failed: {url} — {e}")
            results.append({"url": url, "error": str(e)})
    return results