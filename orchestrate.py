import json
import os
import sys
import threading
import uuid

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from perceive import perceive_multiple
from synthesize import run as run_synthesize
from deck import run as run_deck
import scraper

BASE = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(BASE, "cache")
OUTPUT_DIR = os.path.join(CACHE_DIR, "output")
ADS_PATH = os.path.join(CACHE_DIR, "ads.json")

PUBLIC_BASE = os.environ.get("ORCHESTRATOR_PUBLIC_URL", "http://localhost:5000")
API_PORT = int(os.environ.get("ORCHESTRATOR_PORT", "5000"))

app = Flask(__name__)
CORS(app)

jobs: dict[str, dict] = {}


def _urls_from_ads(ads: list) -> list[str]:
    urls = []
    for ad in ads:
        if isinstance(ad, dict):
            url = ad.get("video_url")
        else:
            url = ad
        if url:
            urls.append(url)
    return urls


def run_perceive(video_urls: list) -> list:
    """Perceive videos and write per-video JSON + final_output.json."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    results = perceive_multiple(video_urls)
    all_videos = []

    for result in results:
        if "error" in result:
            all_videos.append(result)
            continue

        video_data = {
            "video_id": result["video_id"],
            "url": result["url"],
            "unified": result["unified"],
        }
        safe_name = result["video_id"]
        with open(os.path.join(OUTPUT_DIR, f"{safe_name}.json"), "w") as f:
            json.dump(video_data, f, indent=2)
        all_videos.append(video_data)

    with open(os.path.join(OUTPUT_DIR, "final_output.json"), "w") as f:
        json.dump(all_videos, f, indent=2)

    print(f"\n✅ Done — {len(all_videos)} videos saved")
    return all_videos


def run_pipeline(brand: str, on_stage=None) -> list:
    """Full pipeline: scrape → perceive → synthesize → deck."""
    if on_stage:
        on_stage("scraping")
    scraper.run(brand)

    with open(ADS_PATH, "r") as f:
        ads = json.load(f)

    urls = _urls_from_ads(ads)
    if not urls:
        raise RuntimeError("No video URLs found in cache/ads.json after scraping")

    if on_stage:
        on_stage("perceiving")
    all_videos = run_perceive(urls)

    if on_stage:
        on_stage("synthesising")
    print("\n🔍 Running synthesis...")
    run_synthesize()

    if on_stage:
        on_stage("building")
    print("\n📊 Generating deck...")
    run_deck()

    print("\n🎉 Pipeline complete")
    return all_videos


def _run_job(job_id: str, brand: str):
    try:
        def on_stage(stage: str):
            jobs[job_id]["stage"] = stage

        run_pipeline(brand, on_stage=on_stage)
        jobs[job_id]["done"] = True
        jobs[job_id]["download_url"] = f"{PUBLIC_BASE}/files/pitch.pptx"
    except Exception as e:
        jobs[job_id]["error"] = str(e)
        jobs[job_id]["done"] = True
        print(f"[orchestrate] job {job_id} failed: {e}", flush=True)


@app.post("/run")
def start_run():
    data = request.get_json(silent=True) or {}
    brand = (data.get("brand") or "").strip()
    if not brand:
        return jsonify({"error": "brand required"}), 400

    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "brand": brand,
        "stage": "scraping",
        "done": False,
        "error": None,
        "download_url": None,
    }
    threading.Thread(target=_run_job, args=(job_id, brand), daemon=True).start()
    return jsonify({"job_id": job_id})


@app.get("/status/<job_id>")
def status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "unknown job"}), 404

    payload = {"stage": job["stage"], "done": job["done"]}
    if job["error"]:
        payload["error"] = job["error"]
    return jsonify(payload)


@app.get("/result/<job_id>")
def result(job_id: str):
    job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "unknown job"}), 404
    if not job["done"] or job["error"]:
        return jsonify({"error": "not ready"}), 404
    return jsonify({"download_url": job["download_url"]})


@app.get("/files/<path:filename>")
def serve_file(filename: str):
    return send_from_directory(CACHE_DIR, filename)


def run_cli_from_ads():
    """Run perceive → synthesize → deck from existing cache/ads.json (no scrape)."""
    with open(ADS_PATH, "r") as f:
        ads = json.load(f)
    urls = _urls_from_ads(ads)
    run_perceive(urls)
    run_synthesize()
    run_deck()


if __name__ == "__main__":
    if "--cli" in sys.argv:
        run_cli_from_ads()
    else:
        print(f"Starting orchestrator on http://localhost:{API_PORT}")
        app.run(host="0.0.0.0", port=API_PORT, debug=False, threaded=True)
