// Paul's cloned voice — ElevenLabs text-to-speech with word timing (for read-along).
// Env (all optional except the key):
//   ELEVENLABS_API_KEY    required for Paul's voice (without it the page uses the browser's voice)
//   ELEVENLABS_VOICE_ID   which clone (default: Paul M "Natural, conversational")
//   ELEVENLABS_MODEL      eleven_v4 or eleven_multilingual_v2 (default)
//   ELEVENLABS_STABILITY  0 to 1, lower = more lively (default 0.42)
//   ELEVENLABS_SIMILARITY 0 to 1, how closely it copies the clone (default 0.85)
//   ELEVENLABS_STYLE      0 to 1, expressiveness (v2 only; default 0.3)
// GET requests are saved on Vercel's network, so a repeat answer plays instantly and costs no ElevenLabs credits.

const DEFAULT_VOICE = "P5UCj2FDnKwXbWMj78sE";
const num = (v, d) => { const n = parseFloat(v); return isFinite(n) && n >= 0 && n <= 1 ? n : d; };
const cache = new Map();

module.exports = async (req, res) => {
  if (!allowedRequest(req)) return blockRequest(res);
  const isGet = req.method === "GET";
  if (!isGet && req.method !== "POST") return res.status(405).json({ error: "GET or POST only" });
  const key = process.env.ELEVENLABS_API_KEY;
  const voice = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE;
  const model = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
  if (!key) { res.setHeader("Cache-Control", "no-store"); return res.status(501).json({ error: "voice_off" }); }

  const text = String((isGet ? req.query.t : (req.body || {}).text) || "").trim().slice(0, 4000);
  if (!text) return res.status(400).json({ error: "empty" });
  const sp = String((isGet ? req.query.s : (req.body || {}).speed) || "");
  const speed = ({ slow: 0.75, fast: 1.2 })[sp] || 1.0;   // Slower, Normal, Faster
  const ck = speed + "|" + text;
  const ok = out => {
    res.setHeader("Cache-Control", isGet ? "public, s-maxage=2592000, stale-while-revalidate=604800" : "no-store");
    return res.json(out);
  };
  const fail = () => { res.setHeader("Cache-Control", "no-store"); return res.status(502).json({ error: "voice_failed" }); };
  if (cache.has(ck)) return ok(cache.get(ck));

  // v4 only takes stability and similarity; v2 also takes style and speaker boost
  const isV4 = /v4/i.test(model);
  const voice_settings = {
    stability: num(process.env.ELEVENLABS_STABILITY, 0.42),
    similarity_boost: num(process.env.ELEVENLABS_SIMILARITY, 0.85)
  };
  if (!isV4) { voice_settings.style = num(process.env.ELEVENLABS_STYLE, 0.3); voice_settings.use_speaker_boost = true; }
  if (speed !== 1.0) voice_settings.speed = speed;
  const body = JSON.stringify({ text: speakable(text).out, model_id: model, voice_settings });
  const headers = { "xi-api-key": key, "content-type": "application/json" };
  const base = `https://api.elevenlabs.io/v1/text-to-speech/${voice}`;

  try {
    // 1) with word timing (drives the read-along highlight and figure changes)
    let r = await fetch(`${base}/with-timestamps?output_format=mp3_44100_128`, { method: "POST", headers, body });
    if (r.ok) {
      const d = await r.json();
      const out = { audio: d.audio_base64, alignment: remapAlign(d.alignment || d.normalized_alignment || null, text), model };
      if (out.audio) { remember(ck, out); return ok(out); }
    } else console.error("voice with timing failed", r.status, (await r.text().catch(() => "")).slice(0, 200));

    // 2) plain audio if this model can't give timing; the page then follows the voice by time
    r = await fetch(`${base}?output_format=mp3_44100_128`, { method: "POST", headers, body });
    if (!r.ok && voice_settings.speed) {
      console.error("voice failed with speed", r.status, (await r.text().catch(() => "")).slice(0, 200));
      delete voice_settings.speed;
      r = await fetch(`${base}?output_format=mp3_44100_128`, { method: "POST", headers, body: JSON.stringify({ text: speakable(text).out, model_id: model, voice_settings }) });
    }
    if (!r.ok) { console.error("voice failed", r.status, (await r.text().catch(() => "")).slice(0, 200)); return fail(); }
    const buf = Buffer.from(await r.arrayBuffer());
    const out = { audio: buf.toString("base64"), alignment: null, model };
    remember(ck, out); return ok(out);
  } catch (e) {
    console.error("voice error", e.message);
    return fail();
  }
};

function remember(ck, out) {
  if (cache.size > 200) cache.clear();
  cache.set(ck, out);
}

// ---------- read math symbols out loud ----------
// "C1 x V1" or "3 x 4" -> "times" (not "ex"), × -> "times", π -> "pie" (so it is never read "p-i"), ² -> "squared", ³ -> "cubed",
// √ -> "the square root of". The read-along timing is mapped back to the original letters,
// so the word highlighting on screen still lines up.
const SAY_SYMBOL = { "x": "times", "×": "times", "π": "pie", "²": "squared", "³": "cubed", "√": "the square root of" };
function speakable(text) {
  const re = /(\d[\d.,]*(?:\s?(?:cm|mm|km|m|in|ft|yd|inches|feet|meters|units))?|\b[A-Za-z]{1,3}\d+[A-Za-z]?|\))(\s*)(x)(\s*)(?=\d|\(|[A-Za-z]{1,3}\d)|([×π²³√])/g;
  let out = "", last = 0, m;
  const map = new Array(text.length);
  while ((m = re.exec(text))) {
    const xPos = m[5] ? m.index : m.index + m[1].length + m[2].length;
    for (let i = last; i < xPos; i++) { map[i] = out.length; out += text[i]; }
    const prev = xPos > 0 ? text[xPos - 1] : "", next = xPos + 1 < text.length ? text[xPos + 1] : "";
    const padL = (!prev || /[\s(]/.test(prev)) ? "" : " ";
    const padR = (!next || /[\s.,;:!?)]/.test(next)) ? "" : " ";
    map[xPos] = out.length + padL.length;
    out += padL + SAY_SYMBOL[text[xPos]] + padR;
    last = xPos + 1;
    re.lastIndex = last;
  }
  for (let i = last; i < text.length; i++) { map[i] = out.length; out += text[i]; }
  return { out, map };
}
function remapAlign(al, text) {
  const { out, map } = speakable(text);
  if (!al || out === text || !Array.isArray(al.character_start_times_seconds) || al.character_start_times_seconds.length !== out.length) return al;
  const s = al.character_start_times_seconds, e = al.character_end_times_seconds || s;
  return { characters: text.split(""), character_start_times_seconds: map.map(j => s[j]), character_end_times_seconds: map.map(j => e[j]) };
}

// ---------- website lock ----------
// Only answer this tool's own pages and Paul's websites, so nobody else can run the tool on his credits.
// Add more sites in Vercel with an ALLOWED_SITES setting (comma separated); set LOCK_OFF to 1 to switch the lock off.
function allowedRequest(req) {
  if (String(process.env.LOCK_OFF || "") === "1") return true;
  const sites = ["nusparkpublishing.com", "nusparkmarketing.com", "nusparklearnwow.com"]
    .concat(String(process.env.ALLOWED_SITES || "").split(",").map(s => s.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")).filter(Boolean));
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").toLowerCase().split(":")[0];
  const ok = u => {
    try {
      const h = new URL(u).hostname.toLowerCase();
      return h === host || h === "localhost" || h === "127.0.0.1" || sites.some(d => h === d || h.endsWith("." + d));
    } catch (e) { return false; }
  };
  const origin = req.headers.origin, ref = req.headers.referer || req.headers.referrer;
  if (origin && origin !== "null") return ok(origin);
  if (ref) return ok(ref);
  return req.method === "GET"; // quick status checks; browsers always say where a POST comes from
}
function blockRequest(res) {
  res.statusCode = 403;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ error: "not_allowed", message: "This tool only works on NuSpark websites." }));
}
