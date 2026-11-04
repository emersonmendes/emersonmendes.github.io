# AGENTS.md

This file provides guidance to AI coding agents working in this repository.

## Overview

Personal landing page for Emerson Mendes, served by GitHub Pages at https://emersonmendes.github.io/ (custom domain `www.emersonmendes.com.br` via `CNAME`). It renders a retro CRT monitor showing a fake terminal: on load it "types out" `emerson.txt`, then hands control to an interactive shell with a few commands and a Snake game.

Plain static site: `index.html` + `index.css` + `index.js` + `emerson.txt` (plus its translations `emerson.pt.txt`, `emerson.es.txt`). No build step, package manager, or linter. `_config.yml` (Jekyll hacker theme) exists only for GitHub Pages; the page doesn't use Jekyll layouts.

## Running locally

`emerson.txt` is fetched via `$.get`, so opening `index.html` from `file://` won't work. Serve the directory over HTTP:

```sh
python3 -m http.server 8000
```

Deploy = push to `master` (GitHub Pages).

## Tests

**Rule: every new feature or bug fix must come with tests in `tests/tests.js` covering the new behavior, and `tests/run.sh` must pass before committing.** When changing existing behavior, update the affected tests in the same change.

```sh
tests/run.sh            # whole suite in headless Chrome; exit 0 = all passed
tests/run.sh "Tab"      # only tests whose name contains "Tab" (case-insensitive)
```

Or open http://localhost:8000/tests/ (optionally `?grep=Tab`) with the local server running to see results in the browser. Needs `python3` and Chrome/Chromium (`CHROME=...` to override), plus network access for the jQuery CDN.

How it works: `tests/index.html` loads the real `index.html` in an iframe; `tests/harness.js` drives it with synthetic `KeyboardEvent`s (with `keyCode`/`which` patched in, since the site reads those) and reads results from the DOM. Before each test it resets the terminal to an empty prompt in `/home/emerson` with empty history. The iframe loads `index.html?lang=en`, so tests run in English whatever the browser language; tests that switch language with `switchLang(code)` must switch back to `"en"` in a `finally`. Useful helpers: `run(cmd)` returns the output lines, `line()` returns the input line with `|` at the cursor (e.g. `"cat |emerson.txt"`), `type`, `key(KEY.X, {ctrl, target})`, `consoleLines`, `setViewport(px)` (≤768 switches to mobile input). Headless Chrome runs with virtual time, so `setTimeout` waits are instant, but `requestAnimationFrame` never fires (poll with `waitFor` instead) and CSS transitions never advance (the harness disables them, so computed styles show the final value immediately). `tests/` is excluded from the published site in `_config.yml`.

## Architecture (`index.js`)

jQuery **1.4.2** loaded from the Google CDN — use the old API (`bind`/`unbind`, namespaced events like `.mobileterm` / `.crtscr`), not `on`/`off`. Code is ES5 with global singleton objects that call each other directly:

- **I18n** – UI language: `en`, `pt` or `es`. Starting language is `?lang=` in the URL, then the choice saved in `localStorage` (`lang`), then the first supported browser language (`navigator.languages`), else English (`pick`/`detect`). All user-facing strings live in `I18n.strings` and are read with `I18n.t(key, vars)` (`{name}` placeholders); every new string needs all three languages. **Commands, paths, file names and technical words (`root`, `home`, `snake`…) are never translated.** The EN/PT/ES keys on the monitor case (`#lang-switch`) call `I18n.change()`, which saves the choice, updates `<html lang>`/aria labels (`apply`) and replays `Boot.start()` in the new language (stopping Snake first; if the monitor is off it only switches, and the next boot uses it).
- **Boot** – boot sequence: runs `Typer` on an interval until `emerson.txt` is fully typed, then calls `Terminal.init()`. `Boot.stop()` clears every timer (Typer, boot, terminal cursor).
- **Typer** – loads `emerson.txt` for the current language (`Typer.files`: `emerson.txt` / `emerson.pt.txt` / `emerson.es.txt`, cached in `Typer.cache`; inside the terminal it is always called `emerson.txt`) and progressively renders it into `#console` (newlines → `<br/>`). `emerson.txt` is **HTML**, not plain text: it contains `<span class="term-host">…` prompt markup, links, and `<p>` tags. Keep the prompt markup in sync with `Terminal.getPromptHtml()`, and keep the three language files in sync with each other (same markup and links, only the prose translated).
- **Terminal** – the interactive shell. A tiny virtual FS where only `/`, `/home`, `/home/emerson`, and `emerson.txt` exist (`listDirAt`, `isValidPath`, `isEmersonFile`); path arguments go through `resolvePath` (absolute or relative, `.`/`..`). Commands are a single `if/else` chain in `processCommand()`; adding a command means adding a branch there **and** a line in the `help` output. `rm emerson.txt` is deliberately refused. Line editing state is `input` + `cursorPos`; change it through `setInput`/`insertText`/`deleteChar`/`moveCursorTo` so the display stays in sync. The input line is `#cmd-input` (text before cursor) + `#cursor` + `#cmd-after` (`inputLineHtml()` / `removeInputLine()`); `processCommand` replaces it with the echoed command and appends a fresh prompt. Also has Tab completion (`complete`) and ↑/↓ history (`history`, `historyIndex`, `historyDraft`).
- **Snake** – takes over `#console` and the keyboard (unbinds terminal handlers), renders an ASCII grid; on game over/ESC it calls `Terminal.init()` to restore the shell. `Snake.stop()` tears the game down without restoring the shell (used by Power and I18n).
- **Power** – monitor power button; toggles CRT off/on CSS animation classes (`powering-off`, `is-off`, `powering-on`) on `.crt-screen` and replays `Boot.start()` when turned back on. Must tear down Snake/Terminal state when turning off.
- **CrtScroll** – custom scrollbar for `#crt-content` (drag/click on track), kept in sync via a `MutationObserver` on `#console`.
- **MobileTerm** – at `max-width: 768px`, keyboard input comes from the hidden `#terminal-mobile-input` (to open the virtual keyboard) and is mirrored (value and caret) into `Terminal.input`/`cursorPos`, instead of document `keydown`/`keypress`. Toggles `body.mobile-term-active` / `body.mobile-snake`, which `index.css` uses in its mobile media query.

Mode/state is tracked by global flags (`Terminal.isActive`, `Snake.isActive`, `Power.isOn`/`busy`). Each mode switch unbinds document key handlers and binds its own, so any new mode must do the same and restore the terminal on exit. `Terminal.attachEvents()` is re-run on window resize to switch between desktop and mobile input.

## Styling (`index.css`)

Color tokens are CSS variables on `:root` (`--term-green`, `--term-blue`, `--term-pink`, …). CRT effects (scanlines, flicker, power on/off keyframes) and the mobile layout (`@media (max-width: 768px)`) live here. Some inline colors in `Terminal`'s `help` output are hardcoded hex values matching those tokens.
