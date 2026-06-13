const pptxgen = require("pptxgenjs");
const fs = require("fs");

const data = JSON.parse(fs.readFileSync("../cache/autopsy.json", "utf8"));

// ── Palette: Midnight Executive ─────────────────────────────
const C = {
  dark:    "1E2761",   // navy — backgrounds
  mid:     "2A3A8C",   // lighter navy — cards
  ice:     "CADCFC",   // ice blue — accents
  white:   "FFFFFF",
  offwhite:"F4F6FF",
  muted:   "8A9BB8",
  accent:  "F96167",   // coral — highlight colour
};

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.title = `Ad Autopsy: ${data.per_ad[0].ad_id.split("_")[0].toUpperCase()}`;

// ─────────────────────────────────────────────────────────────
// SLIDE 1 — Title
// ─────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.dark };

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 4.2, w: 10, h: 1.425,
    fill: { color: C.mid }
  });

  s.addText("AD AUTOPSY", {
    x: 0.6, y: 0.7, w: 8.8, h: 0.7,
    fontSize: 13, bold: true, color: C.ice,
    charSpacing: 6, align: "left"
  });

  const brand = data.per_ad[0].ad_id.split("_")[0].toUpperCase();
  s.addText(brand, {
    x: 0.6, y: 1.3, w: 8.8, h: 2.0,
    fontSize: 64, bold: true, color: C.white, align: "left"
  });

  s.addText(`${data.per_ad.length} ads analysed  ·  ${data.patterns.length} patterns found  ·  1 gap identified`, {
    x: 0.6, y: 4.35, w: 8.8, h: 0.55,
    fontSize: 13, color: C.ice, align: "left"
  });
}

// ─────────────────────────────────────────────────────────────
// SLIDE 2 — Per-ad hooks (one card per ad)
// ─────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.offwhite };

  s.addText("HOW THEY OPEN", {
    x: 0.5, y: 0.25, w: 9, h: 0.5,
    fontSize: 11, bold: true, color: C.muted, charSpacing: 4
  });
  s.addText("First-impression hooks across all ads", {
    x: 0.5, y: 0.65, w: 9, h: 0.45,
    fontSize: 22, bold: true, color: C.dark
  });

  const cols = data.per_ad.length;
  const cardW = (9.0 / cols) - 0.15;

  data.per_ad.forEach((ad, i) => {
    const x = 0.5 + i * (cardW + 0.15);
    const y = 1.3;

    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w: cardW, h: 3.7,
      fill: { color: C.white },
      shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 45, opacity: 0.1 },
      rectRadius: 0.1
    });

    // Ad label
    s.addText(`AD ${i + 1}`, {
      x: x + 0.15, y: y + 0.18, w: cardW - 0.3, h: 0.35,
      fontSize: 9, bold: true, color: C.accent, charSpacing: 3
    });

    // Timestamp badge
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: x + 0.15, y: y + 0.55, w: 0.7, h: 0.28,
      fill: { color: C.dark }, rectRadius: 0.05
    });
    s.addText(`t=${ad.hook.t}s`, {
      x: x + 0.15, y: y + 0.55, w: 0.7, h: 0.28,
      fontSize: 9, bold: true, color: C.white, align: "center"
    });

    // Hook description
    s.addText(ad.hook.desc, {
      x: x + 0.15, y: y + 0.95, w: cardW - 0.3, h: 2.1,
      fontSize: 12, color: "333333", align: "left"
    });

    // Emotional arc
    s.addText(ad.emotional_arc, {
      x: x + 0.15, y: y + 3.1, w: cardW - 0.3, h: 0.45,
      fontSize: 10, italic: true, color: C.muted
    });
  });
}

// ─────────────────────────────────────────────────────────────
// SLIDE 3 — Claims with timestamps
// ─────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.dark };

  s.addText("WHAT THEY SAY — AND WHEN", {
    x: 0.5, y: 0.25, w: 9, h: 0.5,
    fontSize: 11, bold: true, color: C.ice, charSpacing: 4
  });
  s.addText("Spoken claims with timestamps", {
    x: 0.5, y: 0.65, w: 9, h: 0.45,
    fontSize: 22, bold: true, color: C.white
  });

  const colW = 9.0 / data.per_ad.length;
  data.per_ad.forEach((ad, i) => {
    const x = 0.5 + i * colW;

    s.addText(`Ad ${i + 1}`, {
      x, y: 1.3, w: colW - 0.1, h: 0.35,
      fontSize: 11, bold: true, color: C.ice
    });

    ad.claims.forEach((claim, j) => {
      const y = 1.75 + j * 0.9;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y, w: colW - 0.2, h: 0.75,
        fill: { color: C.mid }, rectRadius: 0.07
      });
      s.addText([
        { text: `t=${claim.t}s  `, options: { bold: true, color: C.accent, fontSize: 9 } },
        { text: claim.text, options: { color: C.white, fontSize: 11 } }
      ], { x: x + 0.12, y: y + 0.12, w: colW - 0.44, h: 0.52 });
    });
  });
}

// ─────────────────────────────────────────────────────────────
// SLIDE 4 — Patterns
// ─────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.offwhite };

  s.addText("CROSS-AD PATTERNS", {
    x: 0.5, y: 0.25, w: 9, h: 0.5,
    fontSize: 11, bold: true, color: C.muted, charSpacing: 4
  });
  s.addText("What they always do", {
    x: 0.5, y: 0.65, w: 9, h: 0.45,
    fontSize: 22, bold: true, color: C.dark
  });

  data.patterns.forEach((p, i) => {
    const y = 1.3 + i * 1.05;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.5, y, w: 9, h: 0.88,
      fill: { color: C.white },
      shadow: { type: "outer", color: "000000", blur: 6, offset: 2, angle: 45, opacity: 0.08 },
      rectRadius: 0.08
    });
    s.addText(`${String(i + 1).padStart(2, "0")}`, {
      x: 0.65, y: y + 0.15, w: 0.55, h: 0.55,
      fontSize: 22, bold: true, color: C.ice
    });
    s.addText(p.insight, {
      x: 1.3, y: y + 0.12, w: 7.9, h: 0.65,
      fontSize: 12, color: "333333"
    });
  });
}

// ─────────────────────────────────────────────────────────────
// SLIDE 5 — The Gap (money slide)
// ─────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.accent };

  s.addText("THE GAP", {
    x: 0.6, y: 0.5, w: 8.8, h: 0.55,
    fontSize: 11, bold: true, color: C.white, charSpacing: 6
  });
  s.addText("What they never do", {
    x: 0.6, y: 1.0, w: 8.8, h: 0.6,
    fontSize: 24, bold: true, color: C.white
  });

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.6, y: 1.8, w: 8.8, h: 2.8,
    fill: { color: "FFFFFF", transparency: 15 }, rectRadius: 0.12
  });
  s.addText(`"${data.gap}"`, {
    x: 0.9, y: 2.0, w: 8.2, h: 2.4,
    fontSize: 18, italic: true, color: C.dark, align: "left"
  });
}

// ─────────────────────────────────────────────────────────────
// SLIDE 6 — Counter-creative
// ─────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.dark };

  s.addText("COUNTER-CREATIVE", {
    x: 0.5, y: 0.25, w: 9, h: 0.5,
    fontSize: 11, bold: true, color: C.ice, charSpacing: 4
  });
  s.addText("The ad that exploits the gap", {
    x: 0.5, y: 0.65, w: 9, h: 0.45,
    fontSize: 22, bold: true, color: C.white
  });

  // Angle card
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 1.3, w: 9, h: 0.7,
    fill: { color: C.accent }, rectRadius: 0.08
  });
  s.addText(`ANGLE: ${data.counter_creative.angle}`, {
    x: 0.7, y: 1.38, w: 8.6, h: 0.55,
    fontSize: 13, bold: true, color: C.white
  });

  // Script
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 2.15, w: 9, h: 3.1,
    fill: { color: C.mid }, rectRadius: 0.08
  });
  s.addText(data.counter_creative.script, {
    x: 0.7, y: 2.3, w: 8.6, h: 2.8,
    fontSize: 12, color: C.white, align: "left"
  });
}

// ─────────────────────────────────────────────────────────────
// Write file
// ─────────────────────────────────────────────────────────────
pres.writeFile({ fileName: "ad_autopsy.pptx" })
  .then(() => console.log("ad_autopsy.pptx saved ✓"))
  .catch(e => { console.error(e); process.exit(1); });