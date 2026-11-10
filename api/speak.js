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
  const isGet = req.method === "GET";
  if (!isGet && req.method !== "POST") return res.status(405).json({ error: "GET or POST only" });
  const key = process.env.ELEVENLABS_API_KEY;
  const voice = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE;
  const model = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
  if (!key) { res.setHeader("Cache-Control", "no-store"); return res.status(501).json({ error: "voice_off" }); }

  const text = String((isGet ? req.query.t : (req.body || {}).text) || "").trim().slice(0, 4000);
  if (!text) return res.status(400).json({ error: "empty" });
  const sp = String((isGet ? req.query.s : (req.body || {}).speed) || "");
  const speed = ({ slow: 0.85, fast: 1.15 })[sp] || 1.0;   // Slower, Normal, Faster
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
  const body = JSON.stringify({ text, model_id: model, voice_settings });
  const headers = { "xi-api-key": key, "content-type": "application/json" };
  const base = `https://api.elevenlabs.io/v1/text-to-speech/${voice}`;

  try {
    // 1) with word timing (drives the read-along highlight and figure changes)
    let r = await fetch(`${base}/with-timestamps?output_format=mp3_44100_128`, { method: "POST", headers, body });
    if (r.ok) {
      const d = await r.json();
      const out = { audio: d.audio_base64, alignment: d.alignment || d.normalized_alignment || null, model };
      if (out.audio) { remember(ck, out); return ok(out); }
    } else console.error("voice with timing failed", r.status, (await r.text().catch(() => "")).slice(0, 200));

    // 2) plain audio if this model can't give timing; the page then follows the voice by time
    r = await fetch(`${base}?output_format=mp3_44100_128`, { method: "POST", headers, body });
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
  cache.set(text, out);
}
