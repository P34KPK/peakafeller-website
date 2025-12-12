# PEAKAFELLER WEBSITE - TECHNICAL DOCUMENTATION

## 🛡️ Architecture & Stability Protocols

This project uses a "Fault-Tolerant" architecture to ensure critical features (Visuals, Navigation) remain functional even if parts of the JavaScript fail to load or initialize immediately.

### 1. Visual Systems (Canvas & Cursor)
The visual core is split into isolated systems in `src/main.js`:
- **System 1 (Cursor)**: initialized via `DOMContentLoaded`. Critical for UX.
- **System 2 (Canvas Background)**: Initialized via an **Immediately Invoked Function Expression (IIFE)** with a **Retry Loop (5 seconds)**. 
  - *Why?* To handle slow DOM updates on GitHub Pages or mobile devices where `window.onload` might be unreliable or fire too late.
  - **Do NOT remove the retry logic.**

### 2. Mobile Navigation (Menu Burger)
The mobile menu uses a hybrid robustness approach:
- **HTML**: Direct `onclick` attribute in `index.html` (`this.classList.toggle...`).
- **CSS**: The icon is `position: absolute` by default (scrolls with page) but switches to `position: fixed` when open (`.is-open`).
- **Safety**: The icon element is placed at the ROOT of `<body>` to avoid Stacking Context (z-index) issues with other containers.
- **Do NOT move the burger icon back into a container.**

### 3. Critical CSS Rules
- **Z-Index Hierarchy**:
  - Cursor: `999999` (Top)
  - Menu Icon (Open): `10002`
  - Menu Icon (Closed): `10001`
  - Boot Overlay: `10000`
  - Header Nav (Open): `10000`
  - Canvas: `0`
- **Pointer Events**:
  - `.floating-header` on mobile has `pointer-events: none` to prevent it from acting as an invisible shield blocking clicks.

## 🚀 Deployment Checklist

Before deploying, verify:
1. **Mobile Menu**: Does it open? Does it close? can you click it when scrolled down?
2. **Visuals**: Does the background load on a hard refresh (Ctrl+Shift+R)?
3. **Console**: Are there any "Critical" errors logged? "Waiting for Canvas..." logs are normal/healthy.

---
*Maintained by Agent Antigravity. Do not refactor robustness logic without understanding the race conditions solved here.*
