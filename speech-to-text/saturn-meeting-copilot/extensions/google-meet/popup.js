const SATURN_URL = "http://localhost:3000";

const dotSaturn = document.getElementById("dot-saturn");
const labelSaturn = document.getElementById("label-saturn");
const dotCaptions = document.getElementById("dot-captions");
const labelCaptions = document.getElementById("label-captions");
const toggle = document.getElementById("toggle-enabled");
const btnOpen = document.getElementById("btn-open");
const btnPanel = document.getElementById("btn-panel");

// ─── Check if Saturn is reachable ────────────────────────────────────────────

async function checkSaturn() {
  try {
    const res = await fetch(`${SATURN_URL}/api/transcript/push`, {
      method: "OPTIONS",
    });
    if (res.ok || res.status === 204) {
      dotSaturn.classList.add("connected");
      labelSaturn.textContent = "running";
      labelSaturn.style.color = "rgba(52,211,153,0.8)";
    } else {
      throw new Error();
    }
  } catch {
    labelSaturn.textContent = "not running";
    labelSaturn.style.color = "rgba(251,146,60,0.8)";
  }
}

// ─── Check captions status via content script ────────────────────────────────

function checkCaptions() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.id) return;

    chrome.tabs.sendMessage(tab.id, { type: "GET_STATUS" }, (res) => {
      if (chrome.runtime.lastError || !res) return;
      if (res.connected) {
        dotCaptions.classList.add("captions");
        const modeLabel = res.mode === "caption" ? "captions (CC)" : res.mode === "audio" ? "audio (tab+mic)" : "active";
        labelCaptions.textContent = modeLabel;
        labelCaptions.style.color = "rgba(129,140,248,0.9)";
      }
    });
  });
}

// ─── Toggle handler ───────────────────────────────────────────────────────────

chrome.storage.local.get("enabled", (res) => {
  toggle.checked = res.enabled !== false;
});

toggle.addEventListener("change", () => {
  const value = toggle.checked;
  chrome.storage.local.set({ enabled: value });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, { type: "SET_ENABLED", value });
  });
});

// ─── Open Saturn ─────────────────────────────────────────────────────────────

btnOpen.addEventListener("click", () => {
  chrome.tabs.create({ url: SATURN_URL });
});

btnPanel.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.id) return;
    chrome.sidePanel.open({ tabId: tab.id });
    window.close();
  });
});

// ─── Init ─────────────────────────────────────────────────────────────────────

checkSaturn();
checkCaptions();
setInterval(checkSaturn, 5000);
setInterval(checkCaptions, 3000);
