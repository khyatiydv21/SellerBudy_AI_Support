// SellerBuddy - serverless chat endpoint (Vercel).
// 1) retrieves the most relevant FAQ entries, 2) asks Gemini to answer ONLY from them,
// 3) returns the reply plus a ticket analysis (category, priority, sentiment, escalation).

const FAQS = require("../data/faqs.json");

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const CATEGORIES = ["Payments", "Listings", "Shipping", "Returns", "Account", "Growth", "Orders", "Tax", "Other"];

const STOP = new Set("the a an is are was were to of in on for and or my i me how do does can what why when it this that with from be have has not no".split(" "));
const tokenize = (s) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));

// Simple keyword-overlap retrieval (kept dependency-free on purpose).
function retrieve(query, k = 3) {
  const q = new Set(tokenize(query));
  return FAQS.map((f) => {
    const words = tokenize(`${f.topic} ${f.q} ${f.a}`);
    let score = 0;
    for (const w of words) if (q.has(w)) score += 1;
    return { f, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.f);
}

function buildSystemPrompt(context) {
  const kb = context.length
    ? context.map((f) => `[${f.id}] Q: ${f.q}\nA: ${f.a}`).join("\n\n")
    : "(no relevant FAQ found)";
  return `You are SellerBuddy, a friendly support assistant for online marketplace sellers.

RULES
- Answer ONLY using the FAQ entries below. Never invent policies, numbers, or timelines.
- If the FAQ does not cover the question, say you are not sure and set needs_human to true.
- Be concise, warm, and practical. Use simple English. Give steps when helpful.
- If the seller is angry, apologise briefly and focus on the next step.
- Money loss, account blocks, fraud, or repeated unresolved problems => needs_human true.

Respond with JSON only, using exactly these keys:
{
  "reply": string,
  "category": one of ${JSON.stringify(CATEGORIES)},
  "priority": "low" | "medium" | "high",
  "sentiment": "positive" | "neutral" | "frustrated",
  "needs_human": boolean,
  "used_faq_ids": string[]
}

FAQ ENTRIES
${kb}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "GEMINI_API_KEY is not set on the server." });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const history = Array.isArray(body.messages) ? body.messages.slice(-10) : [];
    const last = [...history].reverse().find((m) => m.role === "user");
    if (!last || !String(last.content).trim()) return res.status(400).json({ error: "Empty message." });

    // Retrieve using the last two user messages so follow-ups keep context.
    const userMsgs = history.filter((m) => m.role === "user").slice(-2).map((m) => m.content).join(" ");
    const context = retrieve(userMsgs);

    const payload = {
      systemInstruction: { parts: [{ text: buildSystemPrompt(context) }] },
      contents: history.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: String(m.content).slice(0, 2000) }],
      })),
      generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
    };

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(payload),
      }
    );
    if (!r.ok) {
      const t = await r.text();
      return res.status(502).json({ error: "Gemini API error", detail: t.slice(0, 300) });
    }
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";

    let out;
    try {
      out = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
      out = { reply: text || "Sorry, something went wrong.", category: "Other", priority: "medium", sentiment: "neutral", needs_human: true, used_faq_ids: [] };
    }
    if (!CATEGORIES.includes(out.category)) out.category = "Other";
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: "Server error", detail: String(e.message || e) });
  }
};

module.exports.retrieve = retrieve; // exported for testing
