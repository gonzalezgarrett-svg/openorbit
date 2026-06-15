// Serverless proxy (Vercel) so the Anthropic API key stays on the server.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Missing prompt" });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "Server is missing ANTHROPIC_API_KEY" });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await r.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: "Upstream error contacting the model" });
  }
}
