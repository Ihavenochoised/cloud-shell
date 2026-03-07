import "dotenv/config";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { WebSocketServer } from "ws";
import pty from "node-pty";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { PASSWORD_HASH, JWT_SECRET } = process.env;
if (!PASSWORD_HASH || !JWT_SECRET) {
    console.error("❌ Missing PASSWORD_HASH or JWT_SECRET in .env");
    process.exit(1);
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- Login endpoint ---
app.post("/auth/login", async (req, res) => {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: "Password required" });

    const valid = await bcrypt.compare(password, PASSWORD_HASH);
    if (!valid) return res.status(401).json({ error: "Invalid password" });

    const token = jwt.sign({}, JWT_SECRET, { expiresIn: "8h" });
    res.json({ token });
});

// --- HTTPS server ---
const server = https.createServer(
    { key: fs.readFileSync("key.pem"), cert: fs.readFileSync("cert.pem") },
    app
);

// --- WebSocket server ---
const wss = new WebSocketServer({ noServer: true });

// Upgrade handler — validate JWT before allowing WS connection
server.on("upgrade", (req, socket, head) => {
  console.log("WS upgrade request URL:", req.url);

    const url = new URL(req.url, `https://${req.headers.host}`);
    const token = url.searchParams.get("token");

  console.log("Token found:", !!token);

    if (!token) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
    }

    try {
        jwt.verify(token, JWT_SECRET);
        console.log("Token valid ✅");
    } catch {
        console.log("Token invalid ❌", e.message);
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
    });
});

wss.on("connection", (ws) => {
    const shell = process.platform === "win32" ? "cmd.exe" : "bash";

    const ptyProcess = pty.spawn(shell, [], {
        name: "xterm-color",
        cols: 80,
        rows: 24,
        cwd: process.env.HOME || process.env.USERPROFILE,
        env: process.env,
    });

    ptyProcess.onData((data) => {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: "output", data }));
        }
    });

    ws.on("message", (msg) => {
        try {
            const { type, data, cols, rows } = JSON.parse(msg);
            if (type === "input") ptyProcess.write(data);
            else if (type === "resize") ptyProcess.resize(cols, rows);
        } catch (e) {
            console.error("Invalid message:", e);
        }
    });

    ws.on("close", () => ptyProcess.kill());
    ptyProcess.onExit(() => ws.close());
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ HTTPS terminal running at https://localhost:${PORT}`);
});