/*
 * Tests for the site's terminal. Every new feature or bug fix gets tests here.
 * Helpers (test, eq, ok, contains, run, type, key, KEY, line, ...) live in harness.js.
 */
"use strict";

// ------------------------------------------------------------------- boot

test("boot types emerson.txt and ends at an interactive prompt", () => {
    const text = consoleLines().join("\n");
    contains(text, "I am Emerson Mendes");
    contains(consoleLines().slice(-1)[0], "root@emersonmendes:~$");
    ok(w.Terminal.isActive, "terminal should be active after boot");
}, { reset: false });

// --------------------------------------------------------------- commands

test("help lists every command (and only commands)", () => {
    const out = run("help").join("\n");
    for (const c of ["cd", "pwd", "ls", "cat", "rm", "snake", "clear", "help"]) contains(out, c + " - ");
    ok(!out.includes("Tab"), "keyboard shortcuts are not listed in help");
});

test("unknown command", () => {
    eq(run("foo bar"), ["Command not found: foo bar", "Type 'help' for available commands."]);
});

test("empty Enter just prints a new prompt", () => {
    eq(run(""), []);
    eq(w.Terminal.history, []);
});

test("pwd prints the current directory", () => {
    eq(run("pwd"), ["/home/emerson"]);
    run("cd ..");
    eq(run("pwd"), ["/home"]);
    run("cd ..");
    eq(run("pwd"), ["/"]);
});

test("cd supports absolute, relative, .., ~, no argument and trailing slash", () => {
    run("cd /");
    eq(run("pwd"), ["/"]);
    run("cd home/emerson/");
    eq(run("pwd"), ["/home/emerson"]);
    run("cd ../..");
    eq(run("pwd"), ["/"]);
    run("cd ~");
    eq(run("pwd"), ["/home/emerson"]);
    run("cd /home/");
    eq(run("pwd"), ["/home"]);
    run("cd");
    eq(run("pwd"), ["/home/emerson"]);
});

test("cd into a missing directory errors and keeps the cwd", () => {
    eq(run("cd nope"), ["cd: nope: No such file or directory"]);
    eq(run("cd /home/emerson/emerson.txt"), ["cd: /home/emerson/emerson.txt: No such file or directory"]);
    eq(run("pwd"), ["/home/emerson"]);
});

test("prompt shows the cwd (~ for /home/emerson)", () => {
    run("cd /");
    contains(consoleLines().slice(-1)[0], "root@emersonmendes:/$");
    run("cd /home");
    contains(consoleLines().slice(-1)[0], "root@emersonmendes:/home$");
    run("cd emerson");
    contains(consoleLines().slice(-1)[0], "root@emersonmendes:~$");
});

test("ls lists the current directory", () => {
    eq(run("ls"), ["emerson.txt"]);
    run("cd ..");
    eq(run("ls"), ["emerson"]);
    run("cd /");
    eq(run("ls"), ["home"]);
    eq(run("ls home"), ["ls: too many arguments"]);
});

test("cat prints emerson.txt by relative and absolute path", () => {
    contains(run("cat emerson.txt").join("\n"), "I am Emerson Mendes");
    contains(run("cat ./emerson.txt").join("\n"), "I am Emerson Mendes");
    run("cd /");
    contains(run("cat /home/emerson/emerson.txt").join("\n"), "I am Emerson Mendes");
    contains(run("cat home/emerson/emerson.txt").join("\n"), "I am Emerson Mendes");
});

test("cat errors", () => {
    eq(run("cat"), ["cat: missing file operand"]);
    eq(run("cat nope.txt"), ["cat: nope.txt: No such file or directory"]);
    eq(run("cat /home"), ["cat: /home: Is a directory"]);
    run("cd /");
    eq(run("cat emerson.txt"), ["cat: emerson.txt: No such file or directory"]);
});

test("rm refuses to delete emerson.txt by any path", () => {
    for (const p of ["emerson.txt", "./emerson.txt", "/home/emerson/emerson.txt", "../emerson/emerson.txt"]) {
        eq(run("rm " + p), ["Nice try, but this file is unremovable."], "rm " + p);
    }
    eq(run("ls"), ["emerson.txt"]);
});

test("rm errors", () => {
    eq(run("rm"), ["rm: missing operand"]);
    eq(run("rm nope"), ["rm: cannot remove 'nope': No such file or directory"]);
    eq(run("rm .."), ["rm: cannot remove '..': Is a directory"]);
});

test("clear leaves only the prompt", () => {
    run("ls");
    run("clear");
    const lines = consoleLines();
    eq(lines.length, 1);
    contains(lines[0], "root@emersonmendes:~$");
});

test("there is exactly one input line on screen", () => {
    run("ls");
    run("pwd");
    type("abc");
    eq(w.document.querySelectorAll("#cmd-input").length, 1);
    eq(w.document.querySelectorAll("#cursor").length, 1);
    eq(w.document.querySelectorAll("#cmd-after").length, 1);
});

// ---------------------------------------------------------- tab completion

function tab(text) {
    clearLine();
    type(text);
    key(KEY.TAB);
    return line();
}

test("Tab completes file names (adds a trailing space)", () => {
    eq(tab("cat em"), "cat emerson.txt |");
    eq(tab("cat "), "cat emerson.txt |");
    eq(tab("rm ./em"), "rm ./emerson.txt |");
});

test("Tab completes directories (adds a trailing slash), one level per press", () => {
    eq(tab("cd /h"), "cd /home/|");
    key(KEY.TAB);
    eq(line(), "cd /home/emerson/|");
    eq(tab("cd ../"), "cd ../emerson/|");
    clearLine();
    run("cd /");
    eq(tab("cd h"), "cd home/|");
    eq(tab("cat home/emerson/e"), "cat home/emerson/emerson.txt |");
});

test("Tab after cd only offers directories", () => {
    eq(tab("cd "), "cd |");
    eq(tab("cd em"), "cd em|");
});

test("Tab does nothing without a match or on the command name", () => {
    eq(tab("cat xyz"), "cat xyz|");
    eq(tab("ca"), "ca|");
    eq(tab("pwd "), "pwd |");
});

test("Tab is captured by the terminal (focus does not move)", () => {
    ok(key(KEY.TAB).defaultPrevented);
});

test("a Tab-completed path is accepted by the command", () => {
    tab("cd /h");
    key(KEY.TAB);
    key(KEY.ENTER);
    eq(run("pwd"), ["/home/emerson"]);
});

// ------------------------------------------------------------ history

test("ArrowUp with empty history does nothing", () => {
    key(KEY.UP);
    eq(line(), "|");
});

test("ArrowUp/ArrowDown browse history and restore the draft", () => {
    run("pwd");
    run("ls");
    run("ls"); // consecutive duplicate is stored once
    run("cd ..");
    run("   "); // blank lines are not stored
    type("ca"); // draft

    key(KEY.UP);
    eq(line(), "cd ..|");
    key(KEY.UP);
    eq(line(), "ls|");
    key(KEY.UP);
    eq(line(), "pwd|");
    key(KEY.UP);
    eq(line(), "pwd|", "stays at the oldest entry");

    key(KEY.DOWN);
    eq(line(), "ls|");
    key(KEY.DOWN);
    eq(line(), "cd ..|");
    key(KEY.DOWN);
    eq(line(), "ca|", "back to the draft");
    key(KEY.DOWN);
    eq(line(), "ca|");
});

test("a recalled command runs and goes back to the end of history", () => {
    run("pwd");
    run("cd ..");
    key(KEY.UP);
    key(KEY.UP);
    key(KEY.ENTER);
    contains(consoleLines().slice(-2)[0], "/home");
    key(KEY.UP);
    eq(line(), "pwd|");
});

test("arrow keys are captured by the terminal (no page scroll)", () => {
    ok(key(KEY.UP).defaultPrevented);
    ok(key(KEY.DOWN).defaultPrevented);
    ok(key(KEY.LEFT).defaultPrevented);
    ok(key(KEY.RIGHT).defaultPrevented);
});

// ----------------------------------------------------------- line editing

test("Left/Right move the cursor and typing inserts at it", () => {
    type("cat emersn.txt");
    for (let i = 0; i < 5; i++) key(KEY.LEFT);
    eq(line(), "cat emers|n.txt");
    type("o");
    eq(line(), "cat emerso|n.txt");
    key(KEY.RIGHT);
    eq(line(), "cat emerson|.txt");
});

test("an edited line runs the edited command", () => {
    type("cat emersn.txt");
    for (let i = 0; i < 5; i++) key(KEY.LEFT);
    type("o");
    key(KEY.ENTER);
    contains(consoleLines().join("\n"), "I am Emerson Mendes");
});

test("cursor stops at both ends of the line", () => {
    type("ab");
    key(KEY.RIGHT);
    eq(line(), "ab|");
    key(KEY.LEFT);
    key(KEY.LEFT);
    key(KEY.LEFT);
    eq(line(), "|ab");
});

test("Home/End and Ctrl+A/Ctrl+E jump to the start/end", () => {
    type("hello");
    key(KEY.HOME);
    eq(line(), "|hello");
    key(KEY.END);
    eq(line(), "hello|");
    key(KEY.A, { ctrl: true });
    eq(line(), "|hello");
    key(KEY.E, { ctrl: true });
    eq(line(), "hello|");
});

test("Backspace deletes before the cursor, Delete after it", () => {
    type("abcd");
    key(KEY.LEFT);
    key(KEY.LEFT);
    key(KEY.BACKSPACE);
    eq(line(), "a|cd");
    key(KEY.DELETE);
    eq(line(), "a|d");
    key(KEY.END);
    key(KEY.DELETE);
    eq(line(), "ad|", "Delete at the end is a no-op");
    key(KEY.HOME);
    key(KEY.BACKSPACE);
    eq(line(), "|ad", "Backspace at the start is a no-op");
});

test("a recalled command can be edited before running it", () => {
    run("cat emerson.txt");
    key(KEY.UP);
    key(KEY.HOME);
    key(KEY.DELETE);
    key(KEY.DELETE);
    key(KEY.DELETE);
    type("rm");
    eq(line(), "rm| emerson.txt");
    key(KEY.ENTER);
    contains(consoleLines().slice(-2)[0], "Nice try, but this file is unremovable.");
});

test("typed spaces are kept and the cursor does not push the text", () => {
    type("a  b");
    key(KEY.LEFT);
    eq(line(), "a  |b");
    const input = w.document.getElementById("cmd-input");
    eq(w.getComputedStyle(input).whiteSpace, "pre-wrap");
    eq(w.document.getElementById("cursor").getBoundingClientRect().width, 0);
});

// ------------------------------------------------------------------ snake

test("snake: green body, yellow food, ESC returns to the terminal", () => {
    type("snake");
    key(KEY.ENTER);
    ok(w.Snake.isActive, "snake should be running");
    ok(!w.Terminal.isActive, "terminal input should be disabled");

    const game = w.document.getElementById("snake-game");
    eq(game.querySelectorAll(".snake-body").length, 3);
    eq(game.querySelectorAll(".snake-food").length, 1);
    eq(w.getComputedStyle(game.querySelector(".snake-body")).color, "rgb(0, 255, 0)");
    eq(w.getComputedStyle(game.querySelector(".snake-food")).color, "rgb(255, 255, 0)");

    key(KEY.ESC);
    ok(!w.Snake.isActive, "snake should stop");
    ok(w.Terminal.isActive, "terminal should be back");
    contains(consoleLines().join("\n"), "Game Over! Score: 0");
    eq(run("pwd"), ["/home/emerson"]);
});

// ------------------------------------------------------------------ power

test("power button turns the screen off and reboots into the terminal", async () => {
    const btn = w.document.getElementById("power-btn");
    const screen = w.document.querySelector(".crt-screen");
    btn.click();
    ok(!w.Terminal.isActive, "input disabled while off");
    await waitFor(() => screen.classList.contains("is-off"), 3000, "screen off");
    eq(consoleLines().join(""), "");

    btn.click();
    await waitFor(() => w.Terminal.isActive, 20000, "reboot");
    contains(consoleLines().join("\n"), "I am Emerson Mendes");
    eq(run("pwd"), ["/home/emerson"]);
});

test("power button shows ⏻, its LED is green when on and amber in standby, aria-pressed follows", async () => {
    const btn = w.document.getElementById("power-btn");
    const led = w.document.querySelector(".power-led");
    const ledColor = () => w.getComputedStyle(led).backgroundColor;
    ok(btn.querySelector("svg.power-icon"), "power icon");
    // the whole button is clickable, including the part below the case's edge
    const r = btn.getBoundingClientRect();
    for (const y of [r.top + 3, r.top + r.height / 2, r.bottom - 3]) {
        const hit = w.document.elementFromPoint(r.left + r.width / 2, y);
        ok(hit === btn, "hit-test at y=" + y.toFixed(1) + " got " + (hit && (hit.className || hit.tagName)));
    }
    eq(btn.getAttribute("aria-pressed"), "true");
    eq(ledColor(), "rgb(0, 255, 0)");

    btn.click();
    eq(btn.getAttribute("aria-pressed"), "false");
    eq(ledColor(), "rgb(255, 160, 0)");
    await waitFor(() => !w.Power.busy, 3000, "power off");

    btn.click();
    eq(btn.getAttribute("aria-pressed"), "true");
    eq(ledColor(), "rgb(0, 255, 0)");
    await waitFor(() => w.Terminal.isActive, 20000, "reboot");
});

// ----------------------------------------------------------------- mobile

test("mobile: the native input is mirrored into the terminal and runs commands", async () => {
    await setViewport(400);
    try {
        ok(w.MobileTerm.useMobileCapture(), "should be in mobile mode");
        const inp = w.document.getElementById("terminal-mobile-input");
        const fire = (type) => inp.dispatchEvent(new w.Event(type, { bubbles: true }));

        inp.value = "pw";
        inp.setSelectionRange(2, 2);
        fire("input");
        eq(line(), "pw|");

        inp.setSelectionRange(1, 1);
        fire("keyup");
        eq(line(), "p|w", "caret position is mirrored");

        inp.value = "pwd";
        inp.setSelectionRange(3, 3);
        fire("input");
        key(KEY.ENTER, { target: inp });
        contains(consoleLines().slice(-2)[0], "/home/emerson");
        eq(inp.value, "");

        key(KEY.UP, { target: inp });
        eq(inp.value, "pwd", "history fills the native input");
        eq(line(), "pwd|");
    } finally {
        await setViewport(1000);
    }
});
