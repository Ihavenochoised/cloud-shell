import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { WebSocketServer } from "ws";
import pty from "node-pty";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.static(path.join(__dirname, "public")));

const sslOptions = {
    key: fs.readFileSync("key.pem"),
    cert: fs.readFileSync("cert.pem"),
};

const server = https.createServer(sslOptions, app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
    const shell = process.platform === "win32" ? "cmd.exe" : "bash";

    const ptyProcess = pty.spawn(shell, [], {
        name: "xterm-color",
        cols: 80,
        rows: 24,
        cwd: process.env.HOME,
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
            if (type === "input") {
                ptyProcess.write(data);
            } else if (type === "resize") {
                ptyProcess.resize(cols, rows);
            }
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