import { MiniGFM } from '@oblivionocean/minigfm';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash';
const STORAGE_KEY = 'gemini_api_key';
const THEME_STORAGE_KEY = 'themePreference';
const THEME_DEFAULT = 'default';

const Mode = Object.freeze({ SUMMARY: 'summary', KEY_TAKEAWAYS: 'key_takeaways' });
const MSG_ANALYZING = 'Analyzing video...';
const CACHE_PREFIX = 'cache:';
const RECENT_VIDEOS_KEY = 'recent_videos';
const RECENT_VIDEOS_MAX = 10;
const STREAM_DEBOUNCE_MS = 80;
const STREAM_TIMEOUT_MS = 120_000;

function applyTheme(theme) {
  document.documentElement.className = theme && theme !== THEME_DEFAULT ? theme : '';
}

async function applyReadingMode() {
  const { [THEME_STORAGE_KEY]: theme } = await chrome.storage.local.get(THEME_STORAGE_KEY);
  applyTheme(theme);
  return theme;
}

const outputEl = document.getElementById('output');
const loadingEl = document.getElementById('loading');
const loadingMessageEl = document.getElementById('loading-message');
const smartSummaryBtn = document.getElementById('smart-summary');
const keyTakeawaysBtn = document.getElementById('key-takeaways');
const themeSelector = document.getElementById('theme-selector');
const md = new MiniGFM();

function getCacheKey(videoId, mode) {
  return `${CACHE_PREFIX}${videoId}:${mode}`;
}

function extractVideoId(url) {
  const m = url.match(/[?&]v=([^&]+)/);
  return m ? m[1] : null;
}

function setLoadingState(loading, message = MSG_ANALYZING) {
  if (loadingEl) loadingEl.hidden = !loading;
  if (loading) {
    if (outputEl) outputEl.hidden = true;
  }
  if (loadingMessageEl) loadingMessageEl.textContent = message;
  smartSummaryBtn.disabled = loading;
  keyTakeawaysBtn.disabled = loading;
}

async function getApiKey() {
  const { [STORAGE_KEY]: key } = await chrome.storage.local.get(STORAGE_KEY);
  return key ?? null;
}

async function getActiveTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.includes('youtube.com/watch')) return null;
  return tab.url;
}

async function getCachedSummary(videoId, mode) {
  const key = getCacheKey(videoId, mode);
  const result = await chrome.storage.local.get(key);
  return result[key] ?? null;
}

async function setCachedSummary(videoId, mode, text) {
  await chrome.storage.local.set({ [getCacheKey(videoId, mode)]: text });
}

async function appendRecentVideo(videoId, url, mode, text) {
  const existing = await chrome.storage.local.get(RECENT_VIDEOS_KEY);
  let list = existing[RECENT_VIDEOS_KEY] ?? [];
  list = list.filter((e) => e.videoId !== videoId);
  list.unshift({ videoId, url, [mode]: text, updatedAt: Date.now() });
  list = list.slice(0, RECENT_VIDEOS_MAX);
  await chrome.storage.local.set({ [RECENT_VIDEOS_KEY]: list });
}

function parseStreamText(chunk) {
  const data = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof data === 'string' ? data : '';
}

async function fetchSummary(url, mode) {
  const key = await getApiKey();
  if (!key) {
    showError('No API key. Add one in extension options.');
    return;
  }

  const videoId = extractVideoId(url);
  const modeKey = mode === 'smart_summary' ? Mode.SUMMARY : Mode.KEY_TAKEAWAYS;
  const cached = videoId ? await getCachedSummary(videoId, modeKey) : null;
  if (cached) {
    outputEl.innerHTML = md.parse(cached);
    outputEl.hidden = false;
    return;
  }

  const prompt = mode === 'smart_summary'
    ? 'Provide a concise summary of this YouTube video in 3-5 sentences.'
    : 'List key takeaways with clear section headers (e.g. **Motivation:**, **Technologies:**). Use bullet points and numbered steps where appropriate. Keep each bullet concise (1-2 sentences).';

  const body = {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { file_data: { file_uri: url } }
      ]
    }]
  };

  setLoadingState(true);
  const streamUrl = `${GEMINI_API_BASE}:streamGenerateContent?key=${encodeURIComponent(key)}&alt=sse`;
  const abortController = new AbortController();
  let timeoutId = setTimeout(() => abortController.abort(), STREAM_TIMEOUT_MS);

  try {
    const res = await fetch(streamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: abortController.signal
    });

    if (res.status === 429) {
      showError('Rate limit exceeded. Try again later.');
      return;
    }
    if (res.status === 400) {
      showError('Video may be private or unlisted.');
      return;
    }
    if (!res.ok) {
      showError(`Request failed: ${res.status}`);
      return;
    }

    let buffer = '';
    let firstChunk = true;
    let debounceId = null;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;
        try {
          const data = JSON.parse(jsonStr);
          buffer += parseStreamText(data);
        } catch {
          // skip heartbeat or malformed lines
        }
      }
      if (firstChunk && buffer) {
        firstChunk = false;
        setLoadingState(false);
        outputEl.hidden = false;
      }
      if (debounceId) clearTimeout(debounceId);
      debounceId = setTimeout(() => {
        if (buffer) outputEl.innerHTML = md.parse(buffer);
        debounceId = null;
      }, STREAM_DEBOUNCE_MS);
    }
    if (debounceId) clearTimeout(debounceId);
    setLoadingState(false);
    if (buffer) {
      outputEl.innerHTML = md.parse(buffer);
      outputEl.hidden = false;
      if (videoId) {
        await setCachedSummary(videoId, modeKey, buffer);
        await appendRecentVideo(videoId, url, modeKey, buffer);
      }
    } else {
      showError('No content in response.');
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      showError('Request timed out. Try again.');
    } else {
      showError(err?.message ?? 'Something went wrong.');
    }
  } finally {
    clearTimeout(timeoutId);
    setLoadingState(false);
  }
}

function showError(msg) {
  setLoadingState(false);
  outputEl.replaceChildren();
  const p = document.createElement('p');
  p.className = 'error';
  p.textContent = msg;
  outputEl.appendChild(p);
  outputEl.hidden = false;
}

smartSummaryBtn.addEventListener('click', async () => {
  const url = await getActiveTabUrl();
  if (!url) {
    showError('Open a YouTube video first.');
    return;
  }
  await fetchSummary(url, 'smart_summary');
});

keyTakeawaysBtn.addEventListener('click', async () => {
  const url = await getActiveTabUrl();
  if (!url) {
    showError('Open a YouTube video first.');
    return;
  }
  await fetchSummary(url, 'key_takeaways');
});

themeSelector.addEventListener('change', (e) => {
  const value = e.target.value;
  chrome.storage.local.set({ [THEME_STORAGE_KEY]: value });
  applyTheme(value);
});

(async function init() {
  setLoadingState(false);
  const savedTheme = await applyReadingMode();
  themeSelector.value = savedTheme || THEME_DEFAULT;
})();
