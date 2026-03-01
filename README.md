# Gemini TubeSide

**Gemini TubeSide** is a radically lightweight, privacy-centric Manifest V3 (MV3) Chrome Extension for YouTube video summarization. Designed to bypass the bloated JavaScript frameworks, invasive proxy servers, and restrictive paywalls of legacy summarizers, this extension is built entirely with Vanilla JavaScript and 2026 Web API standards. 

By leveraging the Gemini 2.5 Flash API's native `file_data` property, Gemini TubeSide passes public YouTube URLs directly to Google's infrastructure. This enables highly performant multimodal ingestion (processing visual frames, audio tracks, and transcripts) directly on the edge, ensuring instantaneous execution and a microscopic memory footprint.

## 🚀 Core Features & Innovations

*   **Zero-Telemetry BYOK Architecture:** A "Bring Your Own Key" privacy model stores your Google AI Studio (Gemini) API key securely within the browser's `chrome.storage.local`. There are no developer-hosted backend servers, eliminating data exfiltration and server latency.
*   **Semantic Timeline Scrubbing:** Re-engineers the video navigation experience using the 2026 HTML Interest Invoker API. Invisible anchor nodes are injected into the native YouTube progress bar. By using the `interesttarget` attribute, the browser renders hardware-accelerated context popovers natively on hover, completely eliminating JavaScript event listener bloat.
*   **Micro-Interval Querying:** Perform highly specific "Quick Questions" using the `videoMetadata` payload limits (`startOffset` and `endOffset`). This forces the Gemini model to focus its attention mechanism on a narrow time window, slashing token consumption, reducing hallucination rates, and dropping processing latency to milliseconds.
*   **Ephemeral Concept Mapping:** Dynamically generates hierarchical mind maps of video concepts utilizing the CSS Anchor Positioning API (`anchor-name` and `position-anchor`), achieving complex visual layouts purely in CSS without external charting libraries like D3.js or Chart.js.
*   **Seamless YouTube SPA Integration:** Injects a minimalistic custom SVG button seamlessly into the YouTube player (`.ytp-right-controls`) that is designed to survive YouTube's Single Page Application (SPA) navigation events natively.

## 🛡️ Architecture & Security Requirements

*   **Manifest V3 & Ephemeral Service Workers:** Runs entirely on MV3 standards. All state management and API fetch logic reside in `background.js`, an ephemeral Service Worker that terminates when idle to save resources.
*   **Strict Content Security Policy (CSP):** The extension strictly prohibits `innerHTML` assignments for un-sanitized API output to prevent XSS attacks and cross-site scripting vulnerabilities originating from malicious YouTube transcripts. All API responses are safely parsed using custom Vanilla JavaScript DOM manipulation.
*   **No Remotely Hosted Code:** To maintain edge-only security, the extension forbids pulling JavaScript from CDNs. All logic is packaged within the local bundle.

---

## 🏃 How to Run

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right)
3. Click **Load unpacked**
4. Select the `gemini-tubeSide` project directory
5. Right-click the extension icon → **Options** to add your [Google AI Studio](https://aistudio.google.com/apikey) API key
6. Open a YouTube video, click the TubeSide button in the player, and use the side panel to generate summaries

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
- [x] Safe markdown DOM renderer

### Edge case hardening
- [ ] Quota management: graceful 429 / free-tier limit handling in UI
- [ ] Orphaned context: visual fallback when extension is reloaded during use
- [ ] Improved 400 handling for private/unlisted videos

### Future features
- [ ] Popup that instructs user to get an API key (with link to Google AI Studio) when none is set
- [ ] Cache summary/key-takeaway response per video; reuse until user requests "generate again"
- [ ] List of recently summarized videos (key takeaway + smart summary) for quick access
- [ ] Semantic timeline scrubbing (Interest Invoker API on progress bar)
- [ ] Micro-interval querying (`startOffset` / `endOffset`)
- [ ] Ephemeral concept mapping (CSS Anchor Positioning)
