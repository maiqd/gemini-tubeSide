# Gemini TubeSide

**Gemini TubeSide** is a radically lightweight, privacy-centric Manifest V3 (MV3) Chrome Extension for YouTube video summarization. Designed to bypass the bloated JavaScript frameworks, invasive proxy servers, and restrictive paywalls of legacy summarizers, this extension is built entirely with Vanilla JavaScript and 2026 Web API standards. 

By leveraging the Gemini 2.5 Flash API's native `file_data` property, Gemini TubeSide passes public YouTube URLs directly to Google's infrastructure. This enables highly performant multimodal ingestion (processing visual frames, audio tracks, and transcripts) directly on the edge, ensuring instantaneous execution and a microscopic memory footprint.

## 🚀 Core Features & Innovations

*   **Zero-Telemetry BYOK Architecture:** A "Bring Your Own Key" privacy model stores your Google AI Studio (Gemini) API key securely in `chrome.storage.local`. No developer-hosted backend; no data exfiltration or server latency.
*   **Typography & Sizing Controls:** Font family selector (Modern Sans, Reading Serif, Code Mono, Accessible) and A-/A+ size buttons in the side panel. Settings persist in `chrome.storage.local`. System fonts only—no external web fonts or network requests.
*   **Theme-Aware Code Styling:** Inline and block code use a dedicated `--code-bg` per theme so snippets stay readable in every theme (Dark, Crisp Light, Reading Paper, Soft Blue).
*   **Theme Selector:** Four themes—YouTube Native (Dark), Crisp Light, Reading Paper (Sepia), Soft Blue—stored and applied via CSS custom properties.
*   **Per-Video Caching:** Smart Summary and Key Takeaways are cached per video; reopening the same video reuses the cached result until you request a fresh run.
*   **Seamless YouTube SPA Integration:** Injects a minimalistic custom SVG button into the YouTube player (`.ytp-right-controls`) that survives YouTube SPA navigation.

## 🛡️ Architecture & Security Requirements

*   **Manifest V3 & Ephemeral Service Workers:** Runs entirely on MV3 standards. All state management and API fetch logic reside in `background.js`, an ephemeral Service Worker that terminates when idle to save resources.
*   **Strict Content Security Policy (CSP):** The extension strictly prohibits `innerHTML` assignments for un-sanitized API output to prevent XSS attacks. API responses are rendered via [MiniGFM](https://github.com/OblivionOcean/MiniGFM), which escapes HTML by default.
*   **No Remotely Hosted Code:** To maintain edge-only security, the extension forbids pulling JavaScript from CDNs. All logic is packaged within the local bundle.

---

## 🏃 How to Run

1. Run `npm install` (builds the side panel bundle)
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right)
4. Click **Load unpacked**
5. Select the `gemini-tubeSide` project directory
6. Right-click the extension icon → **Options** to add your [Google AI Studio](https://aistudio.google.com/apikey) API key
7. Open a YouTube video, click the TubeSide button in the player, and use the side panel to generate **Smart Summary** or **Key Takeaways**. Use the font dropdown and A-/A+ buttons to adjust typography; use the theme dropdown to switch color themes.

After code changes to `sidepanel.js`, run `npm run build` and reload the extension.

---

## 💰 Cost (Gemini 2.5 Flash)

The extension uses **Gemini 2.5 Flash** via `streamGenerateContent` with a short text prompt plus the video (YouTube URL via `file_data.file_uri`). Billing is per token; video length and resolution affect input tokens.

| Tier | Input (per 1M tokens) | Output (per 1M tokens) |
|------|------------------------|-------------------------|
| Paid | $0.30                  | $2.50                   |

**Rough per-request estimate (paid tier):**

- **Input:** ~60 tokens (prompt) + video-dependent (e.g. ~3k–15k tokens for a 5–15 min video) → **~$0.001–$0.005** per summary.
- **Output:** ~200–500 tokens (summary or key takeaways) → **~$0.0005–$0.0013** per response.
- **Total:** **~$0.002–$0.006 per request** (about **$0.20–$0.60 per 100 summaries**).

**Free tier:** Google AI Studio free tier has a **daily request cap** (e.g. 20 requests/day for some models). Once exceeded, you get 429 until the quota resets. See [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) and your [Cloud Console quotas](https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas) for exact limits and current pricing.

---

## 🔑 How to Get an API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click **Create API key** (use an existing Google Cloud project or create one)
4. Copy the key and paste it in the extension **Options** (right-click the icon → Options). The key is stored only in your browser and is not sent to any third party

---

## 📝 TODO

### MVP (Done)
- [x] Project scaffolding and manifest
- [x] YouTube DOM injection with MutationObserver and SPA navigation
- [x] Side panel and BYOK options
- [x] Gemini API fetch with `file_data.file_uri`
- [x] Safe markdown DOM renderer (MiniGFM + structured output styles)
- [x] Typography controls (font family + font size) with persistent storage
- [x] Theme selector and theme-aware code block styling
- [x] Cache summary/key-takeaways per video; reuse until user requests again

### Edge case hardening
- [ ] Quota management: graceful 429 / free-tier limit handling in UI
- [ ] Orphaned context: visual fallback when extension is reloaded during use
- [ ] Improved 400 handling for private/unlisted videos

### Future features
- [ ] Text to speech
- [ ] Popup that instructs user to get an API key (with link to Google AI Studio) when none is set
- [ ] List of recently summarized videos for quick access
- [ ] Semantic timeline scrubbing (Interest Invoker API on progress bar)
- [ ] Micro-interval querying (`startOffset` / `endOffset`)
- [ ] Ephemeral concept mapping (CSS Anchor Positioning)
