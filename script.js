/* =====================================================
   YOURID V1
   ===================================================== */

/* ==================== VARIABLES ==================== */

let currentContact = null;
let toastTimer = null;

/* ==================== OUTILS ==================== */

function getContacts() {
    return JSON.parse(localStorage.getItem("yourID_contacts")) || [];
}

function saveContacts(contacts) {
    localStorage.setItem(
        "yourID_contacts",
        JSON.stringify(contacts)
    );
}

function getCurrentUser() {
    return JSON.parse(
        localStorage.getItem("yourID_user")
    );
}

function saveCurrentUser(user) {
    localStorage.setItem(
        "yourID_user",
        JSON.stringify(user)
    );
}

/* ==================== ÉCRANS ==================== */

function showScreen(screenId) {

    document.querySelectorAll(".screen").forEach(screen => {
        screen.classList.remove("active");
    });

    const screen = document.getElementById(screenId);

    if (screen) {
        screen.classList.add("active");
    }

    window.scrollTo(0, 0);
}

/* ==================== TOAST ==================== */

function showToast(message) {

    const toast = document.getElementById("toast");

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2200);
}

/* ==================== ID YOURID ==================== */

function generateFakeNumber() {

    let number;

    do {

        number =
            Math.floor(100 + Math.random() * 900) + " " +
            Math.floor(100 + Math.random() * 900) + " " +
            Math.floor(100 + Math.random() * 900);

    } while (
        number === localStorage.getItem("yourID_id")
    );

    return number;
}

/* ==================== INSCRIPTION ==================== */

function createAccount() {

    const username =
        document.getElementById("username").value.trim();

    const password =
        document.getElementById("password").value;

    const confirmPassword =
        document.getElementById("confirmPassword").value;

    if (username.length < 2) {
        showToast("Entre un pseudo valide.");
        return;
    }

    if (password.length < 4) {
        showToast("Le mot de passe doit avoir au moins 4 caractères.");
        return;
    }

    if (password !== confirmPassword) {
        showToast("Les mots de passe ne correspondent pas.");
        return;
    }

    const existingUser =
        localStorage.getItem("yourID_user");

    if (existingUser) {

        const replace = confirm(
            "Un compte existe déjà sur cet appareil. Créer un nouveau compte ?"
        );

        if (!replace) {
            return;
        }
    }

    const id = generateFakeNumber();

    const user = {
        username: username,
        password: password,
        id: id,
        photo: null
    };

    saveCurrentUser(user);

    localStorage.setItem("yourID_id", id);

    document.getElementById("generatedNumber")
        .textContent = id;

    updateUserInterface();

    showToast("Compte créé avec succès !");

    setTimeout(() => {
        showScreen("homeScreen");
    }, 500);
}

/* ==================== CONNEXION ==================== */

function loginUser() {

    const id =
        document.getElementById("loginId").value.trim();

    const password =
        document.getElementById("loginPassword").value;

    const user = getCurrentUser();

    if (!user) {
        showToast("Aucun compte trouvé sur cet appareil.");
        return;
    }

    if (
        id === user.id &&
        password === user.password
    ) {

        updateUserInterface();

        displayContacts();
        displayConversations();

        showToast("Connexion réussie !");

        setTimeout(() => {
            showScreen("homeScreen");
        }, 400);

    } else {

        showToast("ID ou mot de passe incorrect.");

    }
}

/* ==================== MOT DE PASSE ==================== */

function togglePassword(inputId, button) {

    const input =
        document.getElementById(inputId);

    if (input.type === "password") {
        input.type = "text";
        button.textContent = "🙈";
    } else {
        input.type = "password";
        button.textContent = "👁";
    }
}

/* ==================== INTERFACE UTILISATEUR ==================== */

function updateUserInterface() {

    const user = getCurrentUser();

    if (!user) {
        return;
    }

    const elements = {
        myId: user.id,
        headerUsername: user.username,
        profileUsername: user.username,
        profileId: user.id
    };

    Object.keys(elements).forEach(id => {

        const element =
            document.getElementById(id);

        if (element) {
            element.textContent = elements[id];
        }

    });

    updateAvatar();
}

/* ==================== AVATAR ==================== */

function updateAvatar() {

    const user = getCurrentUser();

    if (!user) return;

    const avatars = [
        document.getElementById("miniAvatar"),
        document.getElementById("profileAvatar")
    ];

    avatars.forEach(avatar => {

        if (!avatar) return;

        if (user.photo) {

            avatar.innerHTML =
                `<img src="${user.photo}" alt="Photo">`;

        } else {

            avatar.textContent = "👤";

        }

    });
}

/* ==================== PROFIL ==================== */

function openProfile() {

    updateUserInterface();

    showScreen("profileScreen");
}

/* ==================== PHOTO ==================== */

function changeProfilePhoto(event) {

    const file =
        event.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
        showToast("Choisis une image.");
        return;
    }

    const reader = new FileReader();

    reader.onload = function(e) {

        const user = getCurrentUser();

        if (!user) return;

        user.photo = e.target.result;

        saveCurrentUser(user);

        updateAvatar();

        showToast("Photo de profil mise à jour.");

    };

    reader.readAsDataURL(file);
}

/* ==================== COPIER ID ==================== */

function copyMyId() {

    const user = getCurrentUser();

    if (!user) return;

    if (navigator.clipboard) {

        navigator.clipboard
            .writeText(user.id)
            .then(() => {
                showToast("YourID copié !");
            })
            .catch(() => {
                fallbackCopy(user.id);
            });

    } else {

        fallbackCopy(user.id);

    }
}

function fallbackCopy(text) {

    const input =
        document.createElement("textarea");

    input.value = text;

    document.body.appendChild(input);

    input.select();

    document.execCommand("copy");

    input.remove();

    showToast("YourID copié !");
}

/* ==================== PARTAGER ID ==================== */

function shareMyId() {

    const user = getCurrentUser();

    if (!user) return;

    const text =
        `Mon YourID est : ${user.id}`;

    if (navigator.share) {

        navigator.share({
            title: "Mon YourID",
            text: text
        });

    } else {

        copyMyId();

        showToast("ID copié. Tu peux maintenant le partager.");

    }
}

/* ==================== ONGLETS ==================== */

function showTab(tabName, clickedButton = null) {

    document
        .getElementById("discussions")
        .classList.add("hidden");

    document
        .getElementById("contacts")
        .classList.add("hidden");

    document
        .getElementById(tabName)
        .classList.remove("hidden");

    document.querySelectorAll(".tab")
        .forEach(tab => {
            tab.classList.remove("active");
        });

    if (clickedButton) {
        clickedButton.classList.add("active");
    } else {

        document.querySelectorAll(".tab")
            .forEach(tab => {

                if (
                    tab.textContent
                        .toLowerCase()
                        .includes(
                            tabName === "contacts"
                                ? "contacts"
                                : "discussions"
                        )
                ) {
                    tab.classList.add("active");
                }

            });

    }

    filterCurrentSearch();
}

function goHome() {

    updateUserInterface();

    displayContacts();
    displayConversations();

    showScreen("homeScreen");

    showTab("discussions");
}

function goContacts() {

    updateUserInterface();

    displayContacts();

    showScreen("homeScreen");

    showTab("contacts");
}

/* ==================== CONTACTS ==================== */

function addContact() {

    const id =
        document.getElementById("contactId")
            .value.trim();

    const name =
        document.getElementById("contactName")
            .value.trim();

    if (!/^\d{3} \d{3} \d{3}$/.test(id)) {

        showToast(
            "ID invalide. Format : 123 456 789"
        );

        return;
    }

    if (name.length < 1) {
        showToast("Entre le nom du contact.");
        return;
    }

    const user = getCurrentUser();

    if (user && id === user.id) {
        showToast("Tu ne peux pas t'ajouter toi-même.");
        return;
    }

    const contacts = getContacts();

    if (
        contacts.some(contact => contact.id === id)
    ) {
        showToast("Ce contact existe déjà.");
        return;
    }

    contacts.push({
        id: id,
        name: name,
        photo: null,
        addedAt: Date.now()
    });

    saveContacts(contacts);

    document.getElementById("contactId").value = "";
    document.getElementById("contactName").value = "";

    showToast("Contact ajouté !");

    setTimeout(() => {
        goContacts();
    }, 400);
}

function displayContacts() {

    const list =
        document.getElementById("contactList");

    if (!list) return;

    const contacts = getContacts();

    if (contacts.length === 0) {

        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">👥</div>
                <h3>Aucun contact</h3>
                <p>Ajoute ton premier contact.</p>
            </div>
        `;

        return;
    }

    list.innerHTML = "";

    contacts.forEach(contact => {

        const div =
            document.createElement("div");

        div.className = "contact";

        div.dataset.search =
            `${contact.name} ${contact.id}`.toLowerCase();

        div.onclick = () => openChat(contact);

        div.innerHTML = `
            <div class="contact-avatar">
                ${contact.photo
                    ? `<img src="${contact.photo}" alt="">`
                    : "👤"}
            </div>

            <div class="contact-info">
                <strong>${escapeHTML(contact.name)}</strong>
                <small>${escapeHTML(contact.id)}</small>
            </div>
        `;

        list.appendChild(div);

    });
}

/* ==================== CHAT ==================== */

function getMessageKey(contactId) {

    const user = getCurrentUser();

    const myId =
        user ? user.id : "unknown";

    return `yourID_messages_${myId}_${contactId}`;
}

function openChat(contact) {

    currentContact = contact;

    document.getElementById("chatName")
        .textContent = contact.name;

    document.getElementById("chatId")
        .textContent = contact.id;

    const avatar =
        document.getElementById("chatAvatar");

    avatar.innerHTML =
        contact.photo
            ? `<img src="${contact.photo}" alt="">`
            : "👤";

    loadMessages(contact.id);

    showScreen("chatScreen");

    setTimeout(() => {

        document
            .getElementById("messageText")
            .focus();

    }, 100);
}

function sendMessage() {

    if (!currentContact) {
        return;
    }

    const input =
        document.getElementById("messageText");

    const text =
        input.value.trim();

    if (!text) {
        return;
    }

    const key =
        getMessageKey(currentContact.id);

    const messages =
        JSON.parse(
            localStorage.getItem(key)
        ) || [];

    messages.push({
        text: text,
        type: "sent",
        time: new Date().toISOString()
    });

    localStorage.setItem(
        key,
        JSON.stringify(messages)
    );

    input.value = "";

    loadMessages(currentContact.id);

    displayConversations();
}

function loadMessages(contactId) {

    const container =
        document.getElementById("messages");

    const key =
        getMessageKey(contactId);

    const messages =
        JSON.parse(
            localStorage.getItem(key)
        ) || [];

    container.innerHTML = "";

    if (messages.length === 0) {

        container.innerHTML = `
            <div class="empty-state" style="margin-top:100px">
                <div class="empty-icon">👋</div>
                <h3>Nouvelle discussion</h3>
                <p>Envoie ton premier message.</p>
            </div>
        `;

        return;
    }

    messages.forEach(message => {

        const div =
            document.createElement("div");

        div.className =
            `message ${message.type}`;

        const time =
            new Date(message.time)
                .toLocaleTimeString(
                    "fr-FR",
                    {
                        hour: "2-digit",
                        minute: "2-digit"
                    }
                );

        div.innerHTML = `
            ${escapeHTML(message.text)}
            <span class="message-time">${time}</span>
        `;

        container.appendChild(div);

    });

    container.scrollTop =
        container.scrollHeight;
}

/* ==================== CONVERSATIONS ==================== */

function displayConversations() {

    const container =
        document.getElementById("conversations");

    if (!container) return;

    const contacts = getContacts();

    const conversations = [];

    contacts.forEach(contact => {

        const key =
            getMessageKey(contact.id);

        const messages =
            JSON.parse(
                localStorage.getItem(key)
            ) || [];

        if (messages.length > 0) {

            const last =
                messages[messages.length - 1];

            conversations.push({
                contact: contact,
                last: last
            });

        }

    });

    if (conversations.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💬</div>
                <h3>Aucune discussion</h3>
                <p>
                    Ajoute un contact pour<br>
                    commencer à discuter.
                </p>
            </div>
        `;

        return;
    }

    container.innerHTML = "";

    conversations
        .sort(
            (a, b) =>
                new Date(b.last.time) -
                new Date(a.last.time)
        )
        .forEach(item => {

            const div =
                document.createElement("div");

            div.className = "conversation";

            div.dataset.search =
                `${item.contact.name} ${item.contact.id} ${item.last.text}`
                    .toLowerCase();

            div.onclick = () =>
                openChat(item.contact);

            const time =
                new Date(item.last.time)
                    .toLocaleTimeString(
                        "fr-FR",
                        {
                            hour: "2-digit",
                            minute: "2-digit"
                        }
                    );

            div.innerHTML = `
                <div class="conversation-avatar">
                    ${item.contact.photo
                        ? `<img src="${item.contact.photo}" alt="">`
                        : "👤"}
                </div>

                <div class="conversation-info">
                    <strong>${escapeHTML(item.contact.name)}</strong>
                    <small>${escapeHTML(item.last.text)}</small>
                </div>

                <span class="conversation-time">
                    ${time}
                </span>
            `;

            container.appendChild(div);

        });
}

/* ==================== ENTRÉE MESSAGE ==================== */

function handleMessageKey(event) {

    if (event.key === "Enter") {
        sendMessage();
    }
}

/* ==================== RECHERCHE ==================== */

function filterCurrentSearch() {

    const search =
        document.getElementById("searchInput");

    if (!search) return;

    const value =
        search.value.trim().toLowerCase();

    document.querySelectorAll(
        ".contact, .conversation"
    ).forEach(item => {

        const text =
            item.dataset.search ||
            item.textContent.toLowerCase();

        item.style.display =
            text.includes(value)
                ? "flex"
                : "none";

    });
}

/* ==================== APPELS ==================== */

function openCalls() {

    showScreen("callsScreen");

    displayCalls();
}

function fakeCall() {

    if (!currentContact) return;

    const calls =
        JSON.parse(
            localStorage.getItem("yourID_calls")
        ) || [];

    calls.push({
        name: currentContact.name,
        id: currentContact.id,
        type: "Appel sortant",
        time: new Date().toISOString()
    });

    localStorage.setItem(
        "yourID_calls",
        JSON.stringify(calls)
    );

    showToast(
        `Appel vers ${currentContact.name}...`
    );
}

function displayCalls() {

    const container =
        document.getElementById("callList");

    if (!container) return;

    const calls =
        JSON.parse(
            localStorage.getItem("yourID_calls")
        ) || [];

    if (calls.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📞</div>
                <h3>Aucun appel</h3>
                <p>Ton historique apparaîtra ici.</p>
            </div>
        `;

        return;
    }

    container.innerHTML = "";

    calls
        .slice()
        .reverse()
        .forEach(call => {

            const div =
                document.createElement("div");

            div.className = "contact";

            const date =
                new Date(call.time)
                    .toLocaleString("fr-FR");

            div.innerHTML = `
                <div class="contact-avatar">
                    📞
                </div>

                <div class="contact-info">
                    <strong>${escapeHTML(call.name)}</strong>
                    <small>${call.type} • ${date}</small>
                </div>
            `;

            container.appendChild(div);

        });
}

/* ==================== MENU CHAT ==================== */

function chatMenu() {

    if (!currentContact) return;

    const remove =
        confirm(
            `Supprimer ${currentContact.name} de tes contacts ?`
        );

    if (!remove) return;

    let contacts = getContacts();

    contacts =
        contacts.filter(
            contact =>
                contact.id !== currentContact.id
        );

    saveContacts(contacts);

    localStorage.removeItem(
        getMessageKey(currentContact.id)
    );

    currentContact = null;

    showToast("Contact supprimé.");

    setTimeout(goHome, 400);
}

/* ==================== PARAMÈTRES ==================== */

function openSettings() {

    const toggle =
        document.getElementById("darkModeToggle");

    toggle.checked =
        document.body.classList.contains("dark");

    showScreen("settingsScreen");
}

function toggleDarkMode() {

    const toggle =
        document.getElementById("darkModeToggle");

    document.body.classList.toggle(
        "dark",
        toggle.checked
    );

    localStorage.setItem(
        "yourID_dark",
        toggle.checked
    );
}

function loadDarkMode() {

    const dark =
        localStorage.getItem("yourID_dark")
        === "true";

    document.body.classList.toggle(
        "dark",
        dark
    );

    const toggle =
        document.getElementById("darkModeToggle");

    if (toggle) {
        toggle.checked = dark;
    }
}

/* ==================== DÉCONNEXION ==================== */

function logout() {

    const confirmation =
        confirm("Voulez-vous vraiment vous déconnecter ?");

    if (!confirmation) return;

    localStorage.removeItem(
        "yourID_logged"
    );

    showToast("Déconnexion réussie.");

    setTimeout(() => {
        showScreen("welcomeScreen");
    }, 500);
}

/* ==================== APPEL ==================== */

function fakeCallFromChat() {

    fakeCall();
}

/* ==================== SÉCURITÉ HTML ==================== */

function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}

/* ==================== INITIALISATION ==================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadDarkMode();

        const user =
            getCurrentUser();

        if (user) {

            updateUserInterface();

            displayContacts();
            displayConversations();

        }

        const search =
            document.getElementById("searchInput");

        if (search) {

            search.addEventListener(
                "input",
                filterCurrentSearch
            );

        }

    }
);
/* =====================================================
   YOURID V2 — CONNEXION SERVEUR + APPELS WEBRTC
   ===================================================== */

let yourIDSocket = null;
let yourIDPeer = null;
let yourIDLocalStream = null;
let yourIDCurrentCallWith = null;
let yourIDPendingOffer = null;

/* ==================== CHARGER SOCKET.IO ==================== */

function loadYourIDSocketIO() {

    if (window.io) {
        connectYourIDServer();
        return;
    }

    const script = document.createElement("script");

    script.src = "http://localhost:3000/socket.io/socket.io.js";

    script.onload = () => {
        connectYourIDServer();
    };

    script.onerror = () => {
        console.error("Impossible de charger Socket.IO.");
        showToast("Impossible de connecter YourID au serveur.");
    };

    document.head.appendChild(script);
}

/* ==================== CONNEXION SERVEUR ==================== */

function connectYourIDServer() {

    const user = getCurrentUser();

    if (!user) return;

    yourIDSocket = io("http://localhost:3000");

    yourIDSocket.on("connect", () => {

        console.log("YourID connecté au serveur :", yourIDSocket.id);

        yourIDSocket.emit("register", user.id);

        showToast("YourID connecté au serveur 🚀");
    });

    yourIDSocket.on("disconnect", () => {

        console.log("YourID déconnecté du serveur.");

    });

    /* APPEL ENTRANT */

    yourIDSocket.on("incoming-call", async (data) => {

        yourIDPendingOffer = data.offer;

        showIncomingCall(data.from);

    });

    /* APPEL ACCEPTÉ */

    yourIDSocket.on("call-answered", async (data) => {

        if (!yourIDPeer) return;

        await yourIDPeer.setRemoteDescription(
            new RTCSessionDescription(data.answer)
        );

        console.log("Appel accepté.");
    });

    /* ICE */

    yourIDSocket.on("ice-candidate", async (data) => {

        if (!yourIDPeer) return;

        try {

            await yourIDPeer.addIceCandidate(
                new RTCIceCandidate(data.candidate)
            );

        } catch (error) {

            console.error("Erreur ICE :", error);

        }

    });

    /* APPEL REFUSÉ */

    yourIDSocket.on("call-rejected", () => {

        showToast("Appel refusé.");

        endYourIDCall(false);

    });

    /* APPEL TERMINÉ */

    yourIDSocket.on("call-ended", () => {

        showToast("Appel terminé.");

        endYourIDCall(false);

    });

}

/* ==================== INTERFACE APPEL ==================== */

function createCallInterface() {

    if (document.getElementById("yourIDCallWindow")) {
        return;
    }

    const box = document.createElement("div");

    box.id = "yourIDCallWindow";

    box.innerHTML = `
        <div style="
            position:fixed;
            inset:0;
            z-index:99999;
            background:#111;
            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:center;
            color:white;
            padding:20px;
        ">

            <h2 id="yourIDCallTitle">Appel YourID</h2>

            <video
                id="yourIDRemoteVideo"
                autoplay
                playsinline
                style="
                    width:90%;
                    max-width:500px;
                    max-height:55vh;
                    background:#222;
                    border-radius:18px;
                    object-fit:cover;
                ">
            </video>

            <video
                id="yourIDLocalVideo"
                autoplay
                muted
                playsinline
                style="
                    width:120px;
                    height:160px;
                    position:absolute;
                    right:20px;
                    top:80px;
                    background:#333;
                    border-radius:12px;
                    object-fit:cover;
                ">
            </video>

            <div style="
                display:flex;
                gap:15px;
                margin-top:25px;
            ">

                <button
                    onclick="toggleYourIDMicrophone()"
                    style="
                        padding:15px 20px;
                        border:0;
                        border-radius:50px;
                        font-size:20px;
                    ">
                    🎤
                </button>

                <button
                    onclick="endYourIDCall(true)"
                    style="
                        padding:15px 25px;
                        border:0;
                        border-radius:50px;
                        background:#e53935;
                        color:white;
                        font-size:20px;
                    ">
                    📞 Raccrocher
                </button>

            </div>

        </div>
    `;

    document.body.appendChild(box);
}

/* ==================== APPEL SORTANT ==================== */

async function startYourIDCall(contact) {

    if (!yourIDSocket || !yourIDSocket.connected) {

        showToast("YourID n'est pas connecté au serveur.");

        return;
    }

    yourIDCurrentCallWith = contact;

    createCallInterface();

    document.getElementById("yourIDCallTitle").textContent =
        `Appel vers ${contact.name}`;

    try {

        yourIDLocalStream =
            await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true
            });

        document.getElementById("yourIDLocalVideo").srcObject =
            yourIDLocalStream;

        yourIDPeer = createYourIDPeer(contact.id);

        yourIDLocalStream.getTracks().forEach(track => {

            yourIDPeer.addTrack(
                track,
                yourIDLocalStream
            );

        });

        const offer =
            await yourIDPeer.createOffer();

        await yourIDPeer.setLocalDescription(offer);

        yourIDSocket.emit("call-user", {

            to: contact.id,
            offer: offer

        });

        showToast(`Appel vers ${contact.name}...`);

    } catch (error) {

        console.error(error);

        showToast(
            "Impossible d'accéder à la caméra ou au microphone."
        );

        endYourIDCall(false);
    }
}

/* ==================== CONNEXION WEBRTC ==================== */

function createYourIDPeer(remoteID) {

    const peer =
        new RTCPeerConnection({

            iceServers: [
                {
                    urls: "stun:stun.l.google.com:19302"
                }
            ]

        });

    peer.onicecandidate = event => {

        if (event.candidate) {

            yourIDSocket.emit("ice-candidate", {

                to: remoteID,
                candidate: event.candidate

            });

        }

    };

    peer.ontrack = event => {

        const video =
            document.getElementById(
                "yourIDRemoteVideo"
            );

        if (video) {

            video.srcObject =
                event.streams[0];

        }

    };

    return peer;
}

/* ==================== APPEL ENTRANT ==================== */

function showIncomingCall(from) {

    const existing =
        document.getElementById(
            "yourIDIncomingCall"
        );

    if (existing) {
        existing.remove();
    }

    const box =
        document.createElement("div");

    box.id =
        "yourIDIncomingCall";

    box.innerHTML = `

        <div style="
            position:fixed;
            inset:0;
            z-index:100000;
            background:rgba(0,0,0,.85);
            display:flex;
            align-items:center;
            justify-content:center;
        ">

            <div style="
                background:white;
                color:#111;
                padding:30px;
                border-radius:25px;
                text-align:center;
                width:85%;
                max-width:350px;
            ">

                <div style="
                    font-size:60px;
                    margin-bottom:15px;
                ">
                    📞
                </div>

                <h2>Appel entrant</h2>

                <p>
                    Appel de<br>
                    <strong>${escapeHTML(from)}</strong>
                </p>

                <div style="
                    display:flex;
                    justify-content:center;
                    gap:15px;
                    margin-top:25px;
                ">

                    <button
                        onclick="acceptYourIDCall('${from}')"
                        style="
                            padding:15px 25px;
                            border:0;
                            border-radius:50px;
                            background:#22c55e;
                            color:white;
                            font-size:18px;
                        ">
                        ✓ Accepter
                    </button>

                    <button
                        onclick="rejectYourIDCall('${from}')"
                        style="
                            padding:15px 25px;
                            border:0;
                            border-radius:50px;
                            background:#e53935;
                            color:white;
                            font-size:18px;
                        ">
                        ✕ Refuser
                    </button>

                </div>

            </div>

        </div>
    `;

    document.body.appendChild(box);
}

/* ==================== ACCEPTER ==================== */

async function acceptYourIDCall(from) {

    const box =
        document.getElementById(
            "yourIDIncomingCall"
        );

    if (box) {
        box.remove();
    }

    createCallInterface();

    document.getElementById(
        "yourIDCallTitle"
    ).textContent =
        `Appel avec ${from}`;

    yourIDCurrentCallWith = {
        id: from,
        name: from
    };

    try {

        yourIDLocalStream =
            await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true
            });

        document.getElementById(
            "yourIDLocalVideo"
        ).srcObject =
            yourIDLocalStream;

        yourIDPeer =
            createYourIDPeer(from);

        yourIDLocalStream
            .getTracks()
            .forEach(track => {

                yourIDPeer.addTrack(
                    track,
                    yourIDLocalStream
                );

            });

        await yourIDPeer.setRemoteDescription(
            new RTCSessionDescription(
                yourIDPendingOffer
            )
        );

        const answer =
            await yourIDPeer.createAnswer();

        await yourIDPeer.setLocalDescription(
            answer
        );

        yourIDSocket.emit(
            "answer-call",
            {
                to: from,
                answer: answer
            }
        );

        yourIDPendingOffer = null;

    } catch (error) {

        console.error(error);

        showToast(
            "Impossible d'accéder à la caméra ou au microphone."
        );

        endYourIDCall(false);

    }
}

/* ==================== REFUSER ==================== */

function rejectYourIDCall(from) {

    const box =
        document.getElementById(
            "yourIDIncomingCall"
        );

    if (box) {
        box.remove();
    }

    if (yourIDSocket) {

        yourIDSocket.emit(
            "reject-call",
            {
                to: from
            }
        );

    }

    yourIDPendingOffer = null;

    showToast("Appel refusé.");

}

/* ==================== MICROPHONE ==================== */

function toggleYourIDMicrophone() {

    if (!yourIDLocalStream) return;

    const audioTracks =
        yourIDLocalStream.getAudioTracks();

    audioTracks.forEach(track => {

        track.enabled =
            !track.enabled;

    });

    showToast(
        audioTracks[0].enabled
            ? "Micro activé 🎤"
            : "Micro coupé 🔇"
    );
}

/* ==================== RACCROCHER ==================== */

function endYourIDCall(notify = true) {

    if (
        notify &&
        yourIDSocket &&
        yourIDCurrentCallWith
    ) {

        yourIDSocket.emit(
            "end-call",
            {
                to:
                    yourIDCurrentCallWith.id
            }
        );

    }

    if (yourIDLocalStream) {

        yourIDLocalStream
            .getTracks()
            .forEach(track => track.stop());

        yourIDLocalStream = null;

    }

    if (yourIDPeer) {

        yourIDPeer.close();

        yourIDPeer = null;

    }

    const callWindow =
        document.getElementById(
            "yourIDCallWindow"
        );

    if (callWindow) {
        callWindow.remove();
    }

    const incoming =
        document.getElementById(
            "yourIDIncomingCall"
        );

    if (incoming) {
        incoming.remove();
    }

    yourIDCurrentCallWith = null;
    yourIDPendingOffer = null;
}

/* ==================== BOUTON D'APPEL ==================== */

/*
   Cette fonction remplace l'ancien faux appel.
*/

function fakeCallFromChat() {

    if (!currentContact) {

        showToast(
            "Ouvre d'abord une conversation."
        );

        return;
    }

    startYourIDCall(currentContact);
}

/* ==================== DÉMARRAGE ==================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setTimeout(() => {

            if (getCurrentUser()) {

                loadYourIDSocketIO();

            }

        }, 1000);

    }
);