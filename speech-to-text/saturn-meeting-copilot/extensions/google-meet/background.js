/**
 * Background service worker for Saturn × Google Meet extension.
 *
 * Handles tab audio capture stream ID requests.
 * chrome.tabCapture.getMediaStreamId() must be called from the background
 * service worker (not a content script) in Manifest V3.
 */

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ enabled: true });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_STREAM_ID") {
    // Returns a stream ID the content script can use with getUserMedia
    // to capture the tab's audio output (all remote participants' voices)
    chrome.tabCapture.getMediaStreamId(
      { targetTabId: sender.tab.id },
      (streamId) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ streamId });
        }
      }
    );
    return true; // keep message channel open for async response
  }
});
