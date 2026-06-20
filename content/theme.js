// =============================================
//  ROBLOX THEME STUDIO — Content Script
//  Injected into every Roblox page
// =============================================

// ─── ROBLOX SELECTORS ─────────────────────────
const SELECTORS = {
  sidebar: [
    ".left-col",
    ".left-col-wrapper",
    "#left-col",
    "[class*='left-col']",
    "[class*='sidebar']",
    "nav.navigation-container",
    ".navigation-container",
  ].join(", "),
};

// ─── STATE ────────────────────────────────────
let currentSettings = null;
let bgLayerEl       = null;   // Our background <div> or <video>
let styleEl         = null;   // Our injected <style> tag
let blobUrl         = null;   // Active Blob URL (revoked on cleanup)

// ─── INIT ─────────────────────────────────────
function init() {
  loadSettings().then((settings) => {
    if (settings && settings.themeEnabled) {
      applyTheme(settings);
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// Listen for messages from popup or picker
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "APPLY_THEME") {
    applyTheme(msg.data);
  }

  // Picker sends the raw file as ArrayBuffer to avoid slow base64
  if (msg.action === "APPLY_GIF_BLOB") {
    applyGifFromArrayBuffer(msg.data.buffer, msg.data.mimeType, msg.data.settings);
  }
});

// ─── LOAD SETTINGS ────────────────────────────
function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get("robloxTheme", (data) => {
      resolve(data.robloxTheme || null);
    });
  });
}

// ─── MAIN APPLY ───────────────────────────────
function applyTheme(settings) {
  currentSettings = settings;

  if (!settings.themeEnabled) {
    removeTheme();
    return;
  }

  applyColors(settings);
  applyBackground(settings);
  applySidebar(settings);
}

// ─── COLORS ───────────────────────────────────
function applyColors(s) {
  ensureStyleTag();
  styleEl.textContent = `
    /* Roblox Theme Studio */
    body, .rbx-body, #root, .page-container {
      background-color: ${s.colorBg} !important;
      color: ${s.colorText} !important;
    }
    .btn-primary-md, .btn-primary-lg, .btn-primary-sm, .btn-primary-xs,
    [class*="btn-primary"], [class*="btn-cta"], .purchase-button {
      background-color: ${s.colorBtn} !important;
      border-color: ${s.colorBtn} !important;
      color: #fff !important;
    }
    .btn-primary-md:hover, .btn-primary-lg:hover,
    [class*="btn-primary"]:hover, [class*="btn-cta"]:hover {
      filter: brightness(1.15) !important;
    }
    body p, body span, body li,
    body h1, body h2, body h3, body h4, body h5, body h6,
    .text-label, .item-name, .item-card-label {
      color: ${s.colorText} !important;
    }
    a, a:visited { color: ${s.colorLink} !important; }
  `;
}

// ─── BACKGROUND ───────────────────────────────
function applyBackground(s) {
  clearBgLayer();

  if (s.bgType === "color") return;

  const src = s.bgType === "url" ? s.bgUrl : s.bgFileData;
  if (!src) return;

  const isVideo = s.bgFileIsVideo;
  const opacity = (s.bgOpacity / 100).toFixed(2);

  if (isVideo) {
    // ── VIDEO: element with object-fit ──
    applyVideoBackground(src, s, opacity);

  } else if (s.bgFit === "repeat") {
    // ── TILE MODE: CSS background-image (fastest for tiling) ──
    applyTileBackground(src, opacity);

  } else {
    // ── IMAGE / GIF: use CSS background-image for best performance ──
    // CSS background-image is GPU-accelerated and handles GIF animation natively
    applyCssImageBackground(src, s.bgFit, opacity);
  }
}

// GIF/Image via CSS background-image — GPU accelerated, no FPS issues
function applyCssImageBackground(src, fit, opacity) {
  const fitMap = {
    cover:   "cover",
    contain: "contain",
    fill:    "100% 100%",
    center:  "auto",
    repeat:  "auto",
  };
  const posMap = {
    cover:   "center center",
    contain: "center center",
    fill:    "center center",
    center:  "center center",
    repeat:  "top left",
  };
  const repeatMap = {
    repeat: "repeat",
  };

  bgLayerEl = document.createElement("div");
  bgLayerEl.id = "rts-bg-layer";

  Object.assign(bgLayerEl.style, {
    position:            "fixed",
    inset:               "0",
    zIndex:              "0",
    opacity:             opacity,
    pointerEvents:       "none",
    // GPU acceleration — key for smooth GIF
    willChange:          "transform",
    transform:           "translateZ(0)",
    backgroundImage:     `url("${src}")`,
    backgroundSize:      fitMap[fit] || "cover",
    backgroundPosition:  posMap[fit] || "center",
    backgroundRepeat:    repeatMap[fit] || "no-repeat",
    width:               "100%",
    height:              "100%",
  });

  document.body.insertBefore(bgLayerEl, document.body.firstChild);
}

// Tile mode
function applyTileBackground(src, opacity) {
  bgLayerEl = document.createElement("div");
  bgLayerEl.id = "rts-bg-layer";
  Object.assign(bgLayerEl.style, {
    position:        "fixed",
    inset:           "0",
    zIndex:          "0",
    opacity:         opacity,
    pointerEvents:   "none",
    willChange:      "transform",
    transform:       "translateZ(0)",
    backgroundImage: `url("${src}")`,
    backgroundRepeat:"repeat",
    backgroundSize:  "auto",
    width:           "100%",
    height:          "100%",
  });
  document.body.insertBefore(bgLayerEl, document.body.firstChild);
}

// Video background
function applyVideoBackground(src, s, opacity) {
  const wrapper = document.createElement("div");
  wrapper.id = "rts-bg-layer";
  Object.assign(wrapper.style, {
    position:      "fixed",
    inset:         "0",
    zIndex:        "0",
    opacity:       opacity,
    pointerEvents: "none",
    overflow:      "hidden",
    willChange:    "transform",
    transform:     "translateZ(0)",
  });

  const video = document.createElement("video");
  video.src         = src;
  video.muted       = s.bgVideoMuted;
  video.loop        = s.bgVideoLoop;
  video.autoplay    = true;
  video.playsInline = true;

  const fitMap = { cover:"cover", contain:"contain", fill:"fill", center:"none" };
  Object.assign(video.style, {
    position:   "absolute",
    inset:      "0",
    width:      "100%",
    height:     "100%",
    objectFit:  fitMap[s.bgFit] || "cover",
  });

  wrapper.appendChild(video);
  bgLayerEl = wrapper;
  document.body.insertBefore(bgLayerEl, document.body.firstChild);
  video.play().catch(() => {});
}

// Apply GIF/image that arrived as raw ArrayBuffer from the picker
// This bypasses base64 entirely → zero decode overhead
function applyGifFromArrayBuffer(buffer, mimeType, settings) {
  // Revoke old blob if exists
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl);
    blobUrl = null;
  }

  const blob = new Blob([buffer], { type: mimeType });
  blobUrl = URL.createObjectURL(blob);

  // Patch settings to use the blob URL directly
  const patched = {
    ...settings,
    bgFileData:    blobUrl,
    bgFileIsVideo: mimeType.startsWith("video/"),
  };

  currentSettings = patched;
  applyColors(patched);
  applyCssImageBackground(blobUrl, patched.bgFit, (patched.bgOpacity / 100).toFixed(2));
  applySidebar(patched);
}

// ─── SIDEBAR TRANSPARENCY ─────────────────────
function applySidebar(s) {
  waitForElements(SELECTORS.sidebar, (elements) => {
    elements.forEach((el) => {
      if (s.sidebarTransparent) {
        const alpha       = (s.sidebarOpacity / 100).toFixed(2);
        const borderColor = hexToRgba(s.colorSidebarBorder, s.sidebarBorderOpacity / 100);

        el.style.setProperty("background-color", `rgba(0,0,0,${alpha})`, "important");
        el.style.setProperty("backdrop-filter",  "blur(0px)", "important");

        if (s.sidebarBorder) {
          el.style.setProperty("border-right", `1px solid ${borderColor}`, "important");
        } else {
          el.style.setProperty("border-right", "none", "important");
        }
      } else {
        el.style.removeProperty("background-color");
        el.style.removeProperty("border-right");
        el.style.removeProperty("backdrop-filter");
      }
    });
  });
}

// ─── REMOVE THEME ─────────────────────────────
function removeTheme() {
  styleEl?.remove();
  clearBgLayer();
  styleEl = null;

  document.querySelectorAll(SELECTORS.sidebar).forEach((el) => {
    el.style.removeProperty("background-color");
    el.style.removeProperty("border-right");
    el.style.removeProperty("backdrop-filter");
  });
}

function clearBgLayer() {
  if (bgLayerEl) {
    bgLayerEl.remove();
    bgLayerEl = null;
  }
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl);
    blobUrl = null;
  }
}

// ─── UTILITIES ────────────────────────────────

function ensureStyleTag() {
  if (!styleEl) {
    styleEl    = document.createElement("style");
    styleEl.id = "rts-theme-style";
    document.head.appendChild(styleEl);
  }
}

function hexToRgba(hex, alpha) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(255,255,255,${alpha})`;
  return `rgba(${parseInt(result[1],16)},${parseInt(result[2],16)},${parseInt(result[3],16)},${alpha})`;
}

function waitForElements(selector, callback, interval = 400, maxTries = 25) {
  let tries = 0;
  function check() {
    const els = document.querySelectorAll(selector);
    if (els.length > 0) {
      callback(Array.from(els));
    } else if (tries < maxTries) {
      tries++;
      setTimeout(check, interval);
    }
  }
  check();
}

// ─── SPA OBSERVER ─────────────────────────────
function startObserver() {
  if (!document.body) return;
  const observer = new MutationObserver(() => {
    if (currentSettings?.themeEnabled) {
      applySidebar(currentSettings);
    }
  });
  observer.observe(document.body, { childList: true, subtree: false });
}

if (document.body) {
  startObserver();
} else {
  document.addEventListener("DOMContentLoaded", startObserver);
}
