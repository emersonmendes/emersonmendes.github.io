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
            var $screen = $(".crt-content");
            if ($screen.length > 0) {
                $screen.scrollTop($screen[0].scrollHeight);
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
    prompt: "<span id='a'>root@emersonmendes</span>:<span id='b'>~</span><span id='c'>$</span> ",
    isActive: false,
    history: [],
    historyIndex: -1,

    init: function () {
        Terminal.isActive = true;
        console.log("Terminal initialized, isActive:", Terminal.isActive);
        $("#console").append("<br/>" + Terminal.prompt + "<span id='cmd-input'></span><span id='cursor'>|</span>");
        Terminal.attachEvents();
        Terminal.scrollToBottom();
        if (Typer.accessCountimer) {
            clearInterval(Typer.accessCountimer); // Stop the old cursor blinker
        }
        setInterval(Terminal.blinkCursor, 500); // Start new cursor blinker
    },

    attachEvents: function () {
        console.log("Attaching terminal events...");
        $(document).unbind("keydown").unbind("keypress"); // Remove all previous handlers (jQuery 1.4.2 compatible)
        
        // Handle special keys with keydown
        $(document).bind("keydown", function (e) {
            console.log("keydown event, isActive:", Terminal.isActive, "key:", e.which || e.keyCode);
            if (!Terminal.isActive) return;
            
            var key = e.which || e.keyCode;
            
            if (key == 13) { // Enter
                e.preventDefault();
                Terminal.processCommand();
            } else if (key == 8) { // Backspace
                e.preventDefault();
                Terminal.input = Terminal.input.slice(0, -1);
                Terminal.updateInputDisplay();
            }
        });
        
        // Handle printable characters with keypress (better for getting actual char)
        $(document).bind("keypress", function (e) {
            console.log("keypress event, isActive:", Terminal.isActive, "key:", e.which || e.keyCode);
            if (!Terminal.isActive) return;
            
            var key = e.which || e.keyCode;
            if (key >= 32) { // Printable characters
                var char = String.fromCharCode(key);
                Terminal.input += char;
                Terminal.updateInputDisplay();
                e.preventDefault();
            }
        });
    },

    updateInputDisplay: function () {
        $("#cmd-input").text(Terminal.input);
        Terminal.scrollToBottom();
    },

    scrollToBottom: function() {
         var $screen = $(".crt-content");
         if ($screen.length > 0) {
             $screen.scrollTop($screen[0].scrollHeight);
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
        $("#cursor").remove(); // Remove cursor before adding new line
        $("#console").append("<br/>"); // Move to next line after command
        
        if (cmd === "") {
            // Do nothing, just new prompt
        } else if (cmd === "snake") {
            Snake.start();
            Terminal.input = "";
            return; // Snake takes over
        } else if (cmd === "clear") {
             $("#console").html("");
        } else {
            $("#console").append("Command not found: " + cmd + "<br/>");
        }

        Terminal.input = "";
        $("#console").append(Terminal.prompt + "<span id='cmd-input'></span><span id='cursor'>|</span>");
        Terminal.scrollToBottom();
    }
};

var Snake = {
    isActive: false,
    width: 20,
    height: 20,
    grid: [],
    snake: [],
    direction: "right",
    food: null,
    interval: null,
    score: 0,

    start: function () {
        Terminal.isActive = false; // Disable terminal input
        Snake.isActive = true;
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
Typer.init();

var timer = setInterval("t();", 30);
function t() {
    Typer.addText({ "keyCode": 123748 });

    if (Typer.index > Typer.text.length) {
        clearInterval(timer);
        Terminal.init(); // Start terminal after typing is done
    }
}