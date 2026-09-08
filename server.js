const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const PORT = 3000;

app.use(express.static(__dirame))
  

io.on("connection", (socket) => {
  console.log("Un utilisateur est connecté :", socket.id);

  socket.on("register", (yourId) => {
    socket.yourId = yourId;
    socket.join(yourId);
    console.log("YourID enregistré :", yourId);
  });

  socket.on("call-user", (data) => {
    io.to(data.to).emit("incoming-call", {
      from: socket.yourId,
      offer: data.offer
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

  socket.on("disconnect", () => {
    console.log("Utilisateur déconnecté :", socket.id);
  });
});
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Serveur YourID lancé sur http://localhost:${PORT}`);
});
