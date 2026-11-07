// Paul's cloned voice — ElevenLabs text-to-speech with word timing (for read-along).
// Env: ELEVENLABS_API_KEY (required for Paul's voice), ELEVENLABS_VOICE_ID (optional, defaults to Paul M "Natural, conversational")
// Without the key, the page falls back to the browser's built-in voice.
// GET requests are saved on Vercel's network, so a repeat answer plays instantly and costs no ElevenLabs credits.

const DEFAULT_VOICE = "P5UCj2FDnKwXbWMj78sE";
const cache = new Map();

module.exports = async (req, res) => {
  const isGet = req.method === "GET";
  if (!isGet && req.method !== "POST") return res.status(405).json({ error: "GET or POST only" });
  const key = process.env.ELEVENLABS_API_KEY;
  const voice = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE;
  if (!key) { res.setHeader("Cache-Control", "no-store"); return res.status(501).json({ error: "voice_off" }); }

  const text = String((isGet ? req.query.t : (req.body || {}).text) || "").trim().slice(0, 4000);
  if (!text) return res.status(400).json({ error: "empty" });
  const ok = out => {
    res.setHeader("Cache-Control", isGet ? "public, s-maxage=2592000, stale-while-revalidate=604800" : "no-store");
    return res.json(out);
  };
  if (cache.has(text)) return ok(cache.get(text));

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
        voice_settings: { stability: 0.65, similarity_boost: 0.85, style: 0.05 }
      })
    });
    if (!r.ok) { console.error("voice failed", r.status, (await r.text().catch(() => "")).slice(0, 200)); res.setHeader("Cache-Control", "no-store"); return res.status(502).json({ error: "voice_failed" }); }
    const d = await r.json();
    const out = { audio: d.audio_base64, alignment: d.alignment || d.normalized_alignment || null };
    if (cache.size > 200) cache.clear();
    cache.set(text, out);
    return ok(out);
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ error: "voice_failed" });
  }
};
