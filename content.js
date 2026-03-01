const YTP_RIGHT_CONTROLS_SELECTOR = '.ytp-right-controls-left, .ytp-right-controls';
const YTP_BUTTON_SELECTOR = '.ytp-autonav-toggle-button, .ytp-right-controls .ytp-button:not(.gemini-tubeside-btn), .ytp-right-controls-left .ytp-button:not(.gemini-tubeside-btn)';
const INNER_CONTAINER_CLASS = 'ytp-autonav-toggle-button-container';
const SVG_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="14" height="18" rx="1"/><rect x="18" y="5" width="3" height="14" rx="0.5"/></svg>';

function injectButton() {
  const controls = document.querySelector(YTP_RIGHT_CONTROLS_SELECTOR);
  if (!controls || document.querySelector('.gemini-tubeside-btn')) return;

  const templateBtn = document.querySelector(YTP_BUTTON_SELECTOR);
  const btn = templateBtn ? templateBtn.cloneNode(true) : document.createElement('button');
  if (!templateBtn) {
    btn.style.cssText = 'width:48px;height:40px;padding:0;margin:0;border:none;background:transparent;';
  }

  btn.className = 'ytp-button gemini-tubeside-btn';
  btn.title = 'Open Gemini TubeSide';
  btn.setAttribute('aria-label', 'Open Gemini TubeSide');
  btn.replaceChildren();

  const inner = document.createElement('div');
  inner.className = INNER_CONTAINER_CLASS;
  inner.style.cssText = 'width:48px;height:40px;display:flex;align-items:center;justify-content:center;';
  inner.innerHTML = SVG_ICON;
  btn.appendChild(inner);

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
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
