chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    if (message.action !== 'open_side_panel') return;
    chrome.sidePanel.open({ windowId: sender.tab.windowId }).then(sendResponse);
    return true;
  }
);
