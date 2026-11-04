/** Syncs the on-screen scrollbar thumb with #crt-content and supports drag-to-scroll */
/** Captura de teclado virtual em viewports estreitos: input nativo + espelho em Terminal.input */
var MobileTerm = {
    crtTapBound: false,

    useMobileCapture: function () {
        try {
            return window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
        } catch (e) {
            return false;
        }
    },

    el: function () {
        return document.getElementById("terminal-mobile-input");
    },

    clear: function () {
        var inp = MobileTerm.el();
        if (inp) inp.value = "";
    },

    syncBodyClass: function () {
        if (!document.body) return;
        if (MobileTerm.useMobileCapture() && Terminal.isActive && !Snake.isActive) {
            document.body.classList.add("mobile-term-active");
        } else {
            document.body.classList.remove("mobile-term-active");
        }
    },

    bindCrtTapToFocus: function () {
        if (MobileTerm.crtTapBound) return;
        MobileTerm.crtTapBound = true;
        var focusKb = function () {
            if (!MobileTerm.useMobileCapture() || !Terminal.isActive || Snake.isActive) return;
            var inp = MobileTerm.el();
            if (inp) inp.focus();
        };
        $("#crt-content").bind("click", focusKb).bind("touchend", focusKb);
    },

    attachInputHandlers: function () {
        var $inp = $("#terminal-mobile-input");
        $inp.unbind("input.mobileterm keydown.mobileterm keyup.mobileterm click.mobileterm");
        // The native input does the editing; mirror its value and caret into the terminal
        $inp.bind("input.mobileterm keyup.mobileterm click.mobileterm", function () {
            if (!Terminal.isActive) return;
            var el = $inp[0];
            Terminal.input = el.value || "";
            Terminal.cursorPos = typeof el.selectionStart === "number" ? el.selectionStart : Terminal.input.length;
            Terminal.updateInputDisplay();
        });
        $inp.bind("keydown.mobileterm", function (e) {
            if (!Terminal.isActive) return;
            var key = e.which || e.keyCode;
            if (key === 13) {
                e.preventDefault();
                Terminal.processCommand();
            } else if (key === 9) {
                e.preventDefault();
                Terminal.complete();
            } else if (key === 38) {
                e.preventDefault();
                Terminal.historyUp();
            } else if (key === 40) {
                e.preventDefault();
                Terminal.historyDown();
            }
        });
    },

    detach: function () {
        $("#terminal-mobile-input").unbind(".mobileterm");
        MobileTerm.clear();
    }
};

var CrtScroll = {
    dragging: false,
    dragStartY: 0,
    dragStartScroll: 0,

    el: function () {
        return document.getElementById("crt-content");
    },

    update: function () {
        var content = $("#crt-content");
        var track = $(".crt-scrollbar-track");
        var thumb = $("#crt-scrollbar-thumb");
        var wrap = $("#crt-scrollbar");
        if (!content.length || !track.length || !thumb.length) return;

        var el = content[0];
        var sh = el.scrollHeight;
        var ch = el.clientHeight;
        var trackH = track.height();
        if (trackH < 1) return;

        if (sh <= ch) {
            wrap.addClass("is-hidden");
            thumb.css({ top: 0, height: Math.max(trackH - 2, 24) });
            return;
        }
        wrap.removeClass("is-hidden");
        var ratio = ch / sh;
        var thumbH = Math.max(Math.floor(trackH * ratio), 24);
        var maxTop = Math.max(trackH - thumbH, 0);
        var maxScroll = sh - ch;
        var scrollRatio = maxScroll > 0 ? el.scrollTop / maxScroll : 0;
        var top = Math.round(scrollRatio * maxTop);
        thumb.css({ height: thumbH, top: top });
    },

    init: function () {
        var self = this;
        var $content = $("#crt-content");
        var $thumb = $("#crt-scrollbar-thumb");
        var $track = $(".crt-scrollbar-track");

        $content.bind("scroll", function () {
            self.update();
        });

        $(window).bind("resize", function () {
            self.update();
        });

        $thumb.bind("mousedown", function (e) {
            e.preventDefault();
            var el = self.el();
            if (!el || el.scrollHeight <= el.clientHeight) return;
            self.dragging = true;
            self.dragStartY = e.pageY;
            self.dragStartScroll = el.scrollTop;
            $(document).bind("mousemove.crtscr", function (ev) {
                if (!self.dragging) return;
                var c = self.el();
                var tr = $(".crt-scrollbar-track");
                if (!c || !tr.length) return;
                var trackH = tr.height();
                var th = $thumb.outerHeight() || 24;
                var maxTop = Math.max(trackH - th, 0);
                var maxScroll = c.scrollHeight - c.clientHeight;
                if (maxTop < 1 || maxScroll < 1) return;
                var dy = ev.pageY - self.dragStartY;
                var dScroll = (dy / maxTop) * maxScroll;
                c.scrollTop = self.dragStartScroll + dScroll;
            });
            $(document).bind("mouseup.crtscr", function () {
                self.dragging = false;
                $(document).unbind(".crtscr");
            });
        });

        $track.bind("click", function (e) {
            if ($(e.target).closest(".crt-scrollbar-thumb").length) return;
            var el = self.el();
            var tr = $track;
            if (!el || el.scrollHeight <= el.clientHeight) return;
            var offset = tr.offset();
            var y = e.pageY - offset.top;
            var trackH = tr.height();
            var th = $thumb.outerHeight() || 24;
            var maxTop = Math.max(trackH - th, 0);
            var maxScroll = el.scrollHeight - el.clientHeight;
            var targetTop = Math.max(0, Math.min(y - th / 2, maxTop));
            el.scrollTop = maxTop > 0 ? (targetTop / maxTop) * maxScroll : 0;
            self.update();
        });

        var consoleEl = document.getElementById("console");
        if (consoleEl && window.MutationObserver) {
            var obs = new MutationObserver(function () {
                self.update();
            });
            obs.observe(consoleEl, { childList: true, subtree: true, characterData: true });
        } else {
            setInterval(function () {
                self.update();
            }, 500);
        }

        setTimeout(function () {
            self.update();
        }, 0);
    }
};

var Typer = {
    text: null,
    accessCountimer: null,
    index: 0,
    speed: 2,
    file: "emerson.txt",
    init: function () {
        $.get(Typer.file, function (data) {
            Typer.text = data;
            Typer.text = Typer.text.slice(0, Typer.text.length - 1);
        });
    },

    content: function () {
        return $("#console").html();
    },

    write: function (str) {
        $("#console").append(str);
        return false;
    },

    addText: function (key) {
        if (Typer.text) {
            var cont = Typer.content();
            if (cont.substring(cont.length - 1, cont.length) == "|")
                $("#console").html($("#console").html().substring(0, cont.length - 1));
            
            Typer.index += Typer.speed;
            var text = Typer.text.substring(0, Typer.index)
            var rtn = new RegExp("\n", "g");

            $("#console").html(text.replace(rtn, "<br/>"));
            var $screen = $("#crt-content");
            if ($screen.length > 0) {
                $screen.scrollTop($screen[0].scrollHeight);
                CrtScroll.update();
            } else {
                window.scrollBy(0, 50);
            }
        }
    },

    updLstChr: function () {
        var cont = this.content();
        if (cont.substring(cont.length - 1, cont.length) == "|")
            $("#console").html($("#console").html().substring(0, cont.length - 1));
        else
            this.write("|");
    }
};

var Terminal = {
    input: "",
    /** Virtual cwd; only /, /home, and /home/emerson exist. */
    path: ["home", "emerson"],
    isActive: false,
    history: [],
    /** Position while browsing history with arrows; -1 = editing a new line. */
    historyIndex: -1,
    /** What was typed before starting to browse history, restored by ArrowDown. */
    historyDraft: "",
    /** Cursor position inside `input` (0..input.length). */
    cursorPos: 0,
    cursorTimer: null,

    historyUp: function () {
        var h = Terminal.history;
        if (!h.length) return;
        if (Terminal.historyIndex === -1) {
            Terminal.historyDraft = Terminal.input;
            Terminal.historyIndex = h.length - 1;
        } else if (Terminal.historyIndex > 0) {
            Terminal.historyIndex--;
        }
        Terminal.setInput(h[Terminal.historyIndex]);
    },

    historyDown: function () {
        if (Terminal.historyIndex === -1) return;
        Terminal.historyIndex++;
        if (Terminal.historyIndex >= Terminal.history.length) {
            Terminal.historyIndex = -1;
            Terminal.setInput(Terminal.historyDraft);
        } else {
            Terminal.setInput(Terminal.history[Terminal.historyIndex]);
        }
    },

    getWdDisplay: function () {
        var p = Terminal.path;
        if (p.length === 2 && p[0] === "home" && p[1] === "emerson") return "~";
        if (p.length === 0) return "/";
        return "/" + p.join("/");
    },

    getPromptHtml: function () {
        return (
            "<span class='term-host'>root@emersonmendes</span>:<span class='term-wd'>" +
            Terminal.getWdDisplay() +
            "</span><span class='term-dollar'>$</span> "
        );
    },

    pathToSegments: function (absPath) {
        var s = absPath.replace(/\/+$/, "");
        if (!s || s === "/") return [];
        return s.split("/").filter(function (x) {
            return x.length > 0;
        });
    },

    normalizeSegments: function (segments) {
        var stack = [];
        for (var i = 0; i < segments.length; i++) {
            var part = segments[i];
            if (part === "..") {
                if (stack.length) stack.pop();
            } else if (part !== "." && part !== "") stack.push(part);
        }
        return stack;
    },

    isValidPath: function (segments) {
        if (segments.length === 0) return true;
        if (segments.length === 1 && segments[0] === "home") return true;
        if (segments.length === 2 && segments[0] === "home" && segments[1] === "emerson") return true;
        return false;
    },

    /** Entries of a directory in the virtual FS, or null if it doesn't exist. */
    listDirAt: function (segments) {
        if (segments.length === 0) return [{ name: "home", dir: true }];
        if (segments.length === 1 && segments[0] === "home") return [{ name: "emerson", dir: true }];
        if (segments.length === 2 && segments[0] === "home" && segments[1] === "emerson") return [{ name: "emerson.txt", dir: false }];
        return null;
    },

    listDir: function () {
        return (Terminal.listDirAt(Terminal.path) || []).map(function (e) {
            return e.name;
        });
    },

    /** Absolute or cwd-relative path string -> normalized segments. */
    resolvePath: function (arg) {
        if (arg.charAt(0) === "/") return Terminal.normalizeSegments(Terminal.pathToSegments(arg));
        return Terminal.normalizeSegments(Terminal.path.concat(arg.split("/")));
    },

    isEmersonFile: function (segments) {
        return segments.length === 3 && segments[0] === "home" && segments[1] === "emerson" && segments[2] === "emerson.txt";
    },

    /** Replaces the whole line and puts the cursor at its end. */
    setInput: function (value) {
        Terminal.input = value;
        Terminal.cursorPos = value.length;
        var inp = MobileTerm.el();
        if (inp && MobileTerm.useMobileCapture()) {
            inp.value = value;
            try {
                inp.setSelectionRange(value.length, value.length);
            } catch (e) {}
        }
        Terminal.updateInputDisplay();
    },

    insertText: function (str) {
        var p = Terminal.cursorPos;
        Terminal.input = Terminal.input.slice(0, p) + str + Terminal.input.slice(p);
        Terminal.cursorPos = p + str.length;
        Terminal.updateInputDisplay();
    },

    /** Backspace (dir = -1) or Delete (dir = 1) relative to the cursor. */
    deleteChar: function (dir) {
        var p = Terminal.cursorPos;
        if (dir < 0) {
            if (p === 0) return;
            Terminal.input = Terminal.input.slice(0, p - 1) + Terminal.input.slice(p);
            Terminal.cursorPos = p - 1;
        } else {
            if (p >= Terminal.input.length) return;
            Terminal.input = Terminal.input.slice(0, p) + Terminal.input.slice(p + 1);
        }
        Terminal.updateInputDisplay();
    },

    moveCursorTo: function (pos) {
        Terminal.cursorPos = Math.max(0, Math.min(pos, Terminal.input.length));
        Terminal.updateInputDisplay();
    },

    /** Markup of an empty, editable input line (text before cursor, cursor, text after). */
    inputLineHtml: function () {
        return "<span id='cmd-input'></span><span id='cursor'>|</span><span id='cmd-after'></span>";
    },

    removeInputLine: function () {
        $("#cmd-input").remove();
        $("#cursor").remove();
        $("#cmd-after").remove();
    },

    /** Tab completion of the last argument of cd/cat/rm against the virtual FS. */
    complete: function () {
        var input = Terminal.input;
        var start = input.search(/\S*$/);
        var head = input.slice(0, start);
        if (!head.trim()) return; // still typing the command name
        var cmd = head.trim().split(/\s+/)[0].toLowerCase();
        if (cmd !== "cd" && cmd !== "cat" && cmd !== "rm") return;

        var partial = input.slice(start);
        var slash = partial.lastIndexOf("/");
        var dirPart = partial.slice(0, slash + 1);
        var base = partial.slice(slash + 1);
        var entries = Terminal.listDirAt(dirPart ? Terminal.resolvePath(dirPart) : Terminal.path);
        if (!entries) return;

        var matches = entries.filter(function (e) {
            return e.name.indexOf(base) === 0 && (cmd !== "cd" || e.dir);
        });
        if (!matches.length) return;

        if (matches.length === 1) {
            var only = matches[0];
            Terminal.setInput(head + dirPart + only.name + (only.dir ? "/" : " "));
            return;
        }

        var names = matches.map(function (e) {
            return e.name;
        });
        var prefix = names.reduce(function (acc, n) {
            var i = 0;
            while (i < acc.length && acc.charAt(i) === n.charAt(i)) i++;
            return acc.slice(0, i);
        });
        if (prefix.length > base.length) {
            Terminal.setInput(head + dirPart + prefix);
            return;
        }

        // Ambiguous: list the candidates and redraw the prompt with the same input
        Terminal.removeInputLine();
        $("#console").append(
            $("<span/>").text(input).html() + "<br/>" + names.join("  ") + "<br/>" +
            Terminal.getPromptHtml() + Terminal.inputLineHtml()
        );
        Terminal.updateInputDisplay();
    },

    catEmersonContent: function () {
        if (!Typer.text) {
            $("#console").append("cat: emerson.txt: file not ready<br/>");
            return;
        }
        var body = Typer.text.replace(/\n/g, "<br/>");
        $("#console").append(body + "<br/>");
    },

    isProtectedEmersonRm: function (arg) {
        return Terminal.isEmersonFile(Terminal.resolvePath(arg));
    },

    init: function () {
        Terminal.isActive = true;
        console.log("Terminal initialized, isActive:", Terminal.isActive);
        Terminal.input = "";
        Terminal.cursorPos = 0;
        $("#console").append("<br/>" + Terminal.getPromptHtml() + Terminal.inputLineHtml());
        MobileTerm.clear();
        MobileTerm.syncBodyClass();
        MobileTerm.bindCrtTapToFocus();
        Terminal.attachEvents();
        Terminal.scrollToBottom();
        if (Typer.accessCountimer) {
            clearInterval(Typer.accessCountimer); // Stop the old cursor blinker
        }
        if (Terminal.cursorTimer) {
            clearInterval(Terminal.cursorTimer);
        }
        Terminal.cursorTimer = setInterval(Terminal.blinkCursor, 500); // Start new cursor blinker
        CrtScroll.update();
        if (MobileTerm.useMobileCapture()) {
            setTimeout(function () {
                var inp = MobileTerm.el();
                if (inp && Terminal.isActive && !Snake.isActive) inp.focus();
            }, 400);
        }
    },

    attachEvents: function () {
        console.log("Attaching terminal events...");
        $(document).unbind("keydown").unbind("keypress");
        MobileTerm.detach();

        if (MobileTerm.useMobileCapture()) {
            MobileTerm.attachInputHandlers();
            return;
        }

        $(document).bind("keydown", function (e) {
            console.log("keydown event, isActive:", Terminal.isActive, "key:", e.which || e.keyCode);
            if (!Terminal.isActive) return;

            var key = e.which || e.keyCode;

            // (jQuery 1.4 copies ctrlKey into metaKey, so don't test metaKey here)
            if (e.ctrlKey && !e.altKey && (key == 65 || key == 69)) {
                // Ctrl+A / Ctrl+E: start / end of line, like bash
                e.preventDefault();
                Terminal.moveCursorTo(key == 65 ? 0 : Terminal.input.length);
            } else if (key == 13) {
                e.preventDefault();
                Terminal.processCommand();
            } else if (key == 8) {
                e.preventDefault();
                Terminal.deleteChar(-1);
            } else if (key == 46) {
                e.preventDefault();
                Terminal.deleteChar(1);
            } else if (key == 37) {
                e.preventDefault();
                Terminal.moveCursorTo(Terminal.cursorPos - 1);
            } else if (key == 39) {
                e.preventDefault();
                Terminal.moveCursorTo(Terminal.cursorPos + 1);
            } else if (key == 36) {
                e.preventDefault();
                Terminal.moveCursorTo(0);
            } else if (key == 35) {
                e.preventDefault();
                Terminal.moveCursorTo(Terminal.input.length);
            } else if (key == 9) {
                e.preventDefault();
                Terminal.complete();
            } else if (key == 38) {
                e.preventDefault();
                Terminal.historyUp();
            } else if (key == 40) {
                e.preventDefault();
                Terminal.historyDown();
            }
        });

        $(document).bind("keypress", function (e) {
            console.log("keypress event, isActive:", Terminal.isActive, "key:", e.which || e.keyCode);
            if (!Terminal.isActive) return;

            var key = e.which || e.keyCode;
            if (key >= 32) {
                Terminal.insertText(String.fromCharCode(key));
                e.preventDefault();
            }
        });
    },

    updateInputDisplay: function () {
        var p = Math.max(0, Math.min(Terminal.cursorPos, Terminal.input.length));
        Terminal.cursorPos = p;
        $("#cmd-input").text(Terminal.input.slice(0, p));
        $("#cmd-after").text(Terminal.input.slice(p));
        Terminal.scrollToBottom();
    },

    scrollToBottom: function() {
         var $screen = $("#crt-content");
         if ($screen.length > 0) {
             $screen.scrollTop($screen[0].scrollHeight);
             CrtScroll.update();
         }
    },

    blinkCursor: function() {
        var cursor = $("#cursor");
        if (cursor.css("visibility") === "visible") {
            cursor.css("visibility", "hidden");
        } else {
            cursor.css("visibility", "visible");
        }
    },

    processCommand: function () {
        var cmd = Terminal.input.trim();

        if (cmd && cmd !== Terminal.history[Terminal.history.length - 1]) {
            Terminal.history.push(cmd);
        }
        Terminal.historyIndex = -1;
        Terminal.historyDraft = "";

        Terminal.removeInputLine();

        $("#console").append(cmd + "<br/>");

        var tokens = cmd.length ? cmd.split(/\s+/) : [];
        var name = tokens.length ? tokens[0].toLowerCase() : "";

        if (cmd === "") {
        } else if (name === "help") {
            $("#console").append("<br/>");
            $("#console").append("<span style='color: #0bc;'>Available commands:</span><br/><br/>");
            $("#console").append("<span style='color: #0f0;'>cd</span> - Change directory (try <span style='color:#0f0'>cd ..</span>)<br/>");
            $("#console").append("<span style='color: #0f0;'>pwd</span> - Print the current directory<br/>");
            $("#console").append("<span style='color: #0f0;'>ls</span> - List directory contents<br/>");
            $("#console").append("<span style='color: #0f0;'>cat</span> - Print a file (e.g. <span style='color:#0f0'>cat emerson.txt</span>)<br/>");
            $("#console").append("<span style='color: #0f0;'>rm</span> - Remove a file<br/>");
            $("#console").append("<span style='color: #0f0;'>snake</span> - Start the classic snake game<br/>");
            $("#console").append("<span style='color: #0f0;'>clear</span> - Clear the terminal screen<br/>");
            $("#console").append("<span style='color: #0f0;'>help</span> - Show this help<br/>");
            $("#console").append("<br/>Press <span style='color: #0f0;'>Tab</span> to complete file and directory names.<br/>");
            $("#console").append("Use <span style='color: #0f0;'>&uarr;</span>/<span style='color: #0f0;'>&darr;</span> to browse previous commands.<br/>");
            $("#console").append("<br/>");
        } else if (name === "cd") {
            var arg = (tokens.slice(1).join(" ") || "").replace(/^["']|["']$/g, "");
            if (!arg || arg === "~") {
                Terminal.path = ["home", "emerson"];
            } else if (arg === "..") {
                if (Terminal.path.length > 0) Terminal.path.pop();
            } else if (arg === ".") {
            } else {
                var target = Terminal.resolvePath(arg);
                if (Terminal.isValidPath(target)) {
                    Terminal.path = target;
                } else {
                    $("#console").append("cd: " + arg + ": No such file or directory<br/>");
                }
            }
        } else if (name === "pwd") {
            $("#console").append("/" + Terminal.path.join("/") + "<br/>");
        } else if (name === "ls") {
            if (tokens.length > 1) {
                $("#console").append("ls: too many arguments<br/>");
            } else {
                var names = Terminal.listDir();
                $("#console").append(names.join("  ") + "<br/>");
            }
        } else if (name === "cat") {
            var file = tokens.slice(1).join(" ").replace(/^["']|["']$/g, "");
            if (!file) {
                $("#console").append("cat: missing file operand<br/>");
            } else {
                var fileSegs = Terminal.resolvePath(file);
                if (Terminal.isEmersonFile(fileSegs)) {
                    Terminal.catEmersonContent();
                } else if (Terminal.isValidPath(fileSegs)) {
                    $("#console").append("cat: " + file + ": Is a directory<br/>");
                } else {
                    $("#console").append("cat: " + file + ": No such file or directory<br/>");
                }
            }
        } else if (name === "rm") {
            var targetFile = tokens.slice(1).join(" ").replace(/^["']|["']$/g, "");
            if (!targetFile) {
                $("#console").append("rm: missing operand<br/>");
            } else if (Terminal.isProtectedEmersonRm(targetFile)) {
                $("#console").append('Nice try, but this file is unremovable.<br/>');
            } else if (Terminal.isValidPath(Terminal.resolvePath(targetFile))) {
                $("#console").append("rm: cannot remove '" + targetFile + "': Is a directory<br/>");
            } else {
                $("#console").append("rm: cannot remove '" + targetFile + "': No such file or directory<br/>");
            }
        } else if (name === "snake") {
            Snake.start();
            Terminal.input = "";
            MobileTerm.clear();
            return;
        } else if (name === "clear") {
            $("#console").html("");
        } else {
            $("#console").append("Command not found: " + cmd + "<br/>");
            $("#console").append("Type 'help' for available commands.<br/>");
        }

        Terminal.input = "";
        Terminal.cursorPos = 0;
        MobileTerm.clear();
        $("#console").append(Terminal.getPromptHtml() + Terminal.inputLineHtml());
        Terminal.scrollToBottom();
    }
};

var Snake = {
    isActive: false,
    width: 25,
    height: 18,
    grid: [],
    snake: [],
    direction: "right",
    food: null,
    interval: null,
    score: 0,

    start: function () {
        Terminal.isActive = false; // Disable terminal input
        Snake.isActive = true;
        MobileTerm.detach();
        if (document.body) document.body.classList.add("mobile-snake");
        $(".crt-inner").addClass("crt-snake-mode");
        var $crt = $("#crt-content");
        if ($crt.length) {
            $crt[0].scrollTop = 0;
        }
        $("#console").html(""); // Clear console for game
        $("#console").append("<div id='snake-game'></div><div id='snake-score'>Score: 0</div><div id='snake-controls'>Controls: Arrow Keys | ESC to exit</div>");
        
        Snake.initGrid();
        Snake.snake = [{x: 5, y: 5}, {x: 4, y: 5}, {x: 3, y: 5}];
        Snake.direction = "right";
        Snake.score = 0;
        Snake.placeFood();
        
        Snake.render();
        Snake.interval = setInterval(Snake.loop, 150);
        
        $(document).unbind("keydown").unbind("keypress");
        $(document).bind("keydown", function(e) {
            Snake.handleInput(e);
        });
    },

    end: function () {
        clearInterval(Snake.interval);
        Snake.isActive = false;
        if (document.body) document.body.classList.remove("mobile-snake");
        $(".crt-inner").removeClass("crt-snake-mode");
        $("#console").html("Game Over! Score: " + Snake.score + "<br/><br/>");
        Terminal.init(); // Return to terminal
    },

    initGrid: function() {
        // We will render using ASCII or pre-blocks
        // Actually simple text based grid is easier to handle in this pre-existing structure
        // Let's try to make it visual with characters
    },

    placeFood: function() {
        var valid = false;
        while (!valid) {
            var x = Math.floor(Math.random() * Snake.width);
            var y = Math.floor(Math.random() * Snake.height);
            valid = true;
            for (var i = 0; i < Snake.snake.length; i++) {
                if (Snake.snake[i].x === x && Snake.snake[i].y === y) {
                    valid = false;
                    break;
                }
            }
            if (valid) {
                Snake.food = {x: x, y: y};
            }
        }
    },

    loop: function() {
        var head = {x: Snake.snake[0].x, y: Snake.snake[0].y};
        
        if (Snake.direction === "right") head.x++;
        else if (Snake.direction === "left") head.x--;
        else if (Snake.direction === "up") head.y--;
        else if (Snake.direction === "down") head.y++;

        // Check collision
        if (head.x < 0 || head.x >= Snake.width || head.y < 0 || head.y >= Snake.height || Snake.checkSelfCollision(head)) {
            Snake.end();
            return;
        }

        Snake.snake.unshift(head);

        if (head.x === Snake.food.x && head.y === Snake.food.y) {
            Snake.score++;
            $("#snake-score").text("Score: " + Snake.score);
            Snake.placeFood();
        } else {
            Snake.snake.pop();
        }

        Snake.render();
    },

    checkSelfCollision: function(head) {
        for (var i = 0; i < Snake.snake.length; i++) {
            if (Snake.snake[i].x === head.x && Snake.snake[i].y === head.y) {
                return true;
            }
        }
        return false;
    },

    handleInput: function(e) {
        if (!Snake.isActive) return;
        
        var key = e.which || e.keyCode;
        
        if (key === 27) { // ESC
            Snake.end();
            return;
        }
        
        if (key === 37 && Snake.direction !== "right") Snake.direction = "left";
        else if (key === 38 && Snake.direction !== "down") Snake.direction = "up";
        else if (key === 39 && Snake.direction !== "left") Snake.direction = "right";
        else if (key === 40 && Snake.direction !== "up") Snake.direction = "down";
    },

    render: function() {
        var output = "";
        // Top border
        output += "+";
        for(var i=0; i<Snake.width; i++) output += "--";
        output += "+<br/>";

        for (var y = 0; y < Snake.height; y++) {
            output += "|";
            for (var x = 0; x < Snake.width; x++) {
                var isSnake = false;
                for (var s = 0; s < Snake.snake.length; s++) {
                    if (Snake.snake[s].x === x && Snake.snake[s].y === y) {
                        isSnake = true;
                        break;
                    }
                }
                
                if (isSnake) output += "<span class='snake-body'>[]</span>";
                else if (Snake.food && Snake.food.x === x && Snake.food.y === y) output += "<span class='snake-food'>()</span>";
                else output += "&nbsp;&nbsp;"; // 2 spaces for aspect ratio
            }
            output += "|<br/>";
        }
        
        // Bottom border
        output += "+";
        for(var i=0; i<Snake.width; i++) output += "--";
        output += "+";

        $("#snake-game").html(output);
    }
};

/** Boot sequence: types emerson.txt then starts the terminal. Restartable by Power. */
var Boot = {
    timer: null,

    start: function () {
        Boot.stop();
        Typer.index = 0;
        Terminal.isActive = false;
        Terminal.input = "";
        Terminal.path = ["home", "emerson"];
        $("#console").html("");
        Typer.accessCountimer = setInterval(function () {
            Typer.updLstChr();
        }, 500);
        Boot.timer = setInterval(function () {
            Typer.addText();
            if (Typer.text && Typer.index > Typer.text.length) {
                clearInterval(Boot.timer);
                Boot.timer = null;
                Terminal.init(); // Start terminal after typing is done
            }
        }, 30);
    },

    stop: function () {
        if (Boot.timer) {
            clearInterval(Boot.timer);
            Boot.timer = null;
        }
        if (Typer.accessCountimer) {
            clearInterval(Typer.accessCountimer);
            Typer.accessCountimer = null;
        }
        if (Terminal.cursorTimer) {
            clearInterval(Terminal.cursorTimer);
            Terminal.cursorTimer = null;
        }
    }
};

/** Monitor power button: CRT turn-off effect; turning back on replays the boot. */
var Power = {
    isOn: true,
    busy: false,
    OFF_MS: 550,
    ON_MS: 650,

    toggle: function () {
        if (Power.busy) return;
        if (Power.isOn) Power.turnOff();
        else Power.turnOn();
    },

    turnOff: function () {
        Power.busy = true;
        Power.isOn = false;

        if (Snake.isActive) {
            clearInterval(Snake.interval);
            Snake.isActive = false;
            if (document.body) document.body.classList.remove("mobile-snake");
            $(".crt-inner").removeClass("crt-snake-mode");
        }
        Terminal.isActive = false;
        Boot.stop();
        $(document).unbind("keydown").unbind("keypress");
        MobileTerm.detach();
        MobileTerm.syncBodyClass();

        $("#power-btn").removeClass("is-on");
        var $screen = $(".crt-screen");
        $screen.removeClass("powering-on").addClass("powering-off");
        setTimeout(function () {
            $screen.removeClass("powering-off").addClass("is-off");
            $("#console").html("");
            Power.busy = false;
        }, Power.OFF_MS);
    },

    turnOn: function () {
        Power.busy = true;
        Power.isOn = true;

        $("#power-btn").addClass("is-on");
        $("#console").html("");
        var $screen = $(".crt-screen");
        $screen.removeClass("is-off").addClass("powering-on");
        setTimeout(function () {
            $screen.removeClass("powering-on");
            Power.busy = false;
            Boot.start();
        }, Power.ON_MS);
    }
};

Typer.speed = 3;
CrtScroll.init();
Typer.init();
Boot.start();

$("#power-btn").bind("click", function (e) {
    e.stopPropagation();
    this.blur(); // keeping focus would make Enter in the terminal re-trigger the button
    Power.toggle();
});

$(window).bind("resize", function () {
    MobileTerm.syncBodyClass();
    if (Terminal.isActive && !Snake.isActive) {
        Terminal.attachEvents();
    }
});