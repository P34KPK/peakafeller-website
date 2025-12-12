---
description: Critical checklist to run before pushing any changes to ensure site stability.
---

# Pre-Deployment Stability Check

Run this check before `git push` to prevent regression.

## 1. Mobile Menu Validation
- [ ] **Physical Click**: Is the Burger Icon clickable?
- [ ] **Scroll Behavior**: Does the icon scroll with the page?
- [ ] **Fixed Behavior**: Does the icon become FIXED when the menu is open?
- [ ] **Visuals**: Is the menu fully black with no transparency issues?

## 2. Visual Core Validation
- [ ] **Canvas**: Does the background animation load? (Check console for "System 2 initialized")
- [ ] **Cursor**: Is the custom cursor visible and following the mouse?
- [ ] **Errors**: Are there any RED errors in the console?

## 3. Code Integrity
- [ ] **Main.js**: Did you accidentally remove the `try/catch` blocks?
- [ ] **Index.html**: Is the `onclick` handler still on the `.header-menu-icon`?
- [ ] **Z-Index**: Did you change any z-index values? If so, verify against `README.md`.

## 4. Final Command
If all checks pass:
```bash
npm run build
git add .
git commit -m "Stability Verified: [Your Message]"
git push
```
