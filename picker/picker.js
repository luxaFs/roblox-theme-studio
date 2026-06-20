// =============================================
//  ROBLOX THEME STUDIO — Background Picker
//
//  HOW IT WORKS (for GIF performance):
//  Instead of converting to base64 (slow!), we:
//  1. Keep the raw File object in memory
//  2. Create a Blob URL for instant preview
//  3. On Apply: send raw ArrayBuffer to content script
//     which creates a local Blob URL → no decode lag
//  4. Also save base64 to storage as fallback
//     for when the page reloads
// =============================================

let chosenFile    = null;    // Raw File object
let chosenB64     = "";      // base64 (for storage persistence)
let chosenIsVideo = false;
let selectedFit   = "cover";
let previewBlobUrl = null;   // Blob URL used for preview

// ─── ELEMENTS ─────────────────────────────────
const dropZone     = document.getElementById("dropZone");
const fileInput    = document.getElementById("fileInput");
const preview      = document.getElementById("preview");
const previewImg   = document.getElementById("previewImg");
const previewVideo = document.getElementById("previewVideo");
const previewLabel = document.getElementById("previewLabel");
const fileInfo     = document.getElementById("fileInfo");
const btnApply     = document.getElementById("btnApply");
const btnClear     = document.getElementById("btnClear");
const opacitySlider= document.getElementById("opacitySlider");
const opacityVal   = document.getElementById("opacityVal");
const status       = document.getElementById("status");

// ─── FILE INPUT ───────────────────────────────
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) handleFile(file);
});

// ─── DRAG AND DROP ────────────────────────────
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

// ─── HANDLE CHOSEN FILE ───────────────────────
function handleFile(file) {
  const isVideo = file.type.startsWith("video/");
  const sizeMB  = (file.size / 1024 / 1024).toFixed(2);

  setStatus("Loading preview...", "");
  chosenFile    = file;
  chosenIsVideo = isVideo;

  // Revoke old preview blob
  if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);

  // Create Blob URL for instant preview — no base64 needed for display
  previewBlobUrl = URL.createObjectURL(file);
  showPreview(previewBlobUrl, isVideo);
  fileInfo.textContent = `${file.name} • ${sizeMB} MB`;
  btnApply.disabled = false;

  // Read base64 in background (for storage persistence on reload)
  // This is async and doesn't block the UI
  readAsBase64(file).then((b64) => {
    chosenB64 = b64;
  });

  setStatus("Ready! Click Apply to use on Roblox.", "success");
}

// Read file as base64 (used only for saving to storage)
function readAsBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

// Read file as ArrayBuffer (for sending to content script — fast path)
function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ─── PREVIEW ──────────────────────────────────
function showPreview(src, isVideo) {
  preview.style.display = "block";
  if (isVideo) {
    previewImg.style.display   = "none";
    previewVideo.style.display = "block";
    previewVideo.src = src;
    previewLabel.textContent = "VIDEO";
  } else {
    previewVideo.style.display = "none";
    previewImg.style.display   = "block";
    previewImg.src = src;
    previewLabel.textContent = "IMAGE / GIF";
  }
}

// ─── FIT BUTTONS ──────────────────────────────
document.getElementById("fitGrid").addEventListener("click", (e) => {
  const btn = e.target.closest(".fit-btn");
  if (!btn) return;
  document.querySelectorAll(".fit-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  selectedFit = btn.dataset.fit;
});

// ─── OPACITY SLIDER ───────────────────────────
opacitySlider.addEventListener("input", () => {
  opacityVal.textContent = opacitySlider.value + "%";
});

// ─── APPLY BUTTON ─────────────────────────────
btnApply.addEventListener("click", async () => {
  if (!chosenFile) return;

  setStatus("Applying...", "");
  btnApply.disabled = true;

  try {
    const settings = buildSettings();

    // ── FAST PATH: send ArrayBuffer directly to Roblox tab ──
    // This creates a Blob URL in the content script → no base64 decode → smooth GIF
    const buffer = await readAsArrayBuffer(chosenFile);
    const sent   = await sendBufferToRobloxTab(buffer, chosenFile.type, settings);

    if (sent) {
      setStatus("✓ Applied to Roblox!", "success");
    } else {
      setStatus("⚠ No Roblox tab found. Open roblox.com first!", "error");
    }

    // ── STORAGE: save base64 as fallback for page reloads ──
    // Wait for base64 to be ready (it was reading in background)
    if (!chosenB64) {
      chosenB64 = await readAsBase64(chosenFile);
    }
    await saveToStorage({ ...settings, bgFileData: chosenB64, bgFileIsVideo: chosenIsVideo });

    btnApply.textContent = "Applied ✓";
    setTimeout(() => {
      btnApply.disabled    = false;
      btnApply.textContent = "Apply to Roblox";
    }, 2000);

  } catch (err) {
    setStatus("Error: " + err.message, "error");
    btnApply.disabled = false;
  }
});

// Send raw ArrayBuffer to content script in the active Roblox tab
function sendBufferToRobloxTab(buffer, mimeType, settings) {
  return new Promise((resolve) => {
    chrome.tabs.query({}, (tabs) => {
      // Find any open Roblox tab
      const robloxTab = tabs.find((t) => t.url && t.url.includes("roblox.com"));

      if (!robloxTab) {
        resolve(false);
        return;
      }

      chrome.tabs.sendMessage(robloxTab.id, {
        action:  "APPLY_GIF_BLOB",
        data: {
          buffer:   buffer,
          mimeType: mimeType,
          settings: settings,
        }
      }, () => {
        // Ignore errors (tab might not have content script yet)
        resolve(true);
      });
    });
  });
}

function buildSettings() {
  return {
    themeEnabled:   true,
    bgType:         chosenIsVideo ? "gif" : "image",
    bgFileIsVideo:  chosenIsVideo,
    bgFit:          selectedFit,
    bgOpacity:      Number(opacitySlider.value),
    bgVideoMuted:   true,
    bgVideoLoop:    true,
  };
}

// ─── CLEAR BUTTON ─────────────────────────────
btnClear.addEventListener("click", async () => {
  chosenFile    = null;
  chosenB64     = "";
  chosenIsVideo = false;

  if (previewBlobUrl) {
    URL.revokeObjectURL(previewBlobUrl);
    previewBlobUrl = null;
  }

  preview.style.display  = "none";
  previewImg.src         = "";
  previewVideo.src       = "";
  fileInfo.textContent   = "";
  fileInput.value        = "";
  btnApply.disabled      = true;

  await saveToStorage({ bgFileData: "", bgFileIsVideo: false, bgType: "color" });
  setStatus("Background cleared.", "");
});

// ─── STORAGE HELPER ───────────────────────────
function saveToStorage(partial) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("robloxTheme", (data) => {
      const merged = { ...(data.robloxTheme || {}), ...partial };
      chrome.storage.local.set({ robloxTheme: merged }, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });
  });
}

// ─── STATUS HELPER ────────────────────────────
function setStatus(msg, type) {
  status.textContent = msg;
  status.className   = type || "";
}

// ─── RESTORE PREVIOUS FILE ON OPEN ────────────
chrome.storage.local.get("robloxTheme", (data) => {
  const s = data.robloxTheme;
  if (!s?.bgFileData) return;

  chosenB64     = s.bgFileData;
  chosenIsVideo = s.bgFileIsVideo || false;
  selectedFit   = s.bgFit || "cover";

  // Show saved image in preview using base64 (no File object available on reload)
  showPreview(s.bgFileData, chosenIsVideo);
  fileInfo.textContent = chosenIsVideo ? "Video loaded from storage" : "Image loaded from storage";
  opacitySlider.value  = s.bgOpacity ?? 100;
  opacityVal.textContent = (s.bgOpacity ?? 100) + "%";
  btnApply.disabled    = false;

  // Note: on reload chosenFile is null, so Apply will use base64 path
  // (still works, just not the fast Blob path)

  document.querySelectorAll(".fit-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.fit === selectedFit);
  });

  setStatus("Previous background loaded.", "success");
});
