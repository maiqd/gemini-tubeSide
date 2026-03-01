const STORAGE_KEY = 'gemini_api_key';
const THEME_STORAGE_KEY = 'themePreference';

const THEME_DEFAULT = 'default';
const THEME_LIGHT = 'theme-light';
const THEME_PAPER = 'theme-paper';
const THEME_BLUE = 'theme-blue';

const apiKeyInput = document.getElementById('api-key');
const saveBtn = document.getElementById('save');
const themeSelector = document.getElementById('theme-selector');

function applyThemeToDocument(theme) {
  document.documentElement.className = theme && theme !== THEME_DEFAULT ? theme : '';
}

chrome.storage.local.get([STORAGE_KEY, THEME_STORAGE_KEY]).then((result) => {
  if (result[STORAGE_KEY]) apiKeyInput.value = result[STORAGE_KEY];
  if (result[THEME_STORAGE_KEY]) themeSelector.value = result[THEME_STORAGE_KEY];
  applyThemeToDocument(result[THEME_STORAGE_KEY]);
});

themeSelector.addEventListener('change', (e) => {
  const value = e.target.value;
  chrome.storage.local.set({ [THEME_STORAGE_KEY]: value });
  applyThemeToDocument(value);
});

saveBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  chrome.storage.local.set({ [STORAGE_KEY]: key || null });
  saveBtn.textContent = 'Saved';
  setTimeout(() => { saveBtn.textContent = 'Save'; }, 1500);
});
