from perceive import perceive_multiple
import json, os

BASE = os.path.dirname(os.path.abspath(__file__))

def run_autopsy(video_urls: list):
    results = perceive_multiple(video_urls)

    all_videos = []

    for result in results:
        if "error" in result:
            all_videos.append(result)
            continue

        # no need to merge anymore — perceive.py already did it
        video_data = {
            "video_id": result["video_id"],
            "url": result["url"],
            "unified": result["unified"]
        }

        safe_name = result["video_id"]
        with open(os.path.join(BASE, "cache", f"{safe_name}.json"), "w") as f:
            json.dump(video_data, f, indent=2)

        all_videos.append(video_data)

    with open(os.path.join(BASE, "cache", "final_output.json"), "w") as f:
        json.dump(all_videos, f, indent=2)

    print(f"\n✅ Done — {len(all_videos)} videos saved")
    return all_videos

if __name__ == "__main__":
    with open(os.path.join(BASE, "cache", "ads.json"), "r") as f:
        urls = json.load(f)

    run_autopsy(urls)