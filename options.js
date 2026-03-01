const STORAGE_KEY = 'gemini_api_key';

const apiKeyInput = document.getElementById('api-key');
const saveBtn = document.getElementById('save');

chrome.storage.local.get(STORAGE_KEY).then(({ [STORAGE_KEY]: key }) => {
  if (key) apiKeyInput.value = key;
});

saveBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  chrome.storage.local.set({ [STORAGE_KEY]: key || null });
  saveBtn.textContent = 'Saved';
  setTimeout(() => { saveBtn.textContent = 'Save'; }, 1500);
});
