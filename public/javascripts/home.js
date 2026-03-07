const term = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: '"Cascadia Code", "Fira Code", monospace',
    theme: {
        background: '#1e1e2e', foreground: '#cdd6f4',
        cursor: '#f5c2e7', selectionBackground: '#45475a',
        black: '#45475a', red: '#f38ba8',
        green: '#a6e3a1', yellow: '#f9e2af',
        blue: '#89b4fa', magenta: '#f5c2e7',
        cyan: '#94e2d5', white: '#bac2de',
    },
});

const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);
term.open(document.getElementById("terminal-container"));
fitAddon.fit();

// Use wss:// because the page is served over HTTPS
const ws = new WebSocket(`wss://${location.host}`);
const statusEl = document.getElementById("status");

ws.onopen = () => {
    statusEl.textContent = "● Connected";
    statusEl.style.color = "#a6e3a1";
};

ws.onclose = () => {
    statusEl.textContent = "● Disconnected";
    statusEl.style.color = "#f38ba8";
    term.write("\r\n\x1b[31mConnection closed.\x1b[0m\r\n");
};

ws.onmessage = (event) => {
    const { type, data } = JSON.parse(event.data);
    if (type === "output") term.write(data);
};

// User input → server
term.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }));
    }
});

// Send terminal size on resize
const sendResize = () => {
    fitAddon.fit();
    ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
};
window.addEventListener("resize", sendResize);