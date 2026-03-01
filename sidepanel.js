import { MiniGFM } from '@oblivionocean/minigfm';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash';
const STORAGE_KEY = 'gemini_api_key';
const THEME_STORAGE_KEY = 'themePreference';
const THEME_DEFAULT = 'default';
const FONT_FAMILY_STORAGE_KEY = 'fontFamily';
const FONT_SIZE_STORAGE_KEY = 'fontSize';
const FONT_SIZE_DEFAULT = 16;
const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 30;
const FONT_SIZE_STEP = 2;

const TTS_STORAGE_VOICE_KEY = 'ttsVoice';
const TTS_STORAGE_SPEED_KEY = 'ttsSpeed';
const TTS_SPEED_DEFAULT = 1;

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
const requestAgainBtn = document.getElementById('request-again');
const smartSummaryBtn = document.getElementById('smart-summary');
const keyTakeawaysBtn = document.getElementById('key-takeaways');
const themeSelector = document.getElementById('theme-selector');
const fontSelector = document.getElementById('font-selector');
const ttsControlsEl = document.getElementById('tts-controls');
const btnReadAloud = document.getElementById('btn-read-aloud');
const voiceSelect = document.getElementById('voice-select');
const speedSlider = document.getElementById('speed-slider');
const speedValueLabel = document.getElementById('speed-value');
const md = new MiniGFM();

let ttsVoices = [];
let chromeTtsVoices = [];

let lastUrl = null;
let lastMode = null;

let currentFontSize = FONT_SIZE_DEFAULT;

async function loadTypographySettings() {
  const storage = await chrome.storage.local.get([FONT_FAMILY_STORAGE_KEY, FONT_SIZE_STORAGE_KEY]);
  if (storage[FONT_FAMILY_STORAGE_KEY]) {
    fontSelector.value = storage[FONT_FAMILY_STORAGE_KEY];
    document.documentElement.style.setProperty('--reading-font', storage[FONT_FAMILY_STORAGE_KEY]);
  }
  if (storage[FONT_SIZE_STORAGE_KEY] != null) {
    const size = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, parseInt(storage[FONT_SIZE_STORAGE_KEY], 10)));
    if (!Number.isNaN(size)) {
      currentFontSize = size;
      document.documentElement.style.setProperty('--base-font-size', `${currentFontSize}px`);
    }
  }
}

function changeFontSize(delta) {
  currentFontSize = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, currentFontSize + delta));
  document.documentElement.style.setProperty('--base-font-size', `${currentFontSize}px`);
  chrome.storage.local.set({ [FONT_SIZE_STORAGE_KEY]: currentFontSize });
}

function getFilteredVoices(allVoices) {
  const isEnOrVi = (v) => v.lang.startsWith('en') || v.lang.startsWith('vi');
  const isLocal = (v) => v.localService === true;
  const isGoogle = (v) => v.name.includes('Google');
  const localEnVi = allVoices.filter((v) => isEnOrVi(v) && isLocal(v) && !isGoogle(v));
  if (localEnVi.length > 0) return localEnVi;
  const localGoogleEnVi = allVoices.filter((v) => isEnOrVi(v) && isGoogle(v) && isLocal(v));
  if (localGoogleEnVi.length > 0) return localGoogleEnVi;
  const googleEnVi = allVoices.filter((v) => isEnOrVi(v) && isGoogle(v));
  if (googleEnVi.length > 0) return googleEnVi;
  const enVi = allVoices.filter(isEnOrVi);
  if (enVi.length > 0) return enVi;
  return allVoices;
}

function filterChromeTtsVoices(voices) {
  const isEnOrVi = (v) => (v.lang || '').startsWith('en') || (v.lang || '').startsWith('vi');
  return voices.filter(isEnOrVi);
}

function populateFromChromeTts() {
  if (!chrome.tts || !voiceSelect) return;
  const p = chrome.tts.getVoices();
  if (typeof p?.then !== 'function') return;
  p.then((voices) => {
    chromeTtsVoices = filterChromeTtsVoices(voices || []);
    console.log('[TTS] chrome.tts voices:', chromeTtsVoices.length, chromeTtsVoices.map((v) => v.voiceName));
    if (chromeTtsVoices.length === 0) return;
    voiceSelect.innerHTML = '';
    chromeTtsVoices.forEach((v) => {
      const option = document.createElement('option');
      option.value = v.voiceName || '';
      option.textContent = `${v.voiceName || 'Default'} (${v.lang || ''})`;
      voiceSelect.appendChild(option);
    });
    chrome.storage.local.get([TTS_STORAGE_VOICE_KEY], (result) => {
      const saved = result[TTS_STORAGE_VOICE_KEY];
      if (saved && chromeTtsVoices.some((v) => v.voiceName === saved)) {
        voiceSelect.value = saved;
      } else {
        voiceSelect.selectedIndex = 0;
        if (chromeTtsVoices[0]?.voiceName) {
          chrome.storage.local.set({ [TTS_STORAGE_VOICE_KEY]: chromeTtsVoices[0].voiceName });
        }
      }
    });
    if (btnReadAloud) btnReadAloud.disabled = false;
  }).catch((err) => console.error('[TTS] chrome.tts.getVoices failed:', err));
}

function populateFilteredVoices() {
  const all = window.speechSynthesis.getVoices();
  ttsVoices = getFilteredVoices(all);
  console.log('[TTS] voices loaded:', all.length, 'filtered:', ttsVoices.length, ttsVoices.map((v) => v.name));
  if (!voiceSelect) return;
  if (typeof chrome !== 'undefined' && chrome.tts) {
    populateFromChromeTts();
    return;
  }
  voiceSelect.innerHTML = '';
  if (ttsVoices.length === 0) {
    const option = document.createElement('option');
    option.textContent = 'No voices available';
    option.disabled = true;
    voiceSelect.appendChild(option);
    if (btnReadAloud) btnReadAloud.disabled = true;
    return;
  }
  if (btnReadAloud) btnReadAloud.disabled = false;
  ttsVoices.forEach((voice) => {
    const option = document.createElement('option');
    option.value = voice.voiceURI;
    option.textContent = `${voice.name} (${voice.lang})`;
    voiceSelect.appendChild(option);
  });
  chrome.storage.local.get([TTS_STORAGE_VOICE_KEY], (result) => {
    const saved = result[TTS_STORAGE_VOICE_KEY];
    if (saved && ttsVoices.some((v) => v.voiceURI === saved)) {
      voiceSelect.value = saved;
    } else {
      voiceSelect.selectedIndex = 0;
    }
  });
}

function getCacheKey(videoId, mode) {
  return `${CACHE_PREFIX}${videoId}:${mode}`;
}

function extractVideoId(url) {
  const m = url.match(/[?&]v=([^&]+)/);
  return m ? m[1] : null;
}

function setTtsControlsVisible(visible) {
  if (ttsControlsEl) ttsControlsEl.hidden = !visible;
}

function setLoadingState(loading, message = MSG_ANALYZING) {
  if (loadingEl) loadingEl.hidden = !loading;
  if (loading) {
    if (outputEl) outputEl.hidden = true;
    if (requestAgainBtn) requestAgainBtn.hidden = true;
    setTtsControlsVisible(false);
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
    lastUrl = url;
    lastMode = mode;
    outputEl.innerHTML = md.parse(cached);
    ttsResumeIndex = 0;
    outputEl.hidden = false;
    if (requestAgainBtn) requestAgainBtn.hidden = false;
    setTtsControlsVisible(true);
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
        setTtsControlsVisible(true);
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
      lastUrl = url;
      lastMode = mode;
      outputEl.innerHTML = md.parse(buffer);
      ttsResumeIndex = 0;
      outputEl.hidden = false;
      if (requestAgainBtn) requestAgainBtn.hidden = false;
      setTtsControlsVisible(true);
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
  if (requestAgainBtn) requestAgainBtn.hidden = true;
  setTtsControlsVisible(false);
}

async function clearCacheAndRefetch() {
  if (!lastUrl || !lastMode) return;
  const videoId = extractVideoId(lastUrl);
  const modeKey = lastMode === 'smart_summary' ? Mode.SUMMARY : Mode.KEY_TAKEAWAYS;
  if (videoId) await chrome.storage.local.remove(getCacheKey(videoId, modeKey));
  await fetchSummary(lastUrl, lastMode);
}

requestAgainBtn?.addEventListener('click', clearCacheAndRefetch);

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

fontSelector.addEventListener('change', (e) => {
  const value = e.target.value;
  document.documentElement.style.setProperty('--reading-font', value);
  chrome.storage.local.set({ [FONT_FAMILY_STORAGE_KEY]: value });
});

document.getElementById('btn-text-decrease').addEventListener('click', () => changeFontSize(-FONT_SIZE_STEP));
document.getElementById('btn-text-increase').addEventListener('click', () => changeFontSize(FONT_SIZE_STEP));

let isTtsSpeaking = false;
let ttsResumeIndex = 0;
let ttsLastCharIndex = 0;

function resetTtsButton() {
  isTtsSpeaking = false;
  if (btnReadAloud) btnReadAloud.textContent = 'Read Aloud';
}

function toggleSpeech() {
  const text = outputEl?.textContent?.trim() ?? '';
  console.log('[TTS] text length:', text.length, 'preview:', text.slice(0, 50));
  if (!text || text.includes(MSG_ANALYZING)) return;

  const rate = parseFloat(speedSlider?.value ?? TTS_SPEED_DEFAULT);
  const selectedUri = voiceSelect?.value;
  const voice = ttsVoices.find((v) => v.voiceURI === selectedUri);
  const lang = voice?.lang ?? 'en-US';

  if (isTtsSpeaking) {
    ttsResumeIndex = ttsLastCharIndex;
    window.speechSynthesis.cancel();
    if (chrome.tts) chrome.tts.stop();
    resetTtsButton();
    return;
  }

  window.speechSynthesis.cancel();

  if (ttsResumeIndex >= text.length) ttsResumeIndex = 0;
  const textToSpeak = ttsResumeIndex > 0 ? text.slice(ttsResumeIndex) : text;
  if (!textToSpeak.trim()) {
    ttsResumeIndex = 0;
    return;
  }

  const useChromeTts = typeof chrome !== 'undefined' && chrome.tts;
  console.log('[TTS] voice:', voice?.name ?? 'none', 'lang:', lang, 'rate:', rate, 'useChromeTts:', useChromeTts, 'resumeFrom:', ttsResumeIndex);

  if (useChromeTts) {
    isTtsSpeaking = true;
    ttsLastCharIndex = ttsResumeIndex;
    if (btnReadAloud) btnReadAloud.textContent = 'Stop Audio';
    const voiceName = chromeTtsVoices.length > 0 ? (voiceSelect?.value || chromeTtsVoices[0]?.voiceName) : undefined;
    const opts = {
      rate,
      lang,
      onEvent: (e) => {
        if (e.charIndex != null) ttsLastCharIndex = ttsResumeIndex + e.charIndex;
        if (e.type === 'error') console.error('[TTS] chrome.tts event error:', e.errorMessage);
        if (e.type === 'end') ttsResumeIndex = 0;
        if (['end', 'error', 'interrupted', 'cancelled'].includes(e.type)) {
          if (e.type === 'interrupted' || e.type === 'cancelled') ttsResumeIndex = ttsLastCharIndex;
          resetTtsButton();
        }
      }
    };
    if (voiceName) opts.voiceName = voiceName;
    const cb = () => { if (chrome.runtime?.lastError) console.error('[TTS] chrome.tts error:', chrome.runtime.lastError.message); };
    const result = chrome.tts.speak(textToSpeak, opts, cb);
    if (result?.then) result.catch((err) => { console.error('[TTS] chrome.tts.speak failed:', err); resetTtsButton(); });
    return;
  }

  const utterance = new SpeechSynthesisUtterance(textToSpeak);
  utterance.rate = rate;
  utterance.volume = 1;
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = lang;
  }

  ttsLastCharIndex = ttsResumeIndex;
  utterance.onboundary = (e) => { if (e.charIndex != null) ttsLastCharIndex = ttsResumeIndex + e.charIndex; };
  utterance.onend = () => { ttsResumeIndex = 0; resetTtsButton(); };
  utterance.onerror = (e) => {
    console.error('[TTS] utterance error:', e?.error, e);
    resetTtsButton();
  };

  isTtsSpeaking = true;
  if (btnReadAloud) btnReadAloud.textContent = 'Stop Audio';

  window.speechSynthesis.resume();
  window.speechSynthesis.speak(utterance);
  console.log('[TTS] speak() called, synthesis.speaking:', window.speechSynthesis.speaking);
}

if (typeof window.speechSynthesis !== 'undefined') {
  window.speechSynthesis.onvoiceschanged = populateFilteredVoices;
  populateFilteredVoices();
}
if (typeof chrome !== 'undefined' && chrome.tts?.onVoicesChanged?.addListener) {
  chrome.tts.onVoicesChanged.addListener(populateFilteredVoices);
}

if (speedSlider) {
  chrome.storage.local.get([TTS_STORAGE_SPEED_KEY], (result) => {
    const speed = result[TTS_STORAGE_SPEED_KEY];
    if (speed != null) {
      const val = Math.max(0.5, Math.min(2, parseFloat(speed)));
      if (!Number.isNaN(val)) {
        speedSlider.value = val;
        if (speedValueLabel) speedValueLabel.textContent = `${val}x`;
      }
    }
  });
  speedSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    if (speedValueLabel) speedValueLabel.textContent = `${val}x`;
    chrome.storage.local.set({ [TTS_STORAGE_SPEED_KEY]: val });
  });
}

if (voiceSelect) {
  voiceSelect.addEventListener('change', (e) => {
    chrome.storage.local.set({ [TTS_STORAGE_VOICE_KEY]: e.target.value });
  });
}

if (btnReadAloud) btnReadAloud.addEventListener('click', toggleSpeech);

(async function init() {
  setLoadingState(false);
  const savedTheme = await applyReadingMode();
  themeSelector.value = savedTheme || THEME_DEFAULT;
  await loadTypographySettings();
})();
