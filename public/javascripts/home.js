const loginScreen = document.getElementById("login-screen");
const loginBtn = document.getElementById("login-btn");
const passwordInput = document.getElementById("password-input");
const loginError = document.getElementById("login-error");
const statusEl = document.getElementById("status");

let term, fitAddon;

function initTerminal(token) {
    loginScreen.style.display = "none";

    term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: '"Cascadia Code", "Fira Code", monospace',
        theme: {
            background: "#1e1e2e", foreground: "#cdd6f4",
            cursor: "#f5c2e7", selectionBackground: "#45475a",
            black: "#45475a", red: "#f38ba8",
            green: "#a6e3a1", yellow: "#f9e2af",
            blue: "#89b4fa", magenta: "#f5c2e7",
            cyan: "#94e2d5", white: "#bac2de",
        },
    });

    fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(document.getElementById("terminal-container"));
    requestAnimationFrame(() => {
        fitAddon.fit();

        const ws = new WebSocket(`wss://${location.host}?token=${token}`);

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

        term.onData((data) => {
            if (ws.readyState === WebSocket.OPEN)
                ws.send(JSON.stringify({ type: "input", data }));
        });

        window.addEventListener("resize", () => {
            fitAddon.fit();
            if (ws.readyState === WebSocket.OPEN)
                ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        });
    });
}

async function login() {
    const password = passwordInput.value;
    if (!password) return;

    loginBtn.disabled = true;
    loginError.textContent = "";

    try {
        const res = await fetch("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Login failed");

        initTerminal(data.token);
    } catch (err) {
        loginError.textContent = err.message;
        loginBtn.disabled = false;
    }
}

loginBtn.addEventListener("click", login);
passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") login();
});