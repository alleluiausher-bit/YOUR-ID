/* =====================================================
   YOURID — SCRIPT PRINCIPAL
   Messages Internet + contacts + WebRTC audio/vidéo
===================================================== */

/* =========================
   VARIABLES
========================= */

let currentUser = null;
let authToken = null;
let contacts = [];
let currentContact = null;

let socket = null;

let peerConnection = null;
let localStream = null;
let currentCallType = "audio";
let pendingOffer = null;
let pendingCaller = null;

let pendingIceCandidates = [];

let microphoneEnabled = true;
let cameraEnabled = true;

let typingTimeout = null;

/* =========================
   SERVEUR
========================= */

/*
   io() utilise automatiquement le même serveur
   que YourID sur Render.
*/

const API = "/api";

/* =========================
   OUTILS
========================= */

function $(id) {
    return document.getElementById(id);
}

function showToast(message) {

    const toast = $("toast");

    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

function getInitial(name) {

    if (!name) return "?";

    return name.trim().charAt(0).toUpperCase();
}

function escapeHTML(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}

function formatTime(date) {

    const d = new Date(date);

    return d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

/* =========================
   ÉCRANS
========================= */

function showScreen(screenId) {

    document.querySelectorAll(".screen").forEach(screen => {
        screen.classList.remove("active");
    });

    const screen = $(screenId);

    if (screen) {
        screen.classList.add("active");
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
        button.classList.remove("active");

        if (button.dataset.page === pageId) {
            button.classList.add("active");
        }
    });

    if (pageId === "contactsPage") {
        loadContacts();
    }
}

/* =========================
   INSCRIPTION
========================= */

async function registerUser() {

    const username = $("registerUsername").value.trim();
    const password = $("registerPassword").value;

    if (!username || !password) {
        showToast("Remplis tous les champs.");
        return;
    }

    if (password.length < 4) {
        showToast("Le mot de passe doit contenir au moins 4 caractères.");
        return;
    }

    try {

        const response = await fetch(`${API}/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                password
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            showToast(data.message || "Erreur d'inscription.");
            return;
        }

        authToken = data.token;
        currentUser = data.user;

        saveSession();

        $("registerUsername").value = "";
        $("registerPassword").value = "";

        showToast(
            `Compte créé ! Ton YourID est ${currentUser.your_id}`
        );

        openApplication();

    } catch (error) {

        console.error(error);

        showToast(
            "Impossible de contacter le serveur."
        );
    }
}

/* =========================
   CONNEXION
========================= */

async function loginUser() {

    const yourId = $("loginYourID").value.trim();
    const password = $("loginPassword").value;

    if (!yourId || !password) {
        showToast("Remplis tous les champs.");
        return;
    }

    try {

        const response = await fetch(`${API}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                yourId,
                password
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            showToast(data.message || "Connexion impossible.");
            return;
        }

        authToken = data.token;
        currentUser = data.user;

        saveSession();

        $("loginYourID").value = "";
        $("loginPassword").value = "";

        openApplication();

    } catch (error) {

        console.error(error);

        showToast(
            "Impossible de contacter le serveur."
        );
    }
}

/* =========================
   SESSION
========================= */

function saveSession() {

    localStorage.setItem(
        "yourid_token",
        authToken
    );

    localStorage.setItem(
        "yourid_user",
        JSON.stringify(currentUser)
    );
}

function loadSession() {

    const token = localStorage.getItem("yourid_token");
    const user = localStorage.getItem("yourid_user");

    if (!token || !user) {
        return false;
    }

    try {

        authToken = token;
        currentUser = JSON.parse(user);

        return true;

    } catch (error) {

        console.error(error);

        return false;
    }
}

/* =========================
   OUVRIR L'APPLICATION
========================= */

async function openApplication() {

    showScreen("appScreen");

    updateProfile();

    connectSocket();

    await loadContacts();
}

/* =========================
   PROFIL
========================= */

function updateProfile() {

    if (!currentUser) return;

    const username =
        currentUser.username || "Utilisateur";

    const yourId =
        currentUser.your_id || "---";

    if ($("profileUsername")) {
        $("profileUsername").textContent = username;
    }

    if ($("profileYourID")) {
        $("profileYourID").textContent = yourId;
    }

    if ($("profileAvatar")) {
        $("profileAvatar").textContent =
            getInitial(username);
    }
}

/* =========================
   DÉCONNEXION
========================= */

function logoutUser() {

    if (socket) {
        socket.disconnect();
        socket = null;
    }

    localStorage.removeItem("yourid_token");
    localStorage.removeItem("yourid_user");

    currentUser = null;
    authToken = null;
    contacts = [];
    currentContact = null;

    closeChat();

    showScreen("welcomeScreen");

    showToast("Tu es déconnecté.");
}

/* =========================
   API AUTH
========================= */

function authHeaders() {

    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
    };
}

/* =========================
   CONTACTS
========================= */

async function loadContacts() {

    if (!authToken) return;

    try {

        const response = await fetch(
            `${API}/contacts`,
            {
                headers: {
                    "Authorization": `Bearer ${authToken}`
                }
            }
        );

        if (response.status === 401) {
            logoutUser();
            return;
        }

        const data = await response.json();

        if (!data.success) {
            return;
        }

        contacts = data.contacts || [];

        renderContacts();
        renderConversations();

    } catch (error) {

        console.error(
            "Erreur chargement contacts :",
            error
        );
    }
}

function renderContacts() {

    const container = $("contactsList");

    if (!container) return;

    if (contacts.length === 0) {

        container.innerHTML = `
            <div class="empty">
                <div class="emoji">👥</div>
                <p>Aucun contact.</p>
            </div>
        `;

        return;
    }

    container.innerHTML = contacts.map(contact => {

        return `
            <div class="contact-card"
                 onclick="openChat('${contact.your_id}')">

                <div class="avatar">
                    ${getInitial(contact.username)}
                </div>

                <div class="contact-info">
                    <strong>
                        ${escapeHTML(contact.username)}
                    </strong>

                    <small>
                        ${escapeHTML(contact.your_id)}
                    </small>
                </div>

                <button
                    class="icon-btn"
                    onclick="event.stopPropagation(); openChat('${contact.your_id}')">
                    💬
                </button>

            </div>
        `;

    }).join("");
}

/* =========================
   AJOUT CONTACT
========================= */

function openAddContactModal() {

    $("contactYourIDInput").value = "";

    $("addContactModal")
        .classList.add("active");
}

function closeAddContactModal() {

    $("addContactModal")
        .classList.remove("active");
}

async function addContact() {

    const yourId =
        $("contactYourIDInput")
            .value
            .trim();

    if (!yourId) {
        showToast("Entre un YourID.");
        return;
    }

    try {

        const response = await fetch(
            `${API}/contacts`,
            {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({
                    yourId
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {

            showToast(
                data.message ||
                "Impossible d'ajouter ce contact."
            );

            return;
        }

        closeAddContactModal();

        showToast(
            `${data.contact.username} a été ajouté.`
        );

        await loadContacts();

    } catch (error) {

        console.error(error);

        showToast(
            "Erreur de connexion au serveur."
        );
    }
}

/* =========================
   DISCUSSIONS
========================= */

function renderConversations() {

    const container =
        $("conversationsList");

    if (!container) return;

    if (contacts.length === 0) {

        container.innerHTML = `
            <div class="empty">
                <div class="emoji">💬</div>
                <p>Aucune conversation pour le moment.</p>
                <small>
                    Ajoute un contact pour commencer.
                </small>
            </div>
        `;

        return;
    }

    container.innerHTML = contacts.map(contact => {

        return `
            <div
                class="conversation-item"
                data-name="${escapeHTML(contact.username.toLowerCase())}"
                onclick="openChat('${contact.your_id}')"
            >

                <div class="avatar">
                    ${getInitial(contact.username)}
                </div>

                <div class="conversation-info">

                    <strong>
                        ${escapeHTML(contact.username)}
                    </strong>

                    <span>
                        ${escapeHTML(contact.your_id)}
                    </span>

                </div>

            </div>
        `;

    }).join("");
}

function filterConversations() {

    const input =
        $("conversationSearch");

    if (!input) return;

    const value =
        input.value
            .trim()
            .toLowerCase();

    document
        .querySelectorAll(".conversation-item")
        .forEach(item => {

            const name =
                item.dataset.name || "";

            item.style.display =
                name.includes(value)
                    ? "flex"
                    : "none";
        });
}

/* =========================
   CHAT
========================= */

async function openChat(yourId) {

    const contact =
        contacts.find(
            c => c.your_id === yourId
        );

    if (!contact) {

        showToast(
            "Contact introuvable."
        );

        return;
    }

    currentContact = contact;

    $("chatContactName")
        .textContent = contact.username;

    $("chatAvatar")
        .textContent =
        getInitial(contact.username);

    $("chatOnlineStatus")
        .textContent = "Connexion...";

    $("chatMessages").innerHTML = `
        <div class="empty">
            Chargement des messages...
        </div>
    `;

    showScreen("chatPage");

    await loadMessages(yourId);
}

/* =========================
   FERMER CHAT
========================= */

function closeChat() {

    currentContact = null;

    const chat =
        $("chatPage");

    if (chat) {
        chat.classList.remove("active");
    }

    const app =
        $("appScreen");

    if (app) {
        app.classList.add("active");
    }
}

/* =========================
   HISTORIQUE
========================= */

async function loadMessages(yourId) {

    try {

        const response = await fetch(
            `${API}/messages/${encodeURIComponent(yourId)}`,
            {
                headers: {
                    "Authorization":
                        `Bearer ${authToken}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {

            showToast(
                data.message ||
                "Impossible de charger les messages."
            );

            return;
        }

        renderMessages(
            data.messages || []
        );

        markMessagesRead(yourId);

    } catch (error) {

        console.error(error);

        showToast(
            "Erreur de chargement des messages."
        );
    }
}

/* =========================
   AFFICHER MESSAGES
========================= */

function renderMessages(messages) {

    const container =
        $("chatMessages");

    if (!container) return;

    if (messages.length === 0) {

        container.innerHTML = `
            <div class="empty">
                <div class="emoji">👋</div>
                <p>Aucun message.</p>
                <small>
                    Envoie le premier message.
                </small>
            </div>
        `;

        return;
    }

    container.innerHTML = messages.map(message => {

        const sent =
            message.sender_your_id ===
            currentUser.your_id;

        return `
            <div class="message ${sent ? "sent" : "received"}">

                ${escapeHTML(message.content)}

                <span class="message-time">
                    ${formatTime(message.created_at)}
                    ${sent ? " ✓" : ""}
                </span>

            </div>
        `;

    }).join("");

    scrollChatToBottom();
}

/* =========================
   ENVOYER MESSAGE
========================= */

function sendMessage() {

    if (!socket) {

        showToast(
            "Connexion au serveur en cours..."
        );

        return;
    }

    if (!currentContact) {

        showToast(
            "Aucun contact sélectionné."
        );

        return;
    }

    const input =
        $("messageInput");

    const content =
        input.value.trim();

    if (!content) return;

    socket.emit(
        "send-message",
        {
            to: currentContact.your_id,
            content
        }
    );

    input.value = "";

    stopTyping();
}

/* =========================
   TOUCHE ENTRÉE
========================= */

function handleMessageKey(event) {

    if (event.key === "Enter") {

        event.preventDefault();

        sendMessage();
    }
}

/* =========================
   TYPING
========================= */

function handleTyping() {

    if (!socket || !currentContact) {
        return;
    }

    socket.emit("typing", {
        to: currentContact.your_id,
        typing: true
    });

    clearTimeout(typingTimeout);

    typingTimeout = setTimeout(
        stopTyping,
        1200
    );
}

function stopTyping() {

    if (!socket || !currentContact) {
        return;
    }

    socket.emit("typing", {
        to: currentContact.your_id,
        typing: false
    });
}

/* =========================
   SCROLL CHAT
========================= */

function scrollChatToBottom() {

    const container =
        $("chatMessages");

    if (!container) return;

    setTimeout(() => {

        container.scrollTop =
            container.scrollHeight;

    }, 50);
}

/* =========================
   SOCKET.IO
========================= */

function connectSocket() {

    if (!currentUser) return;

    if (socket) {

        if (socket.connected) {
            return;
        }

        socket.connect();

        return;
    }

    try {

        socket = io();

        socket.on("connect", () => {

            console.log(
                "🟢 YourID connecté au serveur",
                socket.id
            );

            socket.emit(
                "register-socket",
                {
                    yourId:
                        currentUser.your_id
                }
            );
        });

        socket.on("connect_error", error => {

            console.error(
                "Erreur Socket.IO :",
                error
            );

            showToast(
                "Connexion temps réel impossible."
            );
        });

        /* =========================
           MESSAGE REÇU
        ========================= */

        socket.on(
            "message-received",
            message => {

                console.log(
                    "📩 Message reçu",
                    message
                );

                if (
                    currentContact &&
                    message.from ===
                    currentContact.your_id
                ) {

                    addMessageToChat(
                        message,
                        false
                    );

                    markMessagesRead(
                        currentContact.your_id
                    );

                } else {

                    showToast(
                        `Nouveau message de ${message.from}`
                    );
                }
            }
        );

        /* =========================
           MESSAGE ENVOYÉ
        ========================= */

        socket.on(
            "message-sent",
            message => {

                if (
                    currentContact &&
                    message.to ===
                    currentContact.your_id
                ) {

                    addMessageToChat(
                        message,
                        true
                    );
                }
            }
        );

        /* =========================
           ERREUR MESSAGE
        ========================= */

        socket.on(
            "message-error",
            data => {

                showToast(
                    data.message ||
                    "Erreur d'envoi."
                );
            }
        );

        /* =========================
           TYPING
        ========================= */

        socket.on(
            "typing",
            data => {

                if (
                    !currentContact ||
                    data.from !==
                    currentContact.your_id
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
            }
        );

        /* =========================
           LU
        ========================= */

        socket.on(
            "messages-read",
            data => {

                console.log(
                    "Messages lus par",
                    data.by
                );
            }
        );

        /* =========================
           ONLINE
        ========================= */

        socket.on(
            "user-online",
            data => {

                updateContactStatus(
                    data.yourId,
                    true
                );
            }
        );

        /* =========================
           OFFLINE
        ========================= */

        socket.on(
            "user-offline",
            data => {

                updateContactStatus(
                    data.yourId,
                    false
                );
            }
        );

        /* =========================
           APPEL ENTRANT
        ========================= */

        socket.on(
            "incoming-call",
            async data => {

                console.log(
                    "📞 Appel entrant",
                    data
                );

                pendingOffer =
                    data.offer;

                pendingCaller =
                    data.from;

                currentCallType =
                    data.callType || "audio";

                const caller =
                    contacts.find(
                        c =>
                        c.your_id ===
                        data.from
                    );

                const name =
                    caller
                        ? caller.username
                        : data.from;

                $("incomingCallTitle")
                    .textContent =
                    currentCallType === "video"
                        ? "🎥 Appel vidéo entrant"
                        : "📞 Appel audio entrant";

                $("incomingCallFrom")
                    .textContent =
                    `${name} t'appelle`;

                $("incomingCallAvatar")
                    .textContent =
                    caller
                        ? getInitial(caller.username)
                        : "📞";

                $("incomingCallModal")
                    .classList.add("active");
            }
        );

        /* =========================
           APPEL ACCEPTÉ
        ========================= */

        socket.on(
            "call-answered",
            async data => {

                if (!peerConnection) {
                    return;
                }

                try {

                    await peerConnection
                        .setRemoteDescription(
                            new RTCSessionDescription(
                                data.answer
                            )
                        );

                    await flushPendingIce();

                    updateCallStatus(
                        "Appel connecté"
                    );

                } catch (error) {

                    console.error(
                        "Erreur réponse appel :",
                        error
                    );

                    showToast(
                        "Impossible de connecter l'appel."
                    );
                }
            }
        );

        /* =========================
           ICE
        ========================= */

        socket.on(
            "ice-candidate",
            async data => {

                if (!data.candidate) {
                    return;
                }

                if (
                    peerConnection &&
                    peerConnection.remoteDescription
                ) {

                    try {

                        await peerConnection
                            .addIceCandidate(
                                new RTCIceCandidate(
                                    data.candidate
                                )
                            );

                    } catch (error) {

                        console.error(
                            "Erreur ICE :",
                            error
                        );
                    }

                } else {

                    pendingIceCandidates
                        .push(data.candidate);
                }
            }
        );

        /* =========================
           APPEL REFUSÉ
        ========================= */

        socket.on(
            "call-rejected",
            () => {

                showToast(
                    "Appel refusé."
                );

                closeCallScreen();
            }
        );

        /* =========================
           APPEL TERMINÉ
        ========================= */

        socket.on(
            "call-ended",
            () => {

                showToast(
                    "Appel terminé."
                );

                closeCallScreen();
            }
        );

    } catch (error) {

        console.error(
            "Socket.IO indisponible :",
            error
        );
    }
}

/* =========================
   AJOUT MESSAGE DIRECT
========================= */

function addMessageToChat(
    message,
    sent
) {

    const container =
        $("chatMessages");

    if (!container) return;

    const empty =
        container.querySelector(".empty");

    if (empty) {
        empty.remove();
    }

    const element =
        document.createElement("div");

    element.className =
        `message ${sent ? "sent" : "received"}`;

    element.innerHTML = `
        ${escapeHTML(message.content)}

        <span class="message-time">
            ${formatTime(message.created_at)}
            ${sent ? " ✓" : ""}
        </span>
    `;

    container.appendChild(element);

    scrollChatToBottom();
}

/* =========================
   STATUT CONTACT
========================= */

function updateContactStatus(
    yourId,
    online
) {

    if (
        currentContact &&
        currentContact.your_id === yourId
    ) {

        $("chatOnlineStatus")
            .textContent =
            online
                ? "🟢 En ligne"
                : "Hors ligne";
    }
}

/* =========================
   MESSAGE LU
========================= */

function markMessagesRead(yourId) {

    if (!socket || !yourId) {
        return;
    }

    socket.emit(
        "mark-read",
        {
            from: yourId
        }
    );
}

/* =====================================================
   WEBRTC
===================================================== */

/* =========================
   CONFIGURATION WEBRTC
========================= */

const rtcConfiguration = {

    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
};

/* =========================
   CRÉER PEER CONNECTION
========================= */

function createPeerConnection(remoteID) {

    if (peerConnection) {

        try {
            peerConnection.close();
        } catch (error) {}
    }

    pendingIceCandidates = [];

    peerConnection =
        new RTCPeerConnection(
            rtcConfiguration
        );

    /* =========================
       STREAM LOCAL
    ========================= */

    if (localStream) {

        localStream
            .getTracks()
            .forEach(track => {

                peerConnection.addTrack(
                    track,
                    localStream
                );
            });
    }

    /* =========================
       STREAM DISTANT
    ========================= */

   

    /* =========================
       ICE
    ========================= */

    peerConnection.onicecandidate =
        event => {

            if (
                event.candidate &&
                socket
            ) {

                socket.emit(
                    "ice-candidate",
                    {
                        to: remoteIpeerConnection.ontrack = event => {

    if (!event.streams[0]) return;

    const remoteVideo = $("remoteVideo");

    if (!remoteVideo) return;

    remoteVideo.srcObject = event.streams[0];

    remoteVideo.muted = false;
    remoteVideo.volume = 1.0;

    remoteVideo.play()
        .then(() => {
            console.log("🔊 Audio distant activé");
        })
        .catch(error => {
            console.error(
                "Impossible de lire le son distant :",
                error
            );
        });
};
                        candidate:
                            event.candidate
                    }
                );
            }
        };

    /* =========================
       ÉTAT CONNEXION
    ========================= */

    peerConnection.onconnectionstatechange =
        () => {

            console.log(
                "WebRTC :",
                peerConnection.connectionState
            );

            if (
                peerConnection.connectionState ===
                "connected"
            ) {

                updateCallStatus(
                    "Appel connecté"
                );
            }

            if (
                peerConnection.connectionState ===
                "disconnected"
            ) {

                updateCallStatus(
                    "Connexion interrompue..."
                );
            }

            if (
                peerConnection.connectionState ===
                "failed"
            ) {

                showToast(
                    "La connexion de l'appel a échoué."
                );

                closeCallScreen();
            }
        };

    return peerConnection;
}

/* =========================
   OBTENIR MICRO / CAMÉRA
========================= */

async function getMedia(callType) {

    try {

        const constraints =
            callType === "video"
                ? {
                    audio: true,
                    video: true
                }
                : {
                    audio: true,
                    video: false
                };

        localStream =
            await navigator.mediaDevices
                .getUserMedia(
                    constraints
                );

        microphoneEnabled = true;
        cameraEnabled =
            callType === "video";

        const localVideo =
            $("localVideo");

        if (localVideo) {

            if (callType === "video") {

                localVideo.srcObject =
                    localStream;

                localVideo.style.display =
                    "block";

            } else {

                localVideo.style.display =
                    "none";
            }
        }

        return true;

    } catch (error) {

        console.error(
            "Erreur caméra/micro :",
            error
        );

        if (
            error.name ===
            "NotAllowedError"
        ) {

            showToast(
                "Autorise le micro et la caméra pour appeler."
            );

        } else {

            showToast(
                "Impossible d'accéder au micro/caméra."
            );
        }

        return false;
    }
}

/* =========================
   APPEL AUDIO
========================= */

async function startAudioCall() {

    if (!currentContact) {

        showToast(
            "Ouvre d'abord une conversation."
        );

        return;
    }

    await startCall(
        currentContact,
        "audio"
    );
}

/* =========================
   APPEL VIDÉO
========================= */

async function startVideoCall() {

    if (!currentContact) {

        showToast(
            "Ouvre d'abord une conversation."
        );

        return;
    }

    await startCall(
        currentContact,
        "video"
    );
}

/* =========================
   DÉMARRER APPEL
========================= */

async function startCall(
    contact,
    callType
) {

    if (!socket) {

        showToast(
            "Connexion au serveur..."
        );

        return;
    }

    if (!socket.connected) {

        showToast(
            "Connexion au serveur en cours..."
        );

        return;
    }

    currentCallType =
        callType;

    pendingIceCandidates = [];

    const mediaReady =
        await getMedia(
            callType
        );

    if (!mediaReady) {
        return;
    }

    createPeerConnection(
        contact.your_id
    );

    showCallScreen(
        contact,
        callType,
        "Appel en cours..."
    );

    try {

        const offer =
            await peerConnection
                .createOffer();

        await peerConnection
            .setLocalDescription(
                offer
            );

        socket.emit(
            "call-user",
            {
                to: contact.your_id,
                offer,
                callType
            }
        );

    } catch (error) {

        console.error(
            "Erreur création appel :",
            error
        );

        showToast(
            "Impossible de démarrer l'appel."
        );

        closeCallScreen();
    }
}

/* =========================
   ACCEPTER APPEL
========================= */

async function acceptIncomingCall() {

    $("incomingCallModal")
        .classList.remove("active");

    if (!pendingOffer || !pendingCaller) {

        showToast(
            "Appel invalide."
        );

        return;
    }

    const caller =
        contacts.find(
            c =>
            c.your_id ===
            pendingCaller
        );

    const contact =
        caller || {
            your_id: pendingCaller,
            username: pendingCaller
        };

    const mediaReady =
        await getMedia(
            currentCallType
        );

    if (!mediaReady) {

        pendingOffer = null;
        pendingCaller = null;

        return;
    }

    createPeerConnection(
        pendingCaller
    );

    showCallScreen(
        contact,
        currentCallType,
        "Connexion..."
    );

    try {

        await peerConnection
            .setRemoteDescription(
                new RTCSessionDescription(
                    pendingOffer
                )
            );

        await flushPendingIce();

        const answer =
            await peerConnection
                .createAnswer();

        await peerConnection
            .setLocalDescription(
                answer
            );

        socket.emit(
            "answer-call",
            {
                to: pendingCaller,
                answer
            }
        );

        updateCallStatus(
            "Appel connecté"
        );

    } catch (error) {

        console.error(
            "Erreur acceptation appel :",
            error
        );

        showToast(
            "Impossible d'accepter l'appel."
        );

        closeCallScreen();
    }

    pendingOffer = null;
    pendingCaller = null;
}

/* =========================
   REFUSER APPEL
========================= */

function rejectIncomingCall() {

    $("incomingCallModal")
        .classList.remove("active");

    if (
        socket &&
        pendingCaller
    ) {

        socket.emit(
            "reject-call",
            {
                to: pendingCaller
            }
        );
    }

    pendingOffer = null;
    pendingCaller = null;
}

/* =========================
   ICE EN ATTENTE
========================= */

async function flushPendingIce() {

    if (!peerConnection) {
        return;
    }

    if (
        !peerConnection.remoteDescription
    ) {
        return;
    }

    for (
        const candidate
        of pendingIceCandidates
    ) {

        try {

            await peerConnection
                .addIceCandidate(
                    new RTCIceCandidate(
                        candidate
                    )
                );

        } catch (error) {

            console.error(
                "Erreur ICE en attente :",
                error
            );
        }
    }

    pendingIceCandidates = [];
}

/* =========================
   ÉCRAN APPEL
========================= */

function showCallScreen(
    contact,
    callType,
    status
) {

    $("callContactName")
        .textContent =
        contact.username;

    $("callContactAvatar")
        .textContent =
        getInitial(
            contact.username
        );

    $("callStatus")
        .textContent =
        status;

    const remoteVideo =
        $("remoteVideo");

    const localVideo =
        $("localVideo");

    if (callType === "video") {

        remoteVideo.style.display =
            "block";

        localVideo.style.display =
            "block";

    } else {

        remoteVideo.style.display =
            "none";

        localVideo.style.display =
            "none";
    }

    showScreen(
        "callScreen"
    );
}

function updateCallStatus(status) {

    const element =
        $("callStatus");

    if (element) {
        element.textContent =
            status;
    }
}

/* =========================
   MICROPHONE
========================= */

function toggleMicrophone() {

    if (!localStream) return;

    const audioTracks =
        localStream.getAudioTracks();

    if (audioTracks.length === 0) {

        showToast(
            "Aucun microphone disponible."
        );

        return;
    }

    microphoneEnabled =
        !microphoneEnabled;

    audioTracks.forEach(track => {
        track.enabled =
            microphoneEnabled;
    });

    showToast(
        microphoneEnabled
            ? "Micro activé"
            : "Micro coupé"
    );
}

/* =========================
   TERMINER APPEL
========================= */

function endCall() {

    if (
        socket &&
        currentContact
    ) {

        socket.emit(
            "end-call",
            {
                to:
                    currentContact.your_id
            }
        );
    }

    closeCallScreen();
}

/* =========================
   FERMER APPEL
========================= */

function closeCallScreen() {

    if (localStream) {

        localStream
            .getTracks()
            .forEach(track => {
                track.stop();
            });

        localStream = null;
    }

    if (peerConnection) {

        try {
            peerConnection.close();
        } catch (error) {}

        peerConnection = null;
    }

    const localVideo =
        $("localVideo");

    const remoteVideo =
        $("remoteVideo");

    if (localVideo) {
        localVideo.srcObject = null;
    }

    if (remoteVideo) {
        remoteVideo.srcObject = null;
    }

    pendingIceCandidates = [];

    showScreen("appScreen");

    if (currentContact) {
        openChat(
            currentContact.your_id
        );
    }
}

/* =========================
   PARTAGER YOURID
========================= */

async function shareYourID() {

    if (!currentUser) return;

    const text =
        `Mon YourID est ${currentUser.your_id}`;

    if (
        navigator.share
    ) {

        try {

            await navigator.share({
                title: "YourID",
                text
            });

        } catch (error) {}

    } else {

        try {

            await navigator
                .clipboard
                .writeText(text);

            showToast(
                "YourID copié !"
            );

        } catch (error) {

            showToast(text);
        }
    }
}

/* =========================
   NOTIFICATIONS
========================= */

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
            await Notification
                .requestPermission();

        if (
            permission === "granted"
        ) {

            showToast(
                "Notifications activées."
            );

        } else {

            showToast(
                "Notifications refusées."
            );
        }

    } catch (error) {

        console.error(error);

        showToast(
            "Impossible d'activer les notifications."
        );
    }
}

/* =========================
   MODE SOMBRE
========================= */

function toggleDarkMode() {

    document.body.classList.toggle(
        "dark"
    );

    const enabled =
        document.body.classList.contains(
            "dark"
        );

    localStorage.setItem(
        "yourid_dark_mode",
        enabled
            ? "true"
            : "false"
    );
}

function loadDarkMode() {

    const enabled =
        localStorage.getItem(
            "yourid_dark_mode"
        );

    if (enabled === "true") {

        document.body.classList.add(
            "dark"
        );
    }
}

/* =========================
   INITIALISATION
========================= */

async function initYourID() {

    console.log(
        "🚀 Initialisation de YourID..."
    );

    loadDarkMode();

    const loggedIn =
        loadSession();

    if (!loggedIn) {

        showScreen(
            "welcomeScreen"
        );

        return;
    }

    try {

        const response =
            await fetch(
                `${API}/me`,
                {
                    headers: {
                        "Authorization":
                            `Bearer ${authToken}`
                    }
                }
            );

        if (!response.ok) {

            localStorage.removeItem(
                "yourid_token"
            );

            localStorage.removeItem(
                "yourid_user"
            );

            currentUser = null;
            authToken = null;

            showScreen(
                "welcomeScreen"
            );

            return;
        }const data = await response.json();

if (!data.success) {
    localStorage.removeItem("yourid_token");
    localStorage.removeItem("yourid_user");

    currentUser = null;
    authToken = null;

    showScreen("welcomeScreen");
    return;
}

currentUser = data.user;

saveSession();

openApplication();

    } catch (error) {
        console.error("Erreur initialisation :", error);

        localStorage.removeItem("yourid_token");
        localStorage.removeItem("yourid_user");

        currentUser = null;
        authToken = null;

        showScreen("welcomeScreen");
    }
}

document.addEventListener(
    "DOMContentLoaded",
    initYourID
);

      
