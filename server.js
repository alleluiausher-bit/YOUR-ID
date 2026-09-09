const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);

app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.warn("⚠️ DATABASE_URL n'est pas configurée.");
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL
        ? { rejectUnauthorized: false }
        : false
});

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

/* =========================
   OUTILS
========================= */

function generateYourID() {
    const number = Math.floor(100000000 + Math.random() * 900000000);
    return number.toString().replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
}

function generateToken() {
    return crypto.randomBytes(32).toString("hex");
}

async function getUserByYourID(yourId) {
    const result = await pool.query(
        "SELECT * FROM users WHERE your_id = $1",
        [yourId]
    );

    return result.rows[0] || null;
}

/* =========================
   BASE DE DONNÉES
========================= */

async function initDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            your_id VARCHAR(20) UNIQUE NOT NULL,
            username VARCHAR(100) NOT NULL,
            password TEXT NOT NULL,
            profile_photo TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS contacts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            contact_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, contact_id)
        );

        CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            status VARCHAR(20) DEFAULT 'sent',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS calls (
            id SERIAL PRIMARY KEY,
            caller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(20) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    console.log("✅ Base de données YourID prête.");
}

/* =========================
   SESSIONS
========================= */

const sessions = new Map();

/* =========================
   AUTHENTIFICATION
========================= */

function authenticate(req, res, next) {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token || !sessions.has(token)) {
        return res.status(401).json({
            success: false,
            message: "Non authentifié."
        });
    }

    req.user = sessions.get(token);
    next();
}

/* =========================
   INSCRIPTION
========================= */

app.post("/api/register", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Nom d'utilisateur et mot de passe obligatoires."
            });
        }

        if (password.length < 4) {
            return res.status(400).json({
                success: false,
                message: "Le mot de passe doit contenir au moins 4 caractères."
            });
        }

        let yourId;

        do {
            yourId = generateYourID();

            const check = await pool.query(
                "SELECT id FROM users WHERE your_id = $1",
                [yourId]
            );

            if (check.rows.length === 0) break;
        } while (true);

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users
            (your_id, username, password)
            VALUES ($1, $2, $3)
            RETURNING id, your_id, username, profile_photo`,
            [yourId, username.trim(), hashedPassword]
        );

        const user = result.rows[0];

        const token = generateToken();

        sessions.set(token, {
            id: user.id,
            yourId: user.your_id,
            username: user.username
        });

        res.json({
            success: true,
            token,
            user
        });

    } catch (error) {
        console.error("Erreur inscription :", error);

        res.status(500).json({
            success: false,
            message: "Erreur serveur."
        });
    }
});

/* =========================
   CONNEXION
========================= */

app.post("/api/login", async (req, res) => {
    try {
        const { yourId, password } = req.body;

        const user = await getUserByYourID(yourId);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "YourID ou mot de passe incorrect."
            });
        }

        const validPassword = await bcrypt.compare(
            password,
            user.password
        );

        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: "YourID ou mot de passe incorrect."
            });
        }

        const token = generateToken();

        sessions.set(token, {
            id: user.id,
            yourId: user.your_id,
            username: user.username
        });

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                your_id: user.your_id,
                username: user.username,
                profile_photo: user.profile_photo
            }
        });

    } catch (error) {
        console.error("Erreur connexion :", error);

        res.status(500).json({
            success: false,
            message: "Erreur serveur."
        });
    }
});

/* =========================
   PROFIL
========================= */

app.get("/api/me", authenticate, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, your_id, username, profile_photo
             FROM users
             WHERE id = $1`,
            [req.user.id]
        );

        res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Erreur serveur."
        });
    }
});

/* =========================
   CONTACTS
========================= */

app.get("/api/contacts", authenticate, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                u.id,
                u.your_id,
                u.username,
                u.profile_photo
             FROM contacts c
             JOIN users u ON u.id = c.contact_id
             WHERE c.user_id = $1
             ORDER BY u.username`,
            [req.user.id]
        );

        res.json({
            success: true,
            contacts: result.rows
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Impossible de charger les contacts."
        });
    }
});

app.post("/api/contacts", authenticate, async (req, res) => {
    try {
        const { yourId } = req.body;

        const contact = await getUserByYourID(yourId);

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: "Utilisateur introuvable."
            });
        }

        if (contact.id === req.user.id) {
            return res.status(400).json({
                success: false,
                message: "Tu ne peux pas t'ajouter toi-même."
            });
        }

        await pool.query(
            `INSERT INTO contacts (user_id, contact_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [req.user.id, contact.id]
        );

        res.json({
            success: true,
            contact: {
                id: contact.id,
                your_id: contact.your_id,
                username: contact.username,
                profile_photo: contact.profile_photo
            }
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Erreur lors de l'ajout."
        });
    }
});

/* =========================
   HISTORIQUE DES MESSAGES
========================= */

app.get("/api/messages/:yourId", authenticate, async (req, res) => {
    try {
        const otherUser = await getUserByYourID(req.params.yourId);

        if (!otherUser) {
            return res.status(404).json({
                success: false,
                message: "Utilisateur introuvable."
            });
        }

        const result = await pool.query(
            `SELECT
                m.id,
                m.content,
                m.status,
                m.created_at,
                sender.your_id AS sender_your_id,
                receiver.your_id AS receiver_your_id
             FROM messages m
             JOIN users sender ON sender.id = m.sender_id
             JOIN users receiver ON receiver.id = m.receiver_id
             WHERE
                (m.sender_id = $1 AND m.receiver_id = $2)
                OR
                (m.sender_id = $2 AND m.receiver_id = $1)
             ORDER BY m.created_at ASC`,
            [req.user.id, otherUser.id]
        );

        res.json({
            success: true,
            messages: result.rows
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Impossible de charger les messages."
        });
    }
});

/* =========================
   SOCKET.IO
========================= */

const connectedUsers = new Map();

io.on("connection", (socket) => {

    console.log("🔌 Connexion :", socket.id);

    /* Connexion d'un utilisateur */

    socket.on("register-socket", async (data) => {
        try {
            const user = await getUserByYourID(data.yourId);

            if (!user) return;

            socket.yourId = user.your_id;
            socket.userId = user.id;

            connectedUsers.set(user.your_id, socket.id);

            socket.join(user.your_id);

            io.emit("user-online", {
                yourId: user.your_id
            });

            console.log("🟢 En ligne :", user.your_id);

        } catch (error) {
            console.error(error);
        }
    });

    /* Message */

    socket.on("send-message", async (data) => {
        try {
            if (!socket.userId) return;

            const receiver = await getUserByYourID(data.to);

            if (!receiver) return;

            const content = String(data.content || "").trim();

            if (!content) return;

            const result = await pool.query(
                `INSERT INTO messages
                (sender_id, receiver_id, content, status)
                VALUES ($1, $2, $3, $4)
                RETURNING id, content, status, created_at`,
                [
                    socket.userId,
                    receiver.id,
                    content,
                    "sent"
                ]
            );

            const message = result.rows[0];

            const payload = {
                id: message.id,
                content: message.content,
                status: message.status,
                created_at: message.created_at,
                from: socket.yourId,
                to: receiver.your_id
            };

            io.to(receiver.your_id).emit(
                "message-received",
                payload
            );

            socket.emit("message-sent", payload);

        } catch (error) {
            console.error("Erreur message :", error);

            socket.emit("message-error", {
                message: "Impossible d'envoyer le message."
            });
        }
    });

    /* Indicateur "écrit..." */

    socket.on("typing", (data) => {
        if (!socket.yourId) return;

        io.to(data.to).emit("typing", {
            from: socket.yourId,
            typing: Boolean(data.typing)
        });
    });

    /* Lecture */

    socket.on("mark-read", async (data) => {
        try {
            const sender = await getUserByYourID(data.from);

            if (!sender || !socket.userId) return;

            await pool.query(
                `UPDATE messages
                 SET status = 'read'
                 WHERE sender_id = $1
                 AND receiver_id = $2`,
                [sender.id, socket.userId]
            );

            io.to(data.from).emit("messages-read", {
                by: socket.yourId
            });

        } catch (error) {
            console.error(error);
        }
    });

    /* =========================
       APPELS WEBRTC
    ========================= */

    socket.on("call-user", (data) => {
        if (!socket.yourId) return;

        io.to(data.to).emit("incoming-call", {
            from: socket.yourId,
            offer: data.offer,
            callType: data.callType || "audio"
        });
    });

    socket.on("answer-call", (data) => {
        io.to(data.to).emit("call-answered", {
            answer: data.answer
        });
    });

    socket.on("ice-candidate", (data) => {
        io.to(data.to).emit("ice-candidate", {
            candidate: data.candidate
        });
    });

    socket.on("reject-call", (data) => {
        io.to(data.to).emit("call-rejected");
    });

    socket.on("end-call", (data) => {
        io.to(data.to).emit("call-ended");
    });

    /* =========================
       DÉCONNEXION
    ========================= */

    socket.on("disconnect", () => {

        if (socket.yourId) {
            connectedUsers.delete(socket.yourId);

            io.emit("user-offline", {
                yourId: socket.yourId
            });

            console.log("🔴 Hors ligne :", socket.yourId);
        }

        console.log("Déconnexion :", socket.id);
    });
});

/* =========================
   LANCEMENT
========================= */

async function startServer() {
    try {
        await initDatabase();

        server.listen(PORT, "0.0.0.0", () => {
            console.log(`🚀 YourID lancé sur le port ${PORT}`);
        });

    } catch (error) {
        console.error("❌ Impossible de démarrer YourID :", error);
        process.exit(1);
    }
}

startServer();
