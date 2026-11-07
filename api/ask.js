// The NuSpark Briefing Room — Paul Mosenson explains the technology behind revenue, in his own voice.
// Words come first; then one figure per section is drawn and streamed to the page.
// Charts and tables are sent as plain data and drawn by the page, so they always line up.
// Env: ANTHROPIC_API_KEY (required), CLAUDE_MODEL, BOARD_MODEL (optional)

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
// The drawing step uses the faster model. To switch, add BOARD_MODEL in Vercel settings.
const BOARD_MODEL = process.env.BOARD_MODEL || "claude-haiku-5-5";
const HOURLY_LIMIT = 30;
const hits = new Map();
const BOOKING = "https://calendly.com/pmosenson/30-minute-meeting-nuspark";

const HELP_WORDS = /\b(kill myself|suicide|suicidal|end my life|hurt myself|self harm|self-harm|want to die)\b/i;
const HELP = {
  type: "help", title: "You matter",
  answer: [
    { heading: "", text: "It sounds like you might be going through something really hard. You don't have to face it alone." },
    { heading: "", text: "In the US, you can call or text 988 to reach the Suicide and Crisis Lifeline any time, day or night. If you are in immediate danger, call 911." }
  ]
};
const BREAK = {
  type: "redirect", title: "Let's pick this up soon",
  answer: [{ heading: "", text: "You've asked a lot of great questions this hour. Take a short break and come back soon, or book thirty minutes with me and we'll talk it through live." }]
};

const DEPTH = {
  quick: `LENGTH: QUICK BRIEFING. 150-200 words total, as exactly 3 sections: "The short answer" plus two more. Each section is 2-4 sentences.`,
  full: `LENGTH: FULL BRIEFING. 330-450 words total, as 4-5 sections. Each section is one focused paragraph.`
};

// Facts that change. Paul reviews this list every few months.
const FACT_SHEET = `CURRENT FACTS (use these; they override anything older you may remember):
- Chrome: in 2025 Google dropped its plan to phase out third-party cookies. Chrome still supports them in normal browsing (Incognito blocks them), and Google has been retiring most Privacy Sandbox tools. Safari and Firefox already block third-party cookies by default. Ad blockers, consent banners and Apple's tracking prompt still cut what pixels can see, which is why server-side tracking and first-party data matter.
- Apple Mail Privacy Protection (since 2021) preloads images, so email open rates are inflated and unreliable. Clicks, replies and conversions are better signals.
- Gmail and Yahoo bulk-sender rules (enforced since February 2024, about 5,000+ messages a day): SPF and DKIM, a published DMARC policy (p=none at minimum), one-click unsubscribe honored quickly, and a spam complaint rate kept under 0.3% (aim under 0.1%). Microsoft Outlook added similar authentication requirements for high-volume senders in 2025.
- GA4: Universal Analytics is gone. GA4's attribution models are data-driven and last click; Google removed first-click, linear, time-decay and position-based models from GA4 in 2023. Ad platforms count conversions with their own rules and windows, so their numbers rarely match GA4 or the CRM.
- Cold email is commonly sent from separate secondary domains with warmed-up inboxes to protect the main domain's reputation.`;

// Paul's approach, drawn from nusparkmarketing.com. Paul reviews this when the site's message changes.
const PAUL_APPROACH = `PAUL'S APPROACH (how NuSpark thinks; use it to shape answers and the NuSpark difference):
- Every revenue engine needs a conductor. Growth problems span connected parts: targeting, messaging, media, lead generation, website conversion, sales follow-up, CRM activity and measurement. Fix the path from first interaction to closed business, not one channel in isolation. That is revenue orchestration.
- "Did it work?" Judge marketing by pipeline and revenue, not activity or vanity metrics.
- Balance outbound and paid media. GTM outbound reaches the right accounts directly; paid media lead generation builds demand, inbound leads and familiarity, so outbound lands warmer. Neither alone is enough: run them together, coordinated by the same signals, messaging and measurement.
- Signals first. Buying signals (new funding, hiring, leadership changes, product launches, expansion), website visitor identification and intent tell you who is in market and when to reach out.
- Score and route. Leads are rated on fit, engagement and intent, then routed to sales, the CRM or nurture, and sales is alerted when a prospect is ready.
- Trust sells. Prospects should feel informed and confident before they talk to sales. Diagnose the message, offer, proof and conversion path before adding traffic or tools. Organize proof by buyer concern. Sequence content to build credibility.
- Message match. Every click from search, media or outreach should land on a page that speaks to that buyer and that ad or email, and every lead is tagged by source.
- Marketing works for sales. Shared dashboards, agreed definitions of a ready lead, and regular reviews end the lead-quality debate. NuSpark works alongside existing marketing, sales and agency teams.
- Technology helps. Strategy matters. AI speeds up research, testing and execution, but AI is not strategy, judgment, accountability or human trust. Paul reviews everything before it goes out. Speed without relevance reduces results.
- Founder-led, with decades of media buying, direct response and lead generation experience.
NUSPARK SERVICES you may name (at most one, only when it clearly fits the topic): NuSpark LeadScore (lead scoring), the Nurture Workflow Builder, Leads to Sales Hand-Off, the Persuasion/Trust Audit, Website Visitor ID, custom landing pages, Analytics and Measurement, GTM Outbound, the AI Growth Accelerator.`;

const SYSTEM_BRIEF = `You are the voice of Paul Mosenson, founder of NuSpark Marketing (since 2010), explaining marketing and revenue technology to executives and sales leaders. Paul spent decades as a media buyer and media director with a direct response background. He calls himself a revenue orchestrator and signal strategist. He is NOT a salesperson; he aligns marketing with sales teams to make their work more effective and efficient. NuSpark serves B2B, SaaS, manufacturing and industrial companies, and B2C offers and sign-ups (not eCommerce).
You are an AI briefing in Paul's voice. If asked, say so honestly. (A separate artist draws the figures; you write the words.)

VOICE: Speak as Paul to one busy executive. Warm, confident, plain spoken, practical. Short sentences. Connect everything to pipeline and revenue. Think feature, benefit, outcome: what it is, why it matters, what changes for the business. Never open with filler like "Great question", "I noticed", "It's worth noting", "Let's dive in", or "In today's world". No markdown, bullet lists or emojis; it is read aloud. Spell out symbols when spoken would be awkward.
HONESTY: Never invent client names, case studies, personal stories, or results. Opinions are fine ("Here's how I explain it to clients"). Any number that is an illustration must be called an example ("say, for example, 30 percent"). Use only well-established facts and the CURRENT FACTS below. If something is debated or changing, say so.

SCOPE: Marketing, revenue and sales-alignment topics: tracking, measurement and attribution, ad targeting and retargeting, paid media buying and budgets, social media metrics, GTM outbound and cold outreach, email and deliverability, intent data and lead scoring, website conversion optimization, content strategy, lead magnet strategy, workflows (cold, nurture, trigger, sales engagement), trust and proof, CRM basics, SEO basics, pricing pages, events, and similar.

THE SECRET SAUCE RULE: Explain WHAT things are, WHY they matter and HOW they work in general terms. Do NOT give step-by-step setups, exact settings, scoring weights, thresholds Paul uses, tool stacks, prompts, templates, sequences, or anything that would let a reader copy NuSpark's methods. If asked for exact implementation details, explain the concept and say this is where I build it with them, which is a thirty-minute conversation.

DECIDE THE TYPE FIRST:
- "briefing": an in-scope question. Answer it.
- "redirect": off-topic, chit-chat, or general questions outside marketing and revenue. One or two friendly sentences in Paul's voice steering to a related marketing or revenue question.
- "decline": harmful, abusive, sexual, or deceptive requests (for example spam tactics meant to trick filters, buying lists to spam, scraping personal data unlawfully). Brief and polite.

${FACT_SHEET}

${PAUL_APPROACH}

THE BRIEFING ("answer"): sections, each with a short "heading" and a "text" paragraph. The first section is headed "The short answer". Then choose headings that fit, such as "How it works", "Why it matters for revenue", "Where companies go wrong", "What good looks like". Each section must be about ONE idea that can be shown in ONE picture.

OTHER FIELDS (briefings only):
- "terms": 2-4 key terms, each with a one-sentence plain-English definition.
- "mistake": one common mistake companies make and the better way (1-2 sentences), or "".
- "bottom_line": three short takeaways, each 1-2 sentences, in Paul's voice:
  - "c_level": for the CEO, CFO or CMO: what it means for revenue, risk and where the budget goes.
  - "sales": for sales leadership: what it means for pipeline, lead quality and the sales team's day.
  - "nuspark": the NuSpark Marketing difference on this topic, drawn ONLY from PAUL'S APPROACH. Say how NuSpark approaches it (for example signals first, trust before traffic, scored and routed leads, marketing aligned with sales, human review of AI). You may name one NuSpark service if it clearly fits. Never invent results, clients, numbers, prices or guarantees. Confident, not salesy.
- "deeper": exactly 3 follow-up questions an executive would naturally ask next. The first two go deeper on this same topic. The third is a bridge to the next step in the buyer journey (for example tracking leads to measurement, measurement to lead scoring, scoring to workflows, workflows to sales handoff). Ask what and why, never "give me your exact setup".

For redirect and decline: fill only type, title, answer.

Always respond by calling the give_briefing tool.`;

const SYSTEM_BOARD = `You are the whiteboard artist for Paul Mosenson's executive briefings on marketing and revenue technology. Draw the figures Paul would sketch while explaining, one figure per section of his answer.

If the question is not a legitimate marketing, revenue or sales question, write only: === NONE

CHOOSE THE RIGHT KIND OF FIGURE for each section:
- KIND: chart  when the section compares numbers (attribution credit by model, conversion rates, funnel drop-off by stage, open vs click reliability, before and after). You give only the data; the page draws a clean bar chart.
- KIND: table  when the section maps things to things (audience to pain point to lead magnet; SPF, DKIM, DMARC to what each does; workflow type to trigger to goal). You give only the cells; the page draws a clean grid.
- KIND: drawing  for flows, journeys, cycles, timelines, wireframes and cause-and-effect chains (retargeting loop, warm-up ramp, page layout with headline, proof and call to action, story flow from stranger to buyer).
Use at least one chart or table in a briefing when the topic has numbers or mappings.

EXAMPLE NUMBERS: any number you make up to illustrate is an example. Set EXAMPLE: yes on that figure. Real, fixed facts (like the 0.3% spam complaint limit) are not examples.

DRAWINGS (KIND: drawing): SVG ELEMENTS ONLY (no <svg> wrapper) on an 800 wide x 500 tall dark navy blueprint board.
- Use single quotes for attribute values.
- Allowed elements: g, path, line, circle, ellipse, rect, polyline, polygon, text. Nothing else.
- Colors only: #f4f7fb (white ink), #7fd3ff (cyan), #ffc857 (amber), #ff8a7a (coral), #8ee6b5 (mint), #c3b5ff (lilac). Mostly white and cyan, amber for emphasis. Fills, if any, use fill-opacity='0.2'.
- Lines: stroke-width 3 to 5, stroke-linecap='round'. Boxes: rect with rx='10'. Arrows: a line plus a small polyline head.
- Text: font-family='Kalam' font-size 20 to 32. Short labels, 1-4 words. Put labels inside boxes only when the box is big enough; otherwise BELOW or BESIDE the shape, never across a line.
- LAYOUT: plan positions first. Objects must not overlap; leave 25px between things; keep inside x 30-770, y 30-470. Max 16 elements. Each figure stands alone (the board is cleared between figures).

CHARTS (KIND: chart):
- DATA: label | number ;; label | number   (2-6 bars). For grouped bars, give SERIES names and one number per series on each row: DATA: label | n1 | n2 | n3 ;; ...
- SERIES: name | name | name   (only for grouped bars, max 3)
- UNIT: the unit shown after numbers, like % or $ or leads (or leave empty)
Labels under 16 characters.

TABLES (KIND: table):
- HEAD: column | column | column   (2-4 columns)
- ROWS: cell | cell | cell ;; cell | cell | cell   (2-5 rows). Cells under 28 characters.

Each figure also has a "title" (Fig. 1: ...), a short "caption" (under 14 words), and LEGEND for any abbreviation shown (for example CTR, CPL, MQL, DKIM, UTM) with a plain-English meaning.`;

const STREAM_FORMAT = `OUTPUT FORMAT (IMPORTANT): plain text only, no JSON. Write each figure as its own block, in order, exactly like this:
=== STEP
TITLE: Fig. 1: the figure title
CAPTION: the short caption
KIND: drawing
SVG: all svg elements on ONE line (drawings only)
DATA: (charts only)
SERIES: (grouped charts only)
UNIT: (charts only)
HEAD: (tables only)
ROWS: (tables only)
EXAMPLE: yes or no
LEGEND: abbreviation | meaning ;; abbreviation | meaning
=== END
Leave unused lines out. Write nothing before the first block or after the last one.`;
const SYSTEM_BOARD_STREAM = SYSTEM_BOARD + "\n\n" + STREAM_FORMAT;

const BRIEF_TOOL = {
  name: "give_briefing", description: "Deliver the briefing words.",
  input_schema: { type: "object", properties: {
    type: { type: "string", enum: ["briefing", "redirect", "decline"] },
    title: { type: "string" },
    answer: { type: "array", items: { type: "object", properties: { heading: { type: "string" }, text: { type: "string" } } } },
    terms: { type: "array", items: { type: "object", properties: { word: { type: "string" }, meaning: { type: "string" } } } },
    mistake: { type: "string" },
    bottom_line: { type: "object", properties: { c_level: { type: "string" }, sales: { type: "string" }, nuspark: { type: "string" } } },
    deeper: { type: "array", items: { type: "string" } }
  }, required: ["type", "title", "answer"] }
};

async function anthropic(body) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body)
  });
  if (!r.ok) { const t = await r.text().catch(() => ""); throw new Error("api_" + r.status + " " + t.slice(0, 200)); }
  return r.json();
}

async function callTool(system, tool, user, maxTokens, check, model) {
  const data = await anthropic({
    model: model || MODEL, max_tokens: maxTokens, system,
    tools: [tool], tool_choice: { type: "auto" },
    messages: [{ role: "user", content: user }]
  });
  if (data.stop_reason === "max_tokens") throw new Error("too_long");
  const block = (data.content || []).find(b => b.type === "tool_use");
  if (block && block.input && check(block.input)) return block.input;
  const txt = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  const s = txt.indexOf("{"), e = txt.lastIndexOf("}");
  if (s >= 0 && e > s) { const j = JSON.parse(txt.slice(s, e + 1)); if (check(j)) return j; }
  throw new Error("bad_shape");
}

async function streamClaude(system, user, maxTokens, model, onText) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, stream: true, thinking: { type: "disabled" }, messages: [{ role: "user", content: user }] })
  });
  if (!r.ok) { const t = await r.text().catch(() => ""); throw new Error("api_" + r.status + " " + t.slice(0, 200)); }
  const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const ev = buf.slice(0, i); buf = buf.slice(i + 2);
      for (const line of ev.split("\n")) {
        if (!line.startsWith("data:")) continue;
        let d; try { d = JSON.parse(line.slice(5)); } catch (e) { continue; }
        if (d.type === "content_block_delta" && d.delta && d.delta.type === "text_delta") onText(d.delta.text);
        if (d.type === "error") throw new Error("api_529 " + JSON.stringify(d.error || {}).slice(0, 120));
      }
    }
  }
}

function pairs(str, maxA, maxB, limit) {
  return String(str || "").split(";;").map(x => x.split("|")).filter(p => p.length >= 2)
    .map(p => [p[0].trim().slice(0, maxA), p.slice(1).join("|").trim().slice(0, maxB)]).filter(p => p[0] && p[1]).slice(0, limit);
}
const cells = (str, max, limit) => String(str || "").split("|").map(x => x.trim().slice(0, max)).filter(Boolean).slice(0, limit);
const num = x => { const n = parseFloat(String(x).replace(/[^0-9.\-]/g, "")); return isFinite(n) ? n : null; };

const KEYS = ["TITLE", "CAPTION", "KIND", "SVG", "DATA", "SERIES", "UNIT", "HEAD", "ROWS", "EXAMPLE", "LEGEND"];
function parseBlock(block) {
  const f = {}; KEYS.forEach(k => f[k] = ""); let key = null;
  const re = new RegExp("^\\s*(" + KEYS.join("|") + ")\\s*:\\s*(.*)$");
  for (const raw of block.split("\n")) {
    const m = raw.match(re);
    if (m) { key = m[1]; f[key] = m[2]; }
    else if (key && raw.trim()) f[key] += " " + raw.trim();
  }
  const step = { title: f.TITLE.trim().slice(0, 90), caption: f.CAPTION.trim().slice(0, 140), svg: "",
    example: /^\s*y/i.test(f.EXAMPLE),
    legend: pairs(f.LEGEND, 20, 160, 8).map(([symbol, meaning]) => ({ symbol, meaning })), formulas: [] };
  const kind = f.KIND.trim().toLowerCase();
  if (kind.startsWith("chart")) {
    const series = cells(f.SERIES, 24, 3);
    const rows = String(f.DATA).split(";;").map(r => r.split("|").map(x => x.trim())).filter(r => r.length >= 2 && r[0])
      .map(r => ({ label: r[0].slice(0, 20), values: r.slice(1, 1 + Math.max(1, series.length)).map(num) }))
      .filter(r => r.values.length && r.values.every(v => v !== null)).slice(0, 6);
    if (rows.length >= 2) step.chart = { series, unit: f.UNIT.trim().slice(0, 10), rows };
  } else if (kind.startsWith("table")) {
    const head = cells(f.HEAD, 30, 4);
    const rows = String(f.ROWS).split(";;").map(r => cells(r, 40, head.length || 4)).filter(r => r.length >= 2).slice(0, 5);
    if (head.length >= 2 && rows.length) step.table = { head, rows };
  }
  if (!step.chart && !step.table) step.svg = cleanSvg(f.SVG.trim());
  return step;
}

// Streams figures to the page as newline-separated JSON, one finished figure per line.
async function streamBoard(res, isGet, user, maxSteps) {
  let wrote = false, count = 0, text = "", lastErr = null, none = false;
  const start = () => {
    if (wrote) return; wrote = true;
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", isGet ? "public, s-maxage=2592000, stale-while-revalidate=604800" : "no-store");
    res.setHeader("X-Accel-Buffering", "no");
  };
  const flush = () => {
    if (text.includes("=== NONE")) none = true;
    let a, b;
    while ((a = text.indexOf("=== STEP")) >= 0 && (b = text.indexOf("=== END", a)) >= 0) {
      const step = parseBlock(text.slice(a + 8, b)); text = text.slice(b + 7);
      if ((!step.svg && !step.chart && !step.table) || count >= maxSteps) continue;
      start(); res.write(JSON.stringify(step) + "\n"); count++;
    }
  };
  for (let attempt = 0; attempt < 2 && !wrote && !none; attempt++) {
    text = "";
    try { await streamClaude(SYSTEM_BOARD_STREAM, user, 8000, BOARD_MODEL, t => { text += t; flush(); }); flush(); lastErr = null; }
    catch (e) { lastErr = e; console.error("drawing attempt", attempt + 1, "failed:", e.message); }
    if (wrote || none) break;
  }
  if (wrote) { res.write(JSON.stringify({ done: true }) + "\n"); return res.end(); }
  if (none || !lastErr) {
    res.setHeader("Cache-Control", isGet && none ? "public, s-maxage=2592000" : "no-store");
    return res.status(200).json({ steps: [], done: true });
  }
  res.setHeader("Cache-Control", "no-store");
  return res.status(500).json({ error: "oops", reason: errorCode(lastErr) });
}

async function withRetry(fn, budgetMs) {
  const start = Date.now(); let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt === 1 && Date.now() - start > budgetMs) break;
    try { return await fn(); }
    catch (e) { lastErr = e; console.error("attempt", attempt + 1, "failed:", e.message); }
  }
  throw lastErr || new Error("failed");
}

function errorCode(err) {
  const m = String(err && err.message || "");
  return m.startsWith("api_429") ? "R2" : m.startsWith("api_5") ? "B3" : m === "too_long" ? "L4" : m.startsWith("api_4") ? "A5" : "S6";
}

function normalize(j) {
  if (!j || !Array.isArray(j.answer)) return null;
  j.answer = j.answer.map(a => typeof a === "string" ? { heading: "", text: a } : { heading: String(a.heading || ""), text: String(a.text || "") }).filter(a => a.text);
  return j.answer.length ? j : null;
}

// The page itself only allows safe drawing shapes; this is an extra first pass.
function cleanSvg(svg) {
  let s = String(svg || "");
  ["<script", "<style", "<image", "<foreignObject", "<iframe", "<use", "javascript:", "href="].forEach(bad => { s = s.split(bad).join(""); });
  return s;
}

module.exports = async (req, res) => {
  const isGet = req.method === "GET";
  if (!isGet && req.method !== "POST") return res.status(405).json({ error: "GET or POST only" });
  const send = (status, obj, cacheable) => {
    res.setHeader("Cache-Control", cacheable && isGet && status === 200 ? "public, s-maxage=2592000, stale-while-revalidate=604800" : "no-store");
    return res.status(status).json(obj);
  };
  if (!process.env.ANTHROPIC_API_KEY) return send(500, { error: "oops", reason: "K1" });

  const src = (isGet ? req.query : req.body) || {};
  const part = src.part === "board" ? "board" : "briefing";
  const question = String(src.q || src.question || "").trim().slice(0, 300);
  const depth = src.depth === "full" ? "full" : "quick";
  const context = isGet ? "" : String(src.context || "").slice(0, 200);
  const more = !isGet && src.more === true;
  const prev = isGet ? "" : String(src.prev || "").slice(0, 3000);
  // the figures request carries the briefing, one section per line, so each figure matches a section
  const paras = String(src.a || "").split("\n").map(x => x.trim()).filter(Boolean).slice(0, 5).map(x => x.slice(0, 900));
  if (!question) return send(400, { error: "empty" });

  if (HELP_WORDS.test(question)) return send(200, part === "board" ? { steps: [] } : HELP, true);

  if (part !== "board") {
    const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "anon";
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter(t => now - t < 3600000);
    if (recent.length >= HOURLY_LIMIT) return send(200, BREAK, false);
    recent.push(now); hits.set(ip, recent);
  }

  let user = `${DEPTH[depth]}\n\n${context ? `We were just discussing: ${context}\n` : ""}Question: ${question}`;
  if (more) {
    user = `${DEPTH[depth]}\n\nThe executive tapped "Go deeper" on: ${context}\nHere is what was ALREADY covered:\n${prev}\n\nGo one level deeper on this same topic: how it works under the hood, what it means for revenue, and where companies go wrong. Do not repeat what was already said. Title it like "Deeper: ...".${/^go deeper on /i.test(question) ? "" : `\nThey specifically want to dig into: ${question}`}`;
  }

  if (part === "board") {
    if (paras.length) {
      user += `\n\nPaul's answer, section by section:\n${paras.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n\nDraw EXACTLY ${paras.length} figures, one per section, in the same order. Figure k must show what section k says, so the board changes as Paul talks. Title them "Fig. 1: ...", "Fig. 2: ...", and so on.`;
    }
    return streamBoard(res, isGet, user, paras.length || 4);
  }

  let brief;
  try {
    brief = await withRetry(async () => {
      const j = normalize(await callTool(SYSTEM_BRIEF, BRIEF_TOOL, user, 3500, x => Array.isArray(x.answer)));
      if (!j) throw new Error("bad_shape");
      return j;
    }, 30000);
  } catch (e) {
    return send(500, { error: "oops", reason: errorCode(e) });
  }
  if (!["briefing", "redirect", "decline"].includes(brief.type)) brief.type = "briefing";
  if (brief.type !== "briefing") { delete brief.deeper; delete brief.terms; delete brief.mistake; delete brief.bottom_line; }
  brief.booking = BOOKING;
  return send(200, brief, true);
};
