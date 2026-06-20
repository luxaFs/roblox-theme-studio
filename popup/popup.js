// =============================================
//  ROBLOX THEME STUDIO — Popup Logic
// =============================================

// --- Default settings ---
const DEFAULTS = {
  themeEnabled:        true,
  colorBg:             "#1a1a2e",
  colorBtn:            "#00b06f",
  colorText:           "#ffffff",
  colorLink:           "#7ec8e3",

  bgType:              "color",
  bgFileData:          "",
  bgFileIsVideo:       false,
  bgUrl:               "",
  bgFit:               "cover",
  bgOpacity:           100,
  bgVideoMuted:        true,
  bgVideoLoop:         true,

  sidebarTransparent:  false,
  sidebarOpacity:      0,
  sidebarBorder:       true,
  colorSidebarBorder:  "#ffffff",
  sidebarBorderOpacity: 30,
};

// --- Color presets ---
const PRESETS = {
  dark:   { colorBg: "#0d0d0d", colorBtn: "#444444", colorText: "#ffffff", colorLink: "#aaaaaa" },
  ocean:  { colorBg: "#0a192f", colorBtn: "#0070f3", colorText: "#ccd6f6", colorLink: "#64ffda" },
  sakura: { colorBg: "#2d1b2e", colorBtn: "#e91e8c", colorText: "#ffd6e7", colorLink: "#ff80b5" },
  forest: { colorBg: "#0f2818", colorBtn: "#2e7d32", colorText: "#c8e6c9", colorLink: "#a5d6a7" },
  sunset: { colorBg: "#1a0a00", colorBtn: "#e65100", colorText: "#fff3e0", colorLink: "#ffb300" },
};

// =============================================
//  INIT — runs when popup opens
// =============================================
document.addEventListener("DOMContentLoaded", async () => {
  const settings = await loadSettings();
  applySettingsToUI(settings);
  setupTabs();
  setupColorPickers();
  setupSliders();
  setupPresets();
  setupBgType();
  setupFileUpload();
  setupSidebar();
  setupApplyButton();
  setupResetButton();
});

// =============================================
//  STORAGE
// =============================================
function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get("robloxTheme", (data) => {
      resolve({ ...DEFAULTS, ...(data.robloxTheme || {}) });
    });
  });
}

function saveSettings(settings) {
  chrome.storage.local.set({ robloxTheme: settings });
}

// =============================================
//  FILL UI FROM SETTINGS
// =============================================
function applySettingsToUI(s) {
  setCheck("themeEnabled",        s.themeEnabled);
  setColor("colorBg",             s.colorBg);
  setColor("colorBtn",            s.colorBtn);
  setColor("colorText",           s.colorText);
  setColor("colorLink",           s.colorLink);
  setRadio("bgType",              s.bgType);
  setVal("bgUrl",                 s.bgUrl);
  setVal("bgFit",                 s.bgFit);
  setSlider("bgOpacity",          s.bgOpacity,          "bgOpacityVal",          "%");
  setCheck("bgVideoMuted",        s.bgVideoMuted);
  setCheck("bgVideoLoop",         s.bgVideoLoop);
  setCheck("sidebarTransparent",  s.sidebarTransparent);
  setSlider("sidebarOpacity",     s.sidebarOpacity,     "sidebarOpacityVal",     "%");
  setCheck("sidebarBorder",       s.sidebarBorder);
  setColor("colorSidebarBorder",  s.colorSidebarBorder);
  setSlider("sidebarBorderOpacity", s.sidebarBorderOpacity, "sidebarBorderOpacityVal", "%");

  if (s.bgFileData) {
    const label = document.getElementById("bgFileName");
    if (label) label.textContent = s.bgFileIsVideo ? "Video loaded ✓" : "Image loaded ✓";
  }

  updateBgTypeVisibility(s.bgType, s.bgFileIsVideo || false);
  updateSidebarVisibility(s.sidebarTransparent, s.sidebarBorder);
}

// =============================================
//  COLLECT SETTINGS FROM UI
// =============================================
async function collectSettings() {
  // File data comes from storage (saved by picker.html), not from file input
  const prev = await loadSettings();

  return {
    themeEnabled:         getCheck("themeEnabled"),
    colorBg:              getColor("colorBg"),
    colorBtn:             getColor("colorBtn"),
    colorText:            getColor("colorText"),
    colorLink:            getColor("colorLink"),

    bgType:               getRadio("bgType"),
    bgFileData:           prev.bgFileData    || "",
    bgFileIsVideo:        prev.bgFileIsVideo || false,
    bgUrl:                getVal("bgUrl"),
    bgFit:                getVal("bgFit"),
    bgOpacity:            getSliderNum("bgOpacity"),
    bgVideoMuted:         getCheck("bgVideoMuted"),
    bgVideoLoop:          getCheck("bgVideoLoop"),

    sidebarTransparent:   getCheck("sidebarTransparent"),
    sidebarOpacity:       getSliderNum("sidebarOpacity"),
    sidebarBorder:        getCheck("sidebarBorder"),
    colorSidebarBorder:   getColor("colorSidebarBorder"),
    sidebarBorderOpacity: getSliderNum("sidebarBorderOpacity"),
  };
}

// =============================================
//  SEND THEME TO ROBLOX TAB
// =============================================
function sendToActiveTab(action, data) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.id) return;
    chrome.tabs.sendMessage(tabs[0].id, { action, data });
  });
}

// =============================================
//  EVENT LISTENERS (each in its own function)
// =============================================

function setupTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    });
  });
}

function setupColorPickers() {
  // Map of picker id → hex label id
  const pairs = {
    colorBg:           "hexBg",
    colorBtn:          "hexBtn",
    colorText:         "hexText",
    colorLink:         "hexLink",
    colorSidebarBorder:"hexSidebarBorder",
  };

  Object.entries(pairs).forEach(([pickerId, labelId]) => {
    const picker = document.getElementById(pickerId);
    const label  = document.getElementById(labelId);
    if (!picker || !label) return;

    picker.addEventListener("input", (e) => {
      label.textContent = e.target.value;
    });
  });

  // Reset buttons
  document.querySelectorAll(".btn-reset").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id  = btn.dataset.target;
      const def = DEFAULTS[id];
      if (def) setColor(id, def);
    });
  });
}

function setupSliders() {
  const sliders = [
    { id: "bgOpacity",           labelId: "bgOpacityVal"           },
    { id: "sidebarOpacity",      labelId: "sidebarOpacityVal"      },
    { id: "sidebarBorderOpacity",labelId: "sidebarBorderOpacityVal"},
  ];

  sliders.forEach(({ id, labelId }) => {
    const el    = document.getElementById(id);
    const label = document.getElementById(labelId);
    if (!el || !label) return;
    el.addEventListener("input", () => {
      label.textContent = el.value + "%";
    });
  });
}

function setupPresets() {
  document.querySelectorAll(".preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = PRESETS[btn.dataset.preset];
      if (!preset) return;
      Object.entries(preset).forEach(([key, val]) => setColor(key, val));
    });
  });
}

function setupBgType() {
  document.querySelectorAll("input[name='bgType']").forEach((radio) => {
    radio.addEventListener("change", (e) => {
      updateBgTypeVisibility(e.target.value, false);
    });
  });
}

function setupFileUpload() {
  // Opens picker.html in a new tab — avoids Chrome closing the popup on file dialog
  document.getElementById("btnOpenPicker")?.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("picker/picker.html") });
  });

  // When popup re-opens, refresh the preview label from storage
  refreshFilePreviewFromStorage();
}

// Read saved file info from storage and update the preview label in popup
function refreshFilePreviewFromStorage() {
  chrome.storage.local.get("robloxTheme", (data) => {
    const s = data?.robloxTheme;
    if (!s?.bgFileData) return;

    const label = document.getElementById("bgFileName");
    if (!label) return;

    label.textContent = s.bgFileIsVideo ? "🎬 Video loaded ✓" : "🖼️ Image loaded ✓";
    label.classList.add("loaded");

    // Also sync fit and opacity from saved picker settings
    if (s.bgFit)    setVal("bgFit", s.bgFit);
    if (s.bgOpacity != null) setSlider("bgOpacity", s.bgOpacity, "bgOpacityVal", "%");
  });
}

function setupSidebar() {
  document.getElementById("sidebarTransparent")?.addEventListener("change", () => {
    const trans  = getCheck("sidebarTransparent");
    const border = getCheck("sidebarBorder");
    updateSidebarVisibility(trans, border);
  });

  document.getElementById("sidebarBorder")?.addEventListener("change", () => {
    const trans  = getCheck("sidebarTransparent");
    const border = getCheck("sidebarBorder");
    updateSidebarVisibility(trans, border);
  });
}

function setupApplyButton() {
  document.getElementById("btnApply")?.addEventListener("click", async () => {
    const settings = await collectSettings();
    saveSettings(settings);
    sendToActiveTab("APPLY_THEME", settings);
    showApplyFeedback();
  });
}

function setupResetButton() {
  document.getElementById("btnReset")?.addEventListener("click", () => {
    if (!confirm("Reset all settings to default?")) return;
    saveSettings(DEFAULTS);
    applySettingsToUI(DEFAULTS);
    sendToActiveTab("APPLY_THEME", DEFAULTS);
  });
}

// =============================================
//  UI VISIBILITY HELPERS
// =============================================

function updateBgTypeVisibility(type, isVideo) {
  const show = (id, visible) =>
    document.getElementById(id)?.classList.toggle("hidden", !visible);

  show("bgFileZone",    type === "image" || type === "gif");
  show("bgUrlZone",     type === "url");
  show("bgVideoOptions",isVideo);
  show("bgFitLabel",    type !== "color");
  show("bgFitZone",     type !== "color");
}

function updateSidebarVisibility(transparent, border) {
  document.getElementById("sidebarOpacityBlock")
    ?.classList.toggle("hidden", !transparent);
  document.getElementById("sidebarBorderBlock")
    ?.classList.toggle("hidden", !border);
}

function showApplyFeedback() {
  const btn = document.getElementById("btnApply");
  if (!btn) return;
  const original = btn.textContent;
  btn.textContent = "Applied! ✓";
  btn.style.background = "linear-gradient(135deg, #059669, #047857)";
  setTimeout(() => {
    btn.textContent      = original;
    btn.style.background = "";
  }, 1500);
}

// =============================================
//  DOM HELPERS
// =============================================

function setCheck(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = Boolean(val);
}

function getCheck(id) {
  return document.getElementById(id)?.checked ?? false;
}

function setColor(id, val) {
  const picker = document.getElementById(id);
  if (picker) picker.value = val;

  // Update matching hex label: colorBg → hexBg, colorSidebarBorder → hexSidebarBorder
  const labelId = "hex" + id.replace("color", "");
  const label = document.getElementById(labelId);
  if (label) label.textContent = val;
}

function getColor(id) {
  return document.getElementById(id)?.value || "#000000";
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val || "";
}

function getVal(id) {
  return document.getElementById(id)?.value || "";
}

function setRadio(name, val) {
  const radio = document.querySelector(`input[name="${name}"][value="${val}"]`);
  if (radio) radio.checked = true;
}

function getRadio(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

function setSlider(id, val, labelId, suffix) {
  const el    = document.getElementById(id);
  const label = document.getElementById(labelId);
  if (el)    el.value        = val;
  if (label) label.textContent = val + suffix;
}

function getSliderNum(id) {
  return Number(document.getElementById(id)?.value ?? 0);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
