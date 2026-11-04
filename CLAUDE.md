# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Personal landing page for Emerson Mendes, served by GitHub Pages at https://emersonmendes.github.io/ (custom domain `www.emersonmendes.com.br` via `CNAME`). It renders a retro CRT monitor showing a fake terminal: on load it "types out" `emerson.txt`, then hands control to an interactive shell with a few commands and a Snake game.

Plain static site: `index.html` + `index.css` + `index.js` + `emerson.txt`. No build step, package manager, linter, or tests. `_config.yml` (Jekyll hacker theme) exists only for GitHub Pages; the page doesn't use Jekyll layouts.

## Running locally

`emerson.txt` is fetched via `$.get`, so opening `index.html` from `file://` won't work. Serve the directory over HTTP:

```sh
python3 -m http.server 8000
```

Deploy = push to `master` (GitHub Pages).

## Architecture (`index.js`)

jQuery **1.4.2** loaded from the Google CDN — use the old API (`bind`/`unbind`, namespaced events like `.mobileterm` / `.crtscr`), not `on`/`off`. Code is ES5 with global singleton objects that call each other directly:

- **Boot** – boot sequence: runs `Typer` on an interval until `emerson.txt` is fully typed, then calls `Terminal.init()`. `Boot.stop()` clears every timer (Typer, boot, terminal cursor).
- **Typer** – loads `emerson.txt` and progressively renders it into `#console` (newlines → `<br/>`). `emerson.txt` is **HTML**, not plain text: it contains `<span class="term-host">…` prompt markup, links, and `<p>` tags. Keep the prompt markup in sync with `Terminal.getPromptHtml()`.
- **Terminal** – the interactive shell. A tiny virtual FS where only `/`, `/home`, `/home/emerson`, and `emerson.txt` exist (`isValidPath`, `listDir`). Commands are a single `if/else` chain in `processCommand()`; adding a command means adding a branch there **and** a line in the `help` output. `rm emerson.txt` is deliberately refused. The current input line is the last `#cmd-input` span + `#cursor`; `processCommand` removes them and appends a fresh prompt.
- **Snake** – takes over `#console` and the keyboard (unbinds terminal handlers), renders an ASCII grid; on game over/ESC it calls `Terminal.init()` to restore the shell.
- **Power** – monitor power button; toggles CRT off/on CSS animation classes (`powering-off`, `is-off`, `powering-on`) on `.crt-screen` and replays `Boot.start()` when turned back on. Must tear down Snake/Terminal state when turning off.
- **CrtScroll** – custom scrollbar for `#crt-content` (drag/click on track), kept in sync via a `MutationObserver` on `#console`.
- **MobileTerm** – at `max-width: 768px`, keyboard input comes from the hidden `#terminal-mobile-input` (to open the virtual keyboard) and is mirrored into `Terminal.input`, instead of document `keydown`/`keypress`. Toggles `body.mobile-term-active` / `body.mobile-snake`, which `index.css` uses in its mobile media query.

Mode/state is tracked by global flags (`Terminal.isActive`, `Snake.isActive`, `Power.isOn`/`busy`). Each mode switch unbinds document key handlers and binds its own, so any new mode must do the same and restore the terminal on exit. `Terminal.attachEvents()` is re-run on window resize to switch between desktop and mobile input.

## Styling (`index.css`)

Color tokens are CSS variables on `:root` (`--term-green`, `--term-blue`, `--term-pink`, …). CRT effects (scanlines, flicker, power on/off keyframes) and the mobile layout (`@media (max-width: 768px)`) live here. Some inline colors in `Terminal`'s `help` output are hardcoded hex values matching those tokens.
