/* =========================================================
   YourID - script.js
   Version propre : connexion, contacts, messages, profil.
   Les appels audio/vidéo sont volontairement désactivés.
========================================================= */

"use strict";

const API = "/api";

let currentUser = null;
let authToken = localStorage.getItem("yourid_token") || "";
let contacts = [];
let currentContact = null;
let socket = null;
let typingTimer = null;
let conversations = {};

function $(id) {
    return document.getElementById(id);
}

/* =========================================================
   OUTILS
========================================================= */

function showToast(message) {
    const toast = $("toast");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

function formatYourID(value) {
    const digits = String(value || "").replace(/\D/g, "");

    if (digits.length !== 9) {
        return String(value || "").trim();
    }

    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
}

function initials(name) {
    const text = String(name || "?").trim();

    if (!text) return "?";

    const parts = text.split(/\s+/).filter(Boolean);

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatTime(dateValue) {
    if (!dateValue) return "";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

/* =========================================================
   API
========================================================= */

async function apiFetch(path, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetch(API + path, {
        ...options,
        headers
    });

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw new Error(
            data.message || `Erreur HTTP ${response.status}`
        );
    }

    return data;
}

/* =========================================================
   ÉCRANS
========================================================= */

function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach(screen => {
        screen.classList.remove("active");
    });

    const target = $(screenId);

    if (target) {
        target.classList.add("active");
    }
}

function showPage(pageId) {
    document.querySelectorAll(".page").forEach(page => {
        page.classList.remove("active");
    });

    const page = $(pageId);

    if (page) {
        page.classList.add("active");
    }

    document.querySelectorAll(".nav-btn").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.page === pageId
        );
    });
}

/* =========================================================
   INSCRIPTION
========================================================= */

async function registerUser() {
    const usernameInput = $("registerUsername");
    const passwordInput = $("registerPassword");

    const username =
        usernameInput?.value.trim() || "";

    const password =
        passwordInput?.value || "";

    if (!username) {
        showToast("Entre ton nom d'utilisateur.");
        usernameInput?.focus();
        return;
    }

    if (password.length < 4) {
        showToast(
            "Le mot de passe doit contenir au moins 4 caractères."
        );
        passwordInput?.focus();
        return;
    }

    try {
        showToast("Création du compte...");

        const data = await apiFetch("/register", {
            method: "POST",
            body: JSON.stringify({
                username,
                password
            })
        });

        if (!data.success) {
            throw new Error(
                data.message ||
                "Inscription impossible."
            );
        }

        saveSession(data.token, data.user);

        if (usernameInput) {
            usernameInput.value = "";
        }

        if (passwordInput) {
            passwordInput.value = "";
        }

        showScreen("appScreen");

        await startApplication();

        showToast(
            `Compte créé ! Ton YourID est ${formatYourID(
                data.user.your_id
            )}`
        );

    } catch (error) {
        console.error(
            "Erreur inscription :",
            error
        );

        showToast(
            error.message ||
            "Impossible de créer le compte."
        );
    }
}

/* =========================================================
   CONNEXION
========================================================= */

async function loginUser() {
    const yourIdInput = $("loginYourID");
    const passwordInput = $("loginPassword");

    const yourId =
        formatYourID(
            yourIdInput?.value || ""
        );

    const password =
        passwordInput?.value || "";

    if (
        !yourId ||
        yourId.replace(/\D/g, "").length !== 9
    ) {
        showToast("Entre un YourID valide.");
        yourIdInput?.focus();
        return;
    }

    if (!password) {
        showToast("Entre ton mot de passe.");
        passwordInput?.focus();
        return;
    }

    try {
        showToast("Connexion...");

        const data = await apiFetch("/login", {
            method: "POST",
            body: JSON.stringify({
                yourId,
                password
            })
        });

        if (!data.success) {
            throw new Error(
                data.message ||
                "Connexion impossible."
            );
        }

        saveSession(data.token, data.user);

        if (yourIdInput) {
            yourIdInput.value = "";
        }

        if (passwordInput) {
            passwordInput.value = "";
        }

        showScreen("appScreen");

        await startApplication();

        showToast("Connexion réussie.");

    } catch (error) {
        console.error(
            "Erreur connexion :",
            error
        );

        showToast(
            error.message ||
            "Impossible de se connecter."
        );
    }
}

function saveSession(token, user) {
    authToken = token || "";
    currentUser = user || null;

    if (authToken) {
        localStorage.setItem(
            "yourid_token",
            authToken
        );
    }

    if (currentUser) {
        localStorage.setItem(
            "yourid_user",
            JSON.stringify(currentUser)
        );
    }
}

function clearSession() {
    authToken = "";
    currentUser = null;

    localStorage.removeItem("yourid_token");
    localStorage.removeItem("yourid_user");
}

/* =========================================================
   DÉCONNEXION
========================================================= */

function logoutUser() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }

    clearSession();

    contacts = [];
    currentContact = null;
    conversations = {};

    showScreen("welcomeScreen");
    showPage("homePage");

    showToast("Tu es déconnecté.");
}

/* =========================================================
   INITIALISATION
========================================================= */

async function startApplication() {
    try {
        const data = await apiFetch("/me");

        if (
            !data.success ||
            !data.user
        ) {
            throw new Error(
                "Session invalide."
            );
        }

        currentUser = data.user;

        localStorage.setItem(
            "yourid_user",
            JSON.stringify(currentUser)
        );

        updateProfile();

        await loadContacts();

        connectSocket();

        showPage("homePage");

    } catch (error) {
        console.error(
            "Initialisation :",
            error
        );

        clearSession();

        showScreen("welcomeScreen");
    }
}

/* =========================================================
   PROFIL
========================================================= */

function updateProfile() {
    if (!currentUser) return;

    const username =
        currentUser.username ||
        "Utilisateur";

    const yourId =
        currentUser.your_id ||
        currentUser.yourId ||
        "";

    const profileUsername =
        $("profileUsername");

    const profileYourID =
        $("profileYourID");

    const profileAvatar =
        $("profileAvatar");

    if (profileUsername) {
        profileUsername.textContent =
            username;
    }

    if (profileYourID) {
        profileYourID.textContent =
            formatYourID(yourId);
    }

    if (profileAvatar) {
        profileAvatar.textContent =
            initials(username);
    }
}

/* =========================================================
   CONTACTS
========================================================= */

async function loadContacts() {
    try {
        const data =
            await apiFetch("/contacts");

        contacts =
            Array.isArray(data.contacts)
                ? data.contacts
                : [];

        renderContacts();
        renderConversations();

    } catch (error) {
        console.error(
            "Contacts :",
            error
        );

        showToast(
            error.message ||
            "Impossible de charger les contacts."
        );
    }
}

function renderContacts() {
    const container =
        $("contactsList");

    if (!container) return;

    if (!contacts.length) {
        container.innerHTML = `
            <div class="empty">
                <div class="emoji">👥</div>
                <p>Aucun contact.</p>
                <small>
                    Ajoute un contact pour commencer.
                </small>
            </div>
        `;

        return;
    }

    container.innerHTML =
        contacts.map(contact => `
            <div class="contact-card">

                <div class="avatar">
                    ${escapeHTML(
                        initials(contact.username)
                    )}
                </div>

                <div class="contact-info">

                    <strong>
                        ${escapeHTML(
                            contact.username
                        )}
                    </strong>

                    <small>
                        ${escapeHTML(
                            formatYourID(
                                contact.your_id
                            )
                        )}
                    </small>

                </div>

                <button
                    class="icon-btn"
                    onclick="openChat('${escapeHTML(
                        contact.your_id
                    )}')"
                    title="Message"
                >
                    💬
                </button>

            </div>
        `).join("");
}

function openAddContactModal() {
    const modal =
        $("addContactModal");

    if (!modal) return;

    modal.classList.add("active");

    const input =
        $("contactYourIDInput");

    input?.focus();
}

function closeAddContactModal() {
    $("addContactModal")
        ?.classList.remove("active");
}

async function addContact() {
    const input =
        $("contactYourIDInput");

    const yourId =
        formatYourID(
            input?.value || ""
        );

    if (
        !yourId ||
        yourId.replace(/\D/g, "").length !== 9
    ) {
        showToast(
            "Entre un YourID valide."
        );

        input?.focus();

        return;
    }

    try {
        const data =
            await apiFetch("/contacts", {
                method: "POST",
                body: JSON.stringify({
                    yourId
                })
            });

        if (!data.success) {
            throw new Error(
                data.message ||
                "Impossible d'ajouter."
            );
        }

        if (input) {
            input.value = "";
        }

        closeAddContactModal();

        await loadContacts();

        showToast(
            `${data.contact.username} a été ajouté.`
        );

    } catch (error) {
        console.error(
            "Ajout contact :",
            error
        );

        showToast(
            error.message ||
            "Impossible d'ajouter ce contact."
        );
    }
}

/* =========================================================
   DISCUSSIONS
========================================================= */

function renderConversations() {
    const container =
        $("conversationsList");

    if (!container) return;

    if (!contacts.length) {
        container.innerHTML = `
            <div class="empty">
                <div class="emoji">💬</div>
                <p>
                    Aucune conversation pour le moment.
                </p>
                <small>
                    Ajoute un contact pour commencer.
                </small>
            </div>
        `;

        return;
    }

    const search =
        $("conversationSearch")
            ?.value.trim()
            .toLowerCase() || "";

    const filtered =
        contacts.filter(contact => {

            const name =
                String(
                    contact.username || ""
                ).toLowerCase();

            const id =
                String(
                    contact.your_id || ""
                ).toLowerCase();

            return (
                !search ||
                name.includes(search) ||
                id.includes(search)
            );
        });

    if (!filtered.length) {
        container.innerHTML = `
            <div class="empty">
                <div class="emoji">🔎</div>
                <p>Aucun résultat.</p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        filtered.map(contact => {

            const last =
                conversations[
                    contact.your_id
                ];

            return `
                <div
                    class="conversation-item"
                    onclick="openChat('${escapeHTML(
                        contact.your_id
                    )}')"
                >

                    <div class="avatar">
                        ${escapeHTML(
                            initials(
                                contact.username
                            )
                        )}
                    </div>

                    <div class="conversation-info">

                        <strong>
                            ${escapeHTML(
                                contact.username
                            )}
                        </strong>

                        <span>
                            ${
                                last
                                    ? escapeHTML(
                                        last.content
                                    )
                                    : "Appuie pour discuter"
                            }
                        </span>

                    </div>

                </div>
            `;
        }).join("");
}

function filterConversations() {
    renderConversations();
}

/* =========================================================
   CHAT
========================================================= */

async function openChat(yourId) {
    const id =
        formatYourID(yourId);

    const contact =
        contacts.find(
            item =>
                formatYourID(
                    item.your_id
                ) === id
        );

    if (!contact) {
        showToast(
            "Contact introuvable."
        );

        return;
    }

    currentContact = contact;

    const name =
        contact.username ||
        "Contact";

    if ($("chatContactName")) {
        $("chatContactName")
            .textContent = name;
    }

    if ($("chatAvatar")) {
        $("chatAvatar")
            .textContent = initials(name);
    }

    if ($("chatOnlineStatus")) {
        $("chatOnlineStatus")
            .textContent = "Connexion...";
    }

    showScreen("chatPage");

    await loadConversation(
        contact.your_id
    );

    if (socket?.connected) {
        socket.emit(
            "mark-read",
            {
                from: contact.your_id
            }
        );
    }

    $("messageInput")?.focus();
}

function closeChat() {
    currentContact = null;

    showScreen("appScreen");

    showPage("homePage");
}

async function loadConversation(yourId) {
    const container =
        $("chatMessages");

    if (!container) return;

    container.innerHTML = `
        <div class="empty">
            <div class="emoji">⏳</div>
            <p>Chargement...</p>
        </div>
    `;

    try {
        const data =
            await apiFetch(
                `/messages/${encodeURIComponent(
                    formatYourID(yourId)
                )}`
            );

        const messages =
            Array.isArray(data.messages)
                ? data.messages
                : [];

        container.innerHTML = "";

        messages.forEach(message => {
            renderMessage(
                message,
                false
            );
        });

        scrollChatToBottom();

    } catch (error) {
        console.error(
            "Historique :",
            error
        );

        container.innerHTML = `
            <div class="empty">
                <div class="emoji">⚠️</div>
                <p>
                    Impossible de charger les messages.
                </p>
            </div>
        `;

        showToast(
            error.message ||
            "Erreur de chargement."
        );
    }
}

function renderMessage(
    message,
    scroll = true
) {
    const container =
        $("chatMessages");

    if (
        !container ||
        !currentUser
    ) {
        return;
    }

    const senderId =
        message.from ||
        message.sender_your_id ||
        "";

    const myId =
        currentUser.your_id ||
        currentUser.yourId ||
        "";

    const isSent =
        formatYourID(senderId) ===
        formatYourID(myId);

    const div =
        document.createElement("div");

    div.className =
        `message ${
            isSent
                ? "sent"
                : "received"
        }`;

    div.dataset.messageId =
        message.id || "";

    const time =
        formatTime(
            message.created_at
        );

    div.innerHTML = `
        ${escapeHTML(
            message.content || ""
        )}

        <span class="message-time">
            ${escapeHTML(time)}
        </span>
    `;

    container.appendChild(div);

    if (scroll) {
        scrollChatToBottom();
    }
}

function scrollChatToBottom() {
    const container =
        $("chatMessages");

    if (!container) return;

    requestAnimationFrame(() => {
        container.scrollTop =
            container.scrollHeight;
    });
}

/* =========================================================
   ENVOI MESSAGE
========================================================= */

function sendMessage() {
    if (!currentContact) {
        showToast(
            "Ouvre une conversation."
        );

        return;
    }

    if (
        !socket ||
        !socket.connected
    ) {
        showToast(
            "Connexion au serveur en cours..."
        );

        return;
    }

    const input =
        $("messageInput");

    const content =
        input?.value.trim() || "";

    if (!content) return;

    socket.emit(
        "send-message",
        {
            to: currentContact.your_id,
            content
        }
    );

    input.value = "";

    socket.emit(
        "typing",
        {
            to: currentContact.your_id,
            typing: false
        }
    );
}

function handleMessageKey(event) {
    if (
        event.key === "Enter" &&
        !event.shiftKey
    ) {
        event.preventDefault();

        sendMessage();
    }
}

function handleTyping() {
    if (
        !socket ||
        !socket.connected ||
        !currentContact
    ) {
        return;
    }

    socket.emit(
        "typing",
        {
            to: currentContact.your_id,
            typing: true
        }
    );

    clearTimeout(typingTimer);

    typingTimer =
        setTimeout(() => {

            if (
                socket?.connected &&
                currentContact
            ) {
                socket.emit(
                    "typing",
                    {
                        to:
                            currentContact.your_id,
                        typing: false
                    }
                );
            }

        }, 900);
}

/* =========================================================
   SOCKET.IO
========================================================= */

function connectSocket() {
    if (!currentUser) return;

    if (socket) {
        socket.disconnect();
        socket = null;
    }

    if (typeof io !== "function") {
        console.error(
            "Socket.IO n'est pas chargé."
        );

        showToast(
            "Le système de messages n'est pas disponible."
        );

        return;
    }

    socket = io({
        transports: [
            "websocket",
            "polling"
        ]
    });

    socket.on(
        "connect",
        () => {

            console.log(
                "🟢 Socket connecté"
            );

            socket.emit(
                "register-socket",
                {
                    yourId:
                        currentUser.your_id ||
                        currentUser.yourId
                }
            );

            updateOnlineStatus();
        }
    );

    socket.on(
        "connect_error",
        error => {

            console.error(
                "Socket :",
                error
            );

            updateOnlineStatus();
        }
    );

    socket.on(
        "disconnect",
        () => {

            console.log(
                "🔴 Socket déconnecté"
            );

            updateOnlineStatus();
        }
    );

    socket.on(
        "message-sent",
        message => {
            handleIncomingMessage(
                message
            );
        }
    );

    socket.on(
        "message-received",
        message => {

            handleIncomingMessage(
                message
            );

            if (
                currentContact &&
                formatYourID(
                    message.from
                ) ===
                formatYourID(
                    currentContact.your_id
                )
            ) {
                socket.emit(
                    "mark-read",
                    {
                        from:
                            message.from
                    }
                );

            } else {

                showToast(
                    "💬 Nouveau message"
                );

                requestNotificationsForMessage(
                    message
                );
            }
        }
    );

    socket.on(
        "message-error",
        data => {

            showToast(
                data?.message ||
                "Impossible d'envoyer le message."
            );
        }
    );

    socket.on(
        "typing",
        data => {

            if (
                !currentContact ||
                formatYourID(
                    data.from
                ) !==
                formatYourID(
                    currentContact.your_id
                )
            ) {
                return;
            }

            const indicator =
                $("typingIndicator");

            if (!indicator) return;

            indicator.textContent =
                data.typing
                    ? `${currentContact.username} écrit...`
                    : "";

            if (data.typing) {

                clearTimeout(
                    indicator._timer
                );

                indicator._timer =
                    setTimeout(() => {
                        indicator.textContent =
                            "";
                    }, 2000);
            }
        }
    );

    socket.on(
        "messages-read",
        data => {

            console.log(
                "Messages lus par :",
                data?.by
            );
        }
    );

    socket.on(
        "user-online",
        data => {

            updateContactOnline(
                data?.yourId,
                true
            );
        }
    );

    socket.on(
        "user-offline",
        data => {

            updateContactOnline(
                data?.yourId,
                false
            );
        }
    );
}

function handleIncomingMessage(
    message
) {
    if (!currentUser) return;

    const myId =
        currentUser.your_id ||
        currentUser.yourId ||
        "";

    const sender =
        formatYourID(
            message.from || ""
        );

    const receiver =
        formatYourID(
            message.to || ""
        );

    const otherId =
        sender === formatYourID(myId)
            ? receiver
            : sender;

    conversations[otherId] =
        message;

    renderConversations();

    if (
        currentContact &&
        (
            sender ===
            formatYourID(
                currentContact.your_id
            ) ||
            receiver ===
            formatYourID(
                currentContact.your_id
            )
        )
    ) {
        renderMessage(
            message,
            true
        );
    }
}

function updateOnlineStatus() {
    if (!currentContact) return;

    const status =
        $("chatOnlineStatus");

    if (!status) return;

    status.textContent =
        socket?.connected
            ? "En ligne"
            : "Hors ligne";
}

function updateContactOnline(
    yourId,
    online
) {
    if (!currentContact) return;

    if (
        formatYourID(yourId) ===
        formatYourID(
            currentContact.your_id
        )
    ) {
        const status =
            $("chatOnlineStatus");

        if (status) {
            status.textContent =
                online
                    ? "En ligne"
                    : "Hors ligne";
        }
    }
}

/* =========================================================
   PARTAGE YOURID
========================================================= */

async function shareYourID() {
    if (!currentUser) return;

    const yourId =
        formatYourID(
            currentUser.your_id ||
            currentUser.yourId
        );

    const text =
        `Mon YourID : ${yourId}`;

    try {

        if (navigator.share) {

            await navigator.share({
                title: "Mon YourID",
                text
            });

        } else if (
            navigator.clipboard
        ) {

            await navigator.clipboard
                .writeText(text);

            showToast(
                "YourID copié."
            );

        } else {

            showToast(text);
        }

    } catch (error) {

        if (
            error?.name !==
            "AbortError"
        ) {
            showToast(text);
        }
    }
}

/* =========================================================
   MODE SOMBRE
========================================================= */

function toggleDarkMode() {
    document.body.classList.toggle(
        "dark"
    );

    const enabled =
        document.body.classList.contains(
            "dark"
        );

    localStorage.setItem(
        "yourid_dark",
        enabled ? "1" : "0"
    );

    showToast(
        enabled
            ? "Mode sombre activé."
            : "Mode sombre désactivé."
    );
}

function loadDarkMode() {
    const enabled =
        localStorage.getItem(
            "yourid_dark"
        ) === "1";

    document.body.classList.toggle(
        "dark",
        enabled
    );
}

/* =========================================================
   NOTIFICATIONS
========================================================= */

async function requestNotifications() {
    if (
        !("Notification" in window)
    ) {
        showToast(
            "Les notifications ne sont pas disponibles."
        );

        return;
    }

    try {

        const permission =
            await Notification.requestPermission();

        if (
            permission === "granted"
        ) {
            showToast(
                "Notifications activées."
            );
        } else {
            showToast(
                "Notifications non autorisées."
            );
        }

    } catch (error) {

        console.error(
            "Notifications :",
            error
        );

        showToast(
            "Impossible d'activer les notifications."
        );
    }
}

function requestNotificationsForMessage(
    message
) {
    if (
        !("Notification" in window) ||
        Notification.permission !==
        "granted"
    ) {
        return;
    }

    try {

        new Notification(
            "YourID",
            {
                body:
                    String(
                        message.content ||
                        "Nouveau message"
                    )
            }
        );

    } catch {
        // Le navigateur peut refuser les notifications.
    }
}

/* =========================================================
   APPELS DÉSACTIVÉS
========================================================= */

function callsDisabled() {
    showToast(
        "Les appels sont désactivés pour le moment."
    );
}

function startAudioCall() {
    callsDisabled();
}

function startVideoCall() {
    callsDisabled();
}

function acceptIncomingCall() {
    callsDisabled();

    $("incomingCallModal")
        ?.classList.remove("active");
}

function rejectIncomingCall() {
    $("incomingCallModal")
        ?.classList.remove("active");

    showToast(
        "Appel refusé."
    );
}

function toggleMicrophone() {
    callsDisabled();
}

function endCall() {
    $("callScreen")
        ?.classList.remove("active");

    showToast(
        "Les appels sont désactivés."
    );
}

/* =========================================================
   INITIALISATION
========================================================= */

async function initialize() {
    loadDarkMode();

    const savedUser =
        localStorage.getItem(
            "yourid_user"
        );

    if (savedUser) {

        try {
            currentUser =
                JSON.parse(savedUser);

        } catch {
            currentUser = null;
        }
    }

    if (!authToken) {

        showScreen(
            "welcomeScreen"
        );

        return;
    }

    try {

        const data =
            await apiFetch("/me");

        if (
            !data.success ||
            !data.user
        ) {
            throw new Error(
                "Session expirée."
            );
        }

        currentUser =
            data.user;

        localStorage.setItem(
            "yourid_user",
            JSON.stringify(
                currentUser
            )
        );

        showScreen(
            "appScreen"
        );

        await startApplication();

    } catch (error) {

        console.warn(
            "Session non valide :",
            error
        );

        clearSession();

        showScreen(
            "welcomeScreen"
        );
    }
}

/* =========================================================
   DÉMARRAGE
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {
        initialize();
    }
);

console.log(
    "✅ YourID script chargé - version sans appels."
);
