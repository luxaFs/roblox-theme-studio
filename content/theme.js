// =============================================
//  ROBLOX THEME STUDIO — Content Script
//  FIXED VERSION — robust sidebar selection
// =============================================

// ─── ROBLOX SELECTORS ─────────────────────────
// Updated selectors — Roblox is constantly changing these
const SELECTORS = {
  // Try multiple selectors in order of reliability
  sidebar: [
    ".left-col",                     // Most common
    ".rbx-navbar-left",              // Alternative
    "nav[class*='left']",            // Flexible
    "[class*='left-col']",           // Flexible
    ".navigation-container",         // Fallback
    "aside",                         // Generic
  ].join(", "),
};

// State
let currentSettings = null;
let bgLayerEl       = null;
let styleEl         = null;
let blobUrl         = null;
let sidebarElements = [];           // Cache found elements

// Init
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

// Listen for messages
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "APPLY_THEME") {
    applyTheme(msg.data);
  }
  if (msg.action === "APPLY_GIF_BLOB") {
    applyGifFromArrayBuffer(msg.data.buffer, msg.data.mimeType, msg.data.settings);
  }
});

function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get("robloxTheme", (data) => {
      resolve(data.robloxTheme || null);
    });
  });
}

function applyTheme(settings) {
  currentSettings = settings;
  if (!settings.themeEnabled) {
    removeTheme();
    return;
  }
  applyColors(settings);
  applyBackground(settings);
  applySidebar(settings);  // This must run AFTER bg is applied
}

// ─── COLORS ───────────────────────────────────
function applyColors(s) {
  ensureStyleTag();
  styleEl.textContent = `
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
    applyVideoBackground(src, s, opacity);
  } else if (s.bgFit === "repeat") {
    applyTileBackground(src, opacity);
  } else {
    applyCssImageBackground(src, s.bgFit, opacity);
  }
}

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

  bgLayerEl = document.createElement("div");
  bgLayerEl.id = "rts-bg-layer";
  Object.assign(bgLayerEl.style, {
    position:            "fixed",
    inset:               "0",
    zIndex:              "0",
    opacity:             opacity,
    pointerEvents:       "none",
    willChange:          "transform",
    transform:           "translateZ(0)",
    backgroundImage:     `url("${src}")`,
    backgroundSize:      fitMap[fit] || "cover",
    backgroundPosition:  posMap[fit] || "center",
    backgroundRepeat:    fit === "repeat" ? "repeat" : "no-repeat",
    width:               "100%",
    height:              "100%",
  });
  document.body.insertBefore(bgLayerEl, document.body.firstChild);
}

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
  });

  const video = document.createElement("video");
  video.src         = src;
  video.muted       = s.bgVideoMuted;
  video.loop        = s.bgVideoLoop;
  video.autoplay    = true;
  video.playsInline = true;

  Object.assign(video.style, {
    position:   "absolute",
    inset:      "0",
    width:      "100%",
    height:     "100%",
    objectFit:  s.bgFit === "center" ? "none" : (s.bgFit || "cover"),
  });

  wrapper.appendChild(video);
  bgLayerEl = wrapper;
  document.body.insertBefore(bgLayerEl, document.body.firstChild);
  video.play().catch(() => {});
}

function applyGifFromArrayBuffer(buffer, mimeType, settings) {
  if (blobUrl) URL.revokeObjectURL(blobUrl);
  const blob = new Blob([buffer], { type: mimeType });
  blobUrl = URL.createObjectURL(blob);
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
// THIS IS THE FIX FOR YOUR BUG
function applySidebar(s) {
  // First try to find sidebar elements
  findSidebarElements();

  if (sidebarElements.length === 0) {
    // If not found yet, keep trying (Roblox is a SPA)
    console.warn("[RTS] Sidebar not found, retrying...");
    setTimeout(() => {
      findSidebarElements();
      if (sidebarElements.length > 0) {
        applySidebarStyles(s);
      }
    }, 500);
    return;
  }

  applySidebarStyles(s);
}

function findSidebarElements() {
  sidebarElements = [];
  const sels = SELECTORS.sidebar.split(", ");
  
  for (let sel of sels) {
    const els = document.querySelectorAll(sel);
    if (els.length > 0) {
      sidebarElements = Array.from(els);
      console.log(`[RTS] Found sidebar with selector: "${sel}" (${els.length} elements)`);
      break;
    }
  }
}

function applySidebarStyles(s) {
  sidebarElements.forEach((el) => {
    if (s.sidebarTransparent) {
      const alpha       = (s.sidebarOpacity / 100).toFixed(2);
      const borderColor = hexToRgba(s.colorSidebarBorder, s.sidebarBorderOpacity / 100);

      // Remove old background first
      el.style.background = "none";
      el.style.backgroundColor = "";
      
      // Apply new styles with high specificity
      el.style.setProperty("background-color", `rgba(0,0,0,${alpha})`, "important");
      el.style.setProperty("background", `rgba(0,0,0,${alpha})`, "important");
      el.style.setProperty("backdrop-filter", "blur(0px)", "important");

      if (s.sidebarBorder) {
        el.style.setProperty("border-right", `1px solid ${borderColor}`, "important");
      } else {
        el.style.setProperty("border-right", "none", "important");
      }
      
      console.log(`[RTS] Applied transparency to sidebar (alpha: ${alpha})`);
    } else {
      // Remove all our styles
      el.style.removeProperty("background-color");
      el.style.removeProperty("background");
      el.style.removeProperty("border-right");
      el.style.removeProperty("backdrop-filter");
      console.log("[RTS] Removed sidebar styles");
    }
  });
}

// ─── REMOVE THEME ─────────────────────────────
function removeTheme() {
  styleEl?.remove();
  clearBgLayer();
  styleEl = null;

  sidebarElements.forEach((el) => {
    el.style.removeProperty("background-color");
    el.style.removeProperty("background");
    el.style.removeProperty("border-right");
    el.style.removeProperty("backdrop-filter");
  });
  sidebarElements = [];
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

// ─── OBSERVE SPA NAVIGATION ───────────────────
// Re-check sidebar when Roblox changes the page
function startObserver() {
  if (!document.body) return;
  const observer = new MutationObserver(() => {
    if (currentSettings?.sidebarTransparent) {
      // Check if sidebar elements still exist, if not re-find them
      if (sidebarElements.some(el => !document.body.contains(el))) {
        findSidebarElements();
      }
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
