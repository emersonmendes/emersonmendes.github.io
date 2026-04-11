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
        $("#crt-content").bind("click", function () {
            if (!MobileTerm.useMobileCapture() || !Terminal.isActive || Snake.isActive) return;
            var inp = MobileTerm.el();
            if (inp) inp.focus();
        });
    },

    attachInputHandlers: function () {
        var $inp = $("#terminal-mobile-input");
        $inp.unbind("input.mobileterm keydown.mobileterm");
        $inp.bind("input.mobileterm", function () {
            if (!Terminal.isActive) return;
            Terminal.input = $inp.val() || "";
            Terminal.updateInputDisplay();
        });
        $inp.bind("keydown.mobileterm", function (e) {
            if (!Terminal.isActive) return;
            var key = e.which || e.keyCode;
            if (key === 13) {
                e.preventDefault();
                Terminal.processCommand();
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
        Typer.accessCountimer = setInterval(function () {
            Typer.updLstChr();
        }, 500);
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
    historyIndex: -1,

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

    listDir: function () {
        var p = Terminal.path;
        if (p.length === 0) return ["home"];
        if (p.length === 1 && p[0] === "home") return ["emerson"];
        if (p.length === 2 && p[0] === "home" && p[1] === "emerson") return ["emerson.txt"];
        return [];
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
        var a = arg.replace(/^\.\//, "");
        if (a === "/home/emerson/emerson.txt") return true;
        if (a !== "emerson.txt") return false;
        var p = Terminal.path;
        return p.length === 2 && p[0] === "home" && p[1] === "emerson";
    },

    init: function () {
        Terminal.isActive = true;
        console.log("Terminal initialized, isActive:", Terminal.isActive);
        $("#console").append("<br/>" + Terminal.getPromptHtml() + "<span id='cmd-input'></span><span id='cursor'>|</span>");
        MobileTerm.clear();
        MobileTerm.syncBodyClass();
        MobileTerm.bindCrtTapToFocus();
        Terminal.attachEvents();
        Terminal.scrollToBottom();
        if (Typer.accessCountimer) {
            clearInterval(Typer.accessCountimer); // Stop the old cursor blinker
        }
        setInterval(Terminal.blinkCursor, 500); // Start new cursor blinker
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

            if (key == 13) {
                e.preventDefault();
                Terminal.processCommand();
            } else if (key == 8) {
                e.preventDefault();
                Terminal.input = Terminal.input.slice(0, -1);
                Terminal.updateInputDisplay();
            }
        });

        $(document).bind("keypress", function (e) {
            console.log("keypress event, isActive:", Terminal.isActive, "key:", e.which || e.keyCode);
            if (!Terminal.isActive) return;

            var key = e.which || e.keyCode;
            if (key >= 32) {
                var char = String.fromCharCode(key);
                Terminal.input += char;
                Terminal.updateInputDisplay();
                e.preventDefault();
            }
        });
    },

    updateInputDisplay: function () {
        // Always update the LAST occurrence of cmd-input
        var allInputs = $("#cmd-input");
        if (allInputs.length > 0) {
            $(allInputs[allInputs.length - 1]).text(Terminal.input);
        }
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

        $("#cmd-input").remove();
        $("#cursor").remove();

        $("#console").append(cmd + "<br/>");

        var tokens = cmd.length ? cmd.split(/\s+/) : [];
        var name = tokens.length ? tokens[0].toLowerCase() : "";

        if (cmd === "") {
        } else if (name === "help") {
            $("#console").append("<br/>");
            $("#console").append("<span style='color: #0bc;'>Available commands:</span><br/><br/>");
            $("#console").append("<span style='color: #0f0;'>cd</span> - Change directory (try <span style='color:#0f0'>cd ..</span>)<br/>");
            $("#console").append("<span style='color: #0f0;'>ls</span> - List directory contents<br/>");
            $("#console").append("<span style='color: #0f0;'>cat</span> - Print a file (e.g. <span style='color:#0f0'>cat emerson.txt</span>)<br/>");
            $("#console").append("<span style='color: #0f0;'>rm</span> - Remove a file<br/>");
            $("#console").append("<span style='color: #0f0;'>snake</span> - Start the classic snake game<br/>");
            $("#console").append("<span style='color: #0f0;'>clear</span> - Clear the terminal screen<br/>");
            $("#console").append("<span style='color: #0f0;'>help</span> - Show this help<br/>");
            $("#console").append("<br/>");
        } else if (name === "cd") {
            var arg = (tokens.slice(1).join(" ") || "").replace(/^["']|["']$/g, "");
            if (!arg || arg === "~") {
                Terminal.path = ["home", "emerson"];
            } else if (arg === "..") {
                if (Terminal.path.length > 0) Terminal.path.pop();
            } else if (arg === ".") {
            } else {
                var target;
                if (arg.charAt(0) === "/") {
                    target = Terminal.normalizeSegments(Terminal.pathToSegments(arg));
                } else {
                    target = Terminal.normalizeSegments(Terminal.path.concat(arg.split("/")));
                }
                if (Terminal.isValidPath(target)) {
                    Terminal.path = target;
                } else {
                    $("#console").append("cd: " + arg + ": No such file or directory<br/>");
                }
            }
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
            } else if (file !== "emerson.txt") {
                $("#console").append("cat: " + file + ": No such file or directory<br/>");
            } else if (Terminal.path.length === 2 && Terminal.path[0] === "home" && Terminal.path[1] === "emerson") {
                Terminal.catEmersonContent();
            } else {
                $("#console").append("cat: emerson.txt: No such file or directory<br/>");
            }
        } else if (name === "rm") {
            var targetFile = tokens.slice(1).join(" ").replace(/^["']|["']$/g, "");
            if (!targetFile) {
                $("#console").append("rm: missing operand<br/>");
            } else if (Terminal.isProtectedEmersonRm(targetFile)) {
                $("#console").append('Nice try, but this file is unremovable.<br/>');
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
        MobileTerm.clear();
        $("#console").append(Terminal.getPromptHtml() + "<span id='cmd-input'></span><span id='cursor'>|</span>");
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
                
                if (isSnake) output += "[]";
                else if (Snake.food && Snake.food.x === x && Snake.food.y === y) output += "()";
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

Typer.speed = 3;
CrtScroll.init();
Typer.init();

$(window).bind("resize", function () {
    MobileTerm.syncBodyClass();
    if (Terminal.isActive && !Snake.isActive) {
        Terminal.attachEvents();
    }
});

var timer = setInterval("t();", 30);
function t() {
    Typer.addText({ "keyCode": 123748 });

    if (Typer.text && Typer.index > Typer.text.length) {
        clearInterval(timer);
        Terminal.init(); // Start terminal after typing is done
    }
}