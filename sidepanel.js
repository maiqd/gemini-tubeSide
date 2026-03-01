const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const STORAGE_KEY = 'gemini_api_key';

const outputEl = document.getElementById('output');
const smartSummaryBtn = document.getElementById('smart-summary');
const keyTakeawaysBtn = document.getElementById('key-takeaways');

async function getApiKey() {
  const { [STORAGE_KEY]: key } = await chrome.storage.local.get(STORAGE_KEY);
  return key ?? null;
}

async function getActiveTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.includes('youtube.com/watch')) return null;
  return tab.url;
}

function renderMarkdownSafe(text) {
  const container = document.createDocumentFragment();
  const blocks = text.split(/\n\n+/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const p = document.createElement('p');
    const parts = trimmed.split(/(\*\*[^*]+\*\*|`[^`]+`)/);
    for (const part of parts) {
      if (part.startsWith('**') && part.endsWith('**')) {
        const strong = document.createElement('strong');
        strong.textContent = part.slice(2, -2);
        p.appendChild(strong);
      } else if (part.startsWith('`') && part.endsWith('`')) {
        const code = document.createElement('code');
        code.textContent = part.slice(1, -1);
        p.appendChild(code);
      } else {
        p.appendChild(document.createTextNode(part));
      }
    }
    container.appendChild(p);
  }
  return container;
}

async function fetchSummary(url, mode) {
  const key = await getApiKey();
  if (!key) {
    showError('No API key. Add one in extension options.');
    return;
  }

  const prompt = mode === 'smart_summary'
    ? 'Provide a concise summary of this YouTube video in 3-5 sentences.'
    : 'List the key takeaways and main points from this YouTube video. Use bullet-style formatting.';

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

  outputEl.replaceChildren(renderMarkdownSafe(text));
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
