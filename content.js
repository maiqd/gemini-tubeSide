const YTP_RIGHT_CONTROLS_SELECTOR = '.ytp-right-controls';
const SVG_ICON =
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2v5h5l-5-5zm-2 8h2v6h-2v-6zm2-4h2v2h-2v-2z"/></svg>';

function injectButton() {
  const controls = document.querySelector(YTP_RIGHT_CONTROLS_SELECTOR);
  if (!controls || document.querySelector('.gemini-tubeside-btn')) return;

  const btn = document.createElement('button');
  btn.className = 'ytp-button gemini-tubeside-btn';
  btn.title = 'Open Gemini TubeSide';
  btn.setAttribute('aria-label', 'Open Gemini TubeSide');
  btn.innerHTML = SVG_ICON;
  btn.style.cssText = 'width:48px;height:48px;display:flex;align-items:center;justify-content:center;';

  btn.addEventListener('click', () => {
    try {
      chrome.runtime.sendMessage({ action: 'open_side_panel' });
    } catch {
      console.warn('[Gemini TubeSide] Extension context invalidated');
    }
  });

  controls.insertBefore(btn, controls.firstChild);
}

function waitForControls() {
  const controls = document.querySelector(YTP_RIGHT_CONTROLS_SELECTOR);
  if (controls) {
    injectButton();
    return;
  }

  const observer = new MutationObserver(() => {
    const el = document.querySelector(YTP_RIGHT_CONTROLS_SELECTOR);
    if (el) {
      observer.disconnect();
      injectButton();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

waitForControls();
document.addEventListener('yt-navigate-finish', waitForControls);
