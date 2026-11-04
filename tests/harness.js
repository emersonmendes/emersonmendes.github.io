/*
 * Minimal test harness: loads the real site (../index.html) in an iframe and
 * drives it with synthetic keyboard events. No dependencies.
 *
 * - test(name, fn, { reset: false }) registers a test (fn may be async).
 *   Before each test the terminal is reset to a fresh prompt in /home/emerson
 *   with empty history, unless { reset: false }.
 * - Results go to #summary; data-status="pass" | "fail" | "error" is what
 *   tests/run.sh reads.
 */
"use strict";

const frame = document.getElementById("site");
/** The site's window (Terminal, Snake, Power, MobileTerm, $ ...). */
let w;
const tests = [];

function test(name, fn, opts) {
    tests.push({ name, fn, reset: !(opts && opts.reset === false) });
}

// ---------------------------------------------------------------- assertions

function fail(msg) {
    throw new Error(msg);
}

function eq(actual, expected, msg) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) fail((msg ? msg + ": " : "") + "expected " + e + ", got " + a);
}

function ok(cond, msg) {
    if (!cond) fail(msg || "expected a truthy value");
}

function contains(haystack, needle, msg) {
    if (!String(haystack).includes(needle)) {
        fail((msg ? msg + ": " : "") + JSON.stringify(needle) + " not found in " + JSON.stringify(haystack));
    }
}

// ------------------------------------------------------------------- timing

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(cond, timeoutMs, label) {
    const start = Date.now();
    while (!cond()) {
        if (Date.now() - start > (timeoutMs || 5000)) fail("timed out waiting for " + (label || "condition"));
        await sleep(20);
    }
}

// ------------------------------------------------------------- site drivers

const KEY = {
    BACKSPACE: 8, TAB: 9, ENTER: 13, ESC: 27, END: 35, HOME: 36,
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, DELETE: 46, A: 65, E: 69,
};

/** Dispatches a keyboard event (keyCode/which set like a real browser) and returns it. */
function key(code, opts) {
    opts = opts || {};
    const e = new w.KeyboardEvent(opts.type || "keydown", {
        bubbles: true,
        cancelable: true,
        ctrlKey: !!opts.ctrl,
    });
    Object.defineProperty(e, "keyCode", { get: () => code });
    Object.defineProperty(e, "which", { get: () => code });
    (opts.target || w.document).dispatchEvent(e);
    return e;
}

/** Types text like a desktop keyboard: keydown, then keypress unless cancelled. */
function type(text) {
    for (const ch of text) {
        const down = key(0);
        if (!down.defaultPrevented) key(ch.charCodeAt(0), { type: "keypress" });
    }
}

function htmlToText(html) {
    const d = document.createElement("div");
    d.innerHTML = html;
    return d.textContent;
}

/** Screen contents as plain-text lines (split on <br>). */
function consoleLines() {
    return w.document.getElementById("console").innerHTML.split(/<br\s*\/?>/i).map(htmlToText);
}

/** Types a command, presses Enter and returns the output lines (without echo and new prompt). */
function run(cmd) {
    const before = consoleLines().length;
    type(cmd);
    key(KEY.ENTER);
    const lines = consoleLines();
    return lines.slice(before, lines.length - 1);
}

/** Current input line with "|" marking the cursor, e.g. "cat |emerson.txt". */
function line() {
    const before = w.document.getElementById("cmd-input").textContent;
    const after = w.document.getElementById("cmd-after").textContent;
    return before + "|" + after;
}

function clearLine() {
    w.Terminal.setInput("");
}

/** Resizes the site's viewport (e.g. below 768px for the mobile input mode). */
async function setViewport(width) {
    frame.style.width = width + "px";
    void frame.offsetWidth; // force layout so the iframe picks up its new size
    // (requestAnimationFrame never fires in headless Chrome with virtual time, so poll instead)
    await waitFor(() => w.MobileTerm.useMobileCapture() === (width <= 768), 3000, "viewport " + width + "px");
    w.$(w).trigger("resize");
}

/** Fresh terminal: prompt in /home/emerson, empty screen, input and history. */
function reset() {
    const T = w.Terminal;
    T.history = [];
    T.historyIndex = -1;
    T.historyDraft = "";
    T.path = ["home", "emerson"];
    w.$("#console").html("");
    T.init();
}

// ------------------------------------------------------------------- runner

async function runTests() {
    const summary = document.getElementById("summary");
    const grep = (new URLSearchParams(location.search).get("grep") || "").toLowerCase();
    const report = [];
    let passed = 0;
    let failed = 0;

    try {
        await waitFor(() => frame.contentWindow && frame.contentWindow.Terminal && frame.contentWindow.Typer, 20000, "site scripts");
        w = frame.contentWindow;
        w.Typer.speed = 1e6; // skip the typing animation
        await waitFor(() => w.Terminal.isActive, 20000, "boot to finish");

        for (const t of tests) {
            if (grep && !t.name.toLowerCase().includes(grep)) continue;
            summary.textContent = "running: " + t.name;
            try {
                if (t.reset) reset();
                await t.fn();
                passed++;
                report.push("<span class='pass'>✓ " + escapeHtml(t.name) + "</span>");
            } catch (err) {
                failed++;
                report.push("<span class='fail'>✗ " + escapeHtml(t.name) + "\n    " + escapeHtml(err && err.message || String(err)) + "</span>");
            }
        }
        report.push("", passed + " passed, " + failed + " failed");
        summary.dataset.status = failed || !passed ? "fail" : "pass";
        if (!passed && !failed) report.push("no tests matched " + JSON.stringify(grep));
    } catch (err) {
        report.push("<span class='fail'>harness error: " + escapeHtml(err && err.message || String(err)) + "</span>");
        summary.dataset.status = "error";
    }
    summary.innerHTML = report.join("\n");
}

function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
}
