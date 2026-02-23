# CLAUDE.md — Project Instructions

## What this project is
A vanilla JS PWA for real-time bus tracking across Andalusia, Spain. No build step, no framework. Files are served directly from the repo root via GitHub Pages.

---

## Versioning — fully automated, never do it manually

### App version badge + SW cache name
- Displayed in `index.html` as `<div class="home-version" id="home-version">vN</div>`
- Mirrored in `sw.js` as `const CACHE = 'ctan-shell-vN'`
- **Auto-bumped by `bump-version.yml`** on every push to `main`
- Never touch these manually

### Per-file `?v=N` cache-busting query strings
Every `<script src="src/js/foo.js?v=N">` and `<link href="src/style.css?v=N">` in HTML files
- **Also auto-bumped by `bump-version.yml`** — it diffs the commit, finds which `src/js/*.js` or `src/style.css` files changed, and increments their `?v=N` in every HTML file that references them
- Never bump these manually either — just edit the JS/CSS file and push

### Infinite loop guard
The bump workflow skips itself when the commit message starts with `chore: bump version`

---

## Commits and pushes
- The version bump bot pushes a `chore: bump version to vN` commit after every push to `main`
- This frequently causes a rejected push if you commit and push back-to-back
- Always do `git pull --rebase && git push` if the push is rejected

---

## File structure
```
*.html              — one page per feature, self-contained
src/js/*.js         — one module per page, plus i18n.js (shared)
src/style.css       — all styles
sw.js               — service worker (offline shell cache)
manifest.json       — PWA manifest
tests/              — Python + Playwright tests
.github/workflows/  — CI, deploy, bump-version, sw-cache-check
```

## Each page loads
1. `src/js/i18n.js?v=N` — shared: getLang, t(), getCookie, setCookie, getDefaultRegion
2. Its own `src/js/<page>.js?v=N`
3. `sw.js` registration (inline script, except index.html which does it in home.js)

---

## Key conventions

### Adding a new page
1. Create `newpage.html` and `src/js/newpage.js`
2. Add SW registration at bottom of HTML: `<script>if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');</script>`
3. Add both files to the `SHELL` array in `sw.js`
4. Don't manually bump `?v=` — the bot handles it on next push

### Editing JS or CSS
- Just edit and push — bot bumps the `?v=N` automatically
- No build step needed

### API
- Base URL: `https://api.ctan.es/v1/Consorcios`
- Never cached by the SW (api.ctan.es requests bypass the service worker)
- All pages use a local `fetchJSON(url)` helper that throws on non-2xx

### Language
- Two languages: `en` and `es`, stored in cookie `lang`
- All strings live in either `i18n.js` (shared) or a `STRINGS`/`HOME_STRINGS` object in the page's own JS
- Use `getLang()` and `t(key, ...args)` / local string lookup functions

### Cookies (persistence)
| Cookie | What |
|--------|------|
| `lang` | `'en'` or `'es'` |
| `defaultRegion` | JSON `{id, nombre}` |
| `defaultDateMode` | `'today'` or `'tomorrow'` |
| `savedStops` | JSON array of stop objects |
| `pwaPromptDismissed` | `'1'` if user dismissed the install banner |

### sessionStorage (single-session)
| Key | Set by | Purpose |
|-----|--------|---------|
| `mapPolyline` | `route.js` | Polyline for map.html route mode |
| `journeyPolylines` | `journey.js` | Per-leg polylines for journey map |
| `showUpdateConfetti` | `home.js` | Triggers confetti after SW update reload |

---

## GitHub Actions workflows

| File | Trigger | What it does |
|------|---------|--------------|
| `ci.yml` | push/PR to main | Runs Python + Playwright tests |
| `deploy.yml` | push to main | Deploys repo root to GitHub Pages |
| `bump-version.yml` | push to main | Bumps app version + ?v= strings, commits back |
| `sw-cache-check.yml` | PR to main | Warns if HTML/JS changed but sw.js wasn't updated |

---

## Tests
- Python + Playwright (headless Chromium)
- Local server on port 8787 serves the repo root
- `pytest tests/` to run all
- Network-hitting tests marked `@pytest.mark.network`
- Sevilla (consortium ID 1) used for network tests — more reliable than Málaga
- Planner tests use `?date=tomorrow` to guarantee results regardless of time of day

### Key test constants (conftest.py)
```python
MALAGA_ID       = "4"
NUCLEO_COIN     = "201"
NUCLEO_ALHAURIN = "83"
STOP_MUELLE_HEREDIA = "149"
```

---

## Wiki
Full documentation lives at: https://github.com/hendrikbgr/andalusia-public-transport-app/wiki

The wiki is a separate git repo — clone it with:
```bash
git clone https://github.com/hendrikbgr/andalusia-public-transport-app.wiki.git
```
Push pages there directly (not to the main repo).
