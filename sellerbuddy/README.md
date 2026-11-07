# SellerBuddy - AI Seller Support Assistant

A small AI assistant that helps online marketplace sellers get quick answers (payments, listings, shipping, returns, account issues) and **auto-triages every message** into category, priority, sentiment and whether a human agent is needed.

Built to explore how AI bots and automations can take over repetitive support work.

**Live demo:** <add your Vercel link>

## How it works
1. **Retrieval:** the seller's message is matched against an FAQ knowledge base (`data/faqs.json`) using keyword scoring.
2. **Grounded generation:** the top matches are passed to the Gemini API with strict rules - answer only from the FAQs, never invent policy, escalate when unsure.
3. **Structured output:** Gemini returns JSON (`reply`, `category`, `priority`, `sentiment`, `needs_human`, `used_faq_ids`) which the UI shows as a chat reply plus a ticket-analysis panel.
4. The API key stays on the server (Vercel serverless function), never in the browser.

## Tech
HTML/CSS/JS frontend, Node.js serverless function, Google Gemini API, deployed on Vercel.

## Run locally
```bash
npm i -g vercel
cp .env.example .env     # add your GEMINI_API_KEY
vercel dev
```
Get a free key at https://aistudio.google.com/apikey

## Deploy
Push to GitHub, import the repo in Vercel, add `GEMINI_API_KEY` under Settings > Environment Variables, deploy.

## What I learned / next steps
- Grounding the model in a knowledge base reduces made-up answers.
- Prompt rules + JSON output make AI replies easy to plug into other automations.
- Next: embeddings-based retrieval, saving tickets to a database, a seller-feedback loop to improve answers.

*FAQ content is sample data written for this demo, not real marketplace policy.*
