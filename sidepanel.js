import { MiniGFM } from '@oblivionocean/minigfm';

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const STORAGE_KEY = 'gemini_api_key';

const outputEl = document.getElementById('output');
const smartSummaryBtn = document.getElementById('smart-summary');
const keyTakeawaysBtn = document.getElementById('key-takeaways');
const md = new MiniGFM();

async function getApiKey() {
  const { [STORAGE_KEY]: key } = await chrome.storage.local.get(STORAGE_KEY);
  return key ?? null;
}

async function getActiveTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.includes('youtube.com/watch')) return null;
  return tab.url;
}

async function fetchSummary(url, mode) {
  const key = await getApiKey();
  if (!key) {
    showError('No API key. Add one in extension options.');
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
        {
          file_data: {
            file_uri: url
          }
        }
      ]
    }]
  };

  const res = await fetch(`${GEMINI_API}?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
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

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    showError('No content in response.');
    return;
  }

  outputEl.innerHTML = md.parse(text);
  outputEl.hidden = false;
}

function showError(msg) {
  outputEl.replaceChildren();
  const p = document.createElement('p');
  p.className = 'error';
  p.textContent = msg;
  outputEl.appendChild(p);
  outputEl.hidden = false;
}

function setLoading(loading) {
  smartSummaryBtn.disabled = loading;
  keyTakeawaysBtn.disabled = loading;
}

smartSummaryBtn.addEventListener('click', async () => {
  const url = await getActiveTabUrl();
  if (!url) {
    showError('Open a YouTube video first.');
    return;
  }
  setLoading(true);
  try {
    await fetchSummary(url, 'smart_summary');
  } finally {
    setLoading(false);
  }
});

keyTakeawaysBtn.addEventListener('click', async () => {
  const url = await getActiveTabUrl();
  if (!url) {
    showError('Open a YouTube video first.');
    return;
  }
  setLoading(true);
  try {
    await fetchSummary(url, 'key_takeaways');
  } finally {
    setLoading(false);
  }
});
