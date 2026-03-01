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

## 📝 TODO: Implementation Developer Checklist

The following step-by-step checklist outlines the exact code architecture required to build the MVP, strictly adhering to the "Vanilla JS Builder" persona.

### Phase 1: Project Scaffolding and Manifest Configuration
- [ ] **Directory Structure:** Create a flat directory to minimize complexity: `manifest.json`, `background.js`, `content.js`, `sidepanel.html`/`sidepanel.js`, `options.html`/`options.js`, and `styles.css`.
- [ ] **Configure `manifest.json`:** Define MV3 parameters, register the Service Worker (`type: "module"`), and request minimal permissions (`sidePanel`, `storage`, `activeTab`). Set host permissions to `*://*.youtube.com/*` and `https://generativelanguage.googleapis.com/*`.

### Phase 2: YouTube DOM Injection (Content Scripting)
- [ ] **Implement `MutationObserver`:** Watch for the `.ytp-right-controls` DOM element to load, then disconnect the observer immediately upon finding it to preserve local CPU cycles and memory.
- [ ] **Inject the Action Button:** Create a Vanilla JS `<button>` with an SVG icon matching YouTube's native `.ytp-button` classes to inherit styling. 
- [ ] **Handle SPA Events:** Listen for the `yt-navigate-finish` event dispatched by YouTube's custom router to trigger the re-injection logic when the user browses between videos.

### Phase 3: Service Worker Lifecycle Management
- [ ] **Programmatic Side Panel Invocation:** Listen for the `open_side_panel` message from `content.js` and execute `chrome.sidePanel.open()` explicitly for the current window.
- [ ] **Context Management:** Use `chrome.sidePanel.setPanelBehavior` inside `chrome.runtime.onInstalled` to open the panel on action clicks.

### Phase 4: Side Panel UI Engineering (2026 Standards)
- [ ] **Construct HTML Skeleton:** Implement a clean, dark-mode interface in `sidepanel.html` using native CSS variables.
- [ ] **Declarative Hover States:** Use the 2026 Interest Invoker API (`interesttarget`) to trigger native HTML `popover` tooltips for action buttons, eliminating JavaScript `mouseenter`/`mouseleave` listeners.

### Phase 5: API Fetch Logic and Native Data Processing
- [ ] **Retrieve Key Safely:** Asynchronously fetch the Gemini API Key from `chrome.storage.local`.
- [ ] **Construct Multimodal Payload:** Fetch the active tab URL and send it to the `generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` endpoint using the `file_data` object.
- [ ] **Native Markdown Parsing:** Write a lightweight, Vanilla JS custom regex parser to convert markdown responses into DOM nodes (e.g., `document.createElement('p')`) securely, avoiding `innerHTML` vulnerabilities and large libraries like `marked.js`.

### Phase 6: Edge Case Hardening and Event Cleanup
- [ ] **Quota Management:** Intercept HTTP 429 status codes and handle Google's strict 8-hour daily free-tier limit for video processing gracefully in the UI.
- [ ] **Orphaned Context Handling:** Implement a visual try-catch fallback (like a toast notification) for "Extension context invalidated" errors that happen when the extension is manually reloaded during development.
- [ ] **Error Catching:** Handle 400 Bad Request errors for private or unlisted YouTube videos.
