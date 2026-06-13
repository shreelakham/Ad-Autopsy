import json, os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

BASE = os.path.dirname(os.path.abspath(__file__))

def build_deck():
    with open(os.path.join(BASE, "cache", "autopsy.json"), "r") as f:
        data = json.load(f)

    prs = Presentation()
    prs.slide_width = Inches(13.33)
    prs.slide_height = Inches(7.5)

    DARK = RGBColor(15, 15, 30)
    WHITE = RGBColor(255, 255, 255)
    ACCENT = RGBColor(108, 99, 255)

    def add_slide(title, body, bg=DARK):
        slide = prs.slides.add_slide(prs.slide_layouts[6])  # blank
        # background
        fill = slide.background.fill
        fill.solid()
        fill.fore_color.rgb = bg

        # title
        txb = slide.shapes.add_textbox(Inches(0.5), Inches(0.4), Inches(12), Inches(1))
        tf = txb.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = title
        p.font.size = Pt(32)
        p.font.bold = True
        p.font.color.rgb = WHITE

        # body
        txb2 = slide.shapes.add_textbox(Inches(0.5), Inches(1.6), Inches(12), Inches(5.5))
        tf2 = txb2.text_frame
        tf2.word_wrap = True
        p2 = tf2.paragraphs[0]
        p2.text = body
        p2.font.size = Pt(18)
        p2.font.color.rgb = WHITE

        return slide

    # Slide 1 — title
    add_slide(
        f"{data['competitor']} Ad Autopsy",
        f"Competitive analysis for {data['brand']} | Powered by AI"
    )

    # Slide 2 — patterns
    for i, pattern in enumerate(data.get("patterns", [])):
        add_slide(
            f"Pattern {i+1}",
            pattern["insight"]
        )

    # Slide 3 — gap
    add_slide("The Gap", data.get("gap", ""))

    # Slide 4 — opportunity
    add_slide(
        f"Opportunity for {data['brand']}",
        data.get(f"opportunity_for_{data['brand'].lower()}", "")
    )

    # Slide 5 — counter creative
    cc = data.get("counter_creative", {})
    add_slide(
        f"Counter Creative: {cc.get('angle', '')}",
        cc.get("script", "")
    )

    out_path = os.path.join(BASE, "cache", "deck.pptx")
    prs.save(out_path)
    print(f"✅ Saved to cache/deck.pptx")

if __name__ == "__main__":
    build_deck()