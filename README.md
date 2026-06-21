# 🎨 Roblox Theme Studio

A free, open-source Chrome extension that lets you fully customize the look of Roblox.com — your colors, your background, your vibe.

---

## ✨ Features

| Feature | Details |
|---|---|
| 🎨 Custom colors | Change button, text, link, and background colors |
| 🖼️ Custom background | Upload an image, GIF, MP4/WebM video, or paste a URL |
| 🔲 Fill modes | Cover, Contain, Stretch, Tile, Center |
| 👁️ Transparent sidebar | Make the left nav panel see-through |
| 🔲 Sidebar border | Optional glowing border around the sidebar |
| 🌈 Quick presets | Dark, Ocean, Sakura, Forest, Sunset |
| 🔄 Toggle on/off | Enable or disable the theme instantly |

---

## 🚀 Installation (Developer Mode)

1. Download or clone this last release
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked**
5. Select this folder (`roblox-theme-studio`)
6. Open [roblox.com](https://www.roblox.com) and click the extension icon

---

## 📁 File Structure

```
roblox-theme-extension/
│
├── manifest.json          # Extension config (permissions, content scripts)
│
├── popup/
│   ├── popup.html         # Extension UI (the panel that opens on click)
│   ├── popup.css          # Popup styling
│   └── popup.js           # UI logic, settings save/load, tab switching
│
├── content/
│   ├── theme.js           # Injected into Roblox — applies all visual changes
│   └── theme.css          # Baseline CSS injected into Roblox
│
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 🛠️ Customizing / Contributing

The code is written to be easy to read and modify:

### Change which Roblox elements are styled
Edit the `SELECTORS` object at the top of `content/theme.js`:
```js
const SELECTORS = {
  sidebar:  ".left-col, ...",   // ← add more sidebar selectors here
  buttons:  ".btn-primary-md, ...",
  // ...
};
```

### Add a new color preset
Edit `PRESETS` in `popup/popup.js`:
```js
const PRESETS = {
  mypreset: { colorBg: "#ff0000", colorBtn: "#00ff00", colorText: "#fff", colorLink: "#aaa" },
  // ...
};
```
Then add a button in `popup.html`:
```html
<button class="preset" data-preset="mypreset" title="My Preset">🔥</button>
```

### Add a new setting
1. Add a default value in `DEFAULTS` (popup.js)
2. Add the UI element in `popup.html`
3. Save/load it in `collectSettings()` and `applySettingsToUI()` (popup.js)
4. Use it in `applyTheme()` (theme.js)

---

## 📜 License

MIT License — free to use, modify, and distribute.

---

## 🤝 Contributing

Pull requests are welcome! Please keep code well-commented and readable.
