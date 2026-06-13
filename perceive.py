import videodb
from videodb import SceneExtractionType
import os
import json
import subprocess
import uuid
from dotenv import load_dotenv

load_dotenv()

BASE = os.path.dirname(os.path.abspath(__file__))

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

def download_video(url: str) -> str:
    # unique filename so multiple videos don't overwrite each other
    unique_name = f"video_{uuid.uuid4().hex[:8]}.mp4"
    local_path = os.path.join(BASE, "cache", unique_name)
    print(f"⬇️ Downloading with yt-dlp → {unique_name}")
    subprocess.run([
        "yt-dlp",
        "-o", local_path,
        "--no-playlist",
        url
    ], check=True)
    size = os.path.getsize(local_path)
    if size < 10000:
        raise Exception(f"Downloaded file too small ({size} bytes) — download likely failed")
    print(f"✅ Downloaded: {unique_name}")
    return local_path

def perceive_video(url: str) -> dict:
    conn = videodb.connect(api_key=os.environ.get("VIDEO_DB_API_KEY"))
    coll = conn.get_collection()

    # try URL directly first
    try:
        video = coll.upload(url=url)
        print(f"✅ Uploaded via URL")
    except Exception as e:
        # if fails, download locally then upload
        print(f"⚠️ URL upload failed ({e}), downloading locally...")
        local_path = download_video(url)
        video = coll.upload(file_path=local_path)
        print(f"✅ Uploaded via local file")

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