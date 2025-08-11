const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const frontendURL = process.env.FRONTEND_URL;

app.use(cors({ origin: frontendURL }));

const io = new Server(server, {
  cors: {
    origin: frontendURL,
    methods: ["GET", "POST"],
  },
});

const userSocketMap = {};
const roomLocks = {}; 

function getAllConnectedClients(roomId) {
  const socketIds = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
  return socketIds.map((socketId) => ({
    socketId,
    username: userSocketMap[socketId],
  }));
}

io.on("connection", (socket) => {
  console.log("A user connected, socket ID:", socket.id);

  socket.on("join", ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    socket.join(roomId);

    const clients = getAllConnectedClients(roomId);
    
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit("joined", { clients, username, socketId: socket.id });
    });

    const lockedBySocketId = roomLocks[roomId];
    const lockHolderUsername = lockedBySocketId ? userSocketMap[lockedBySocketId] : null;
    socket.emit('lock-status-update', {
        lockedBy: lockedBySocketId,
        username: lockHolderUsername,
    });
  });

  socket.on("code-change", ({ roomId, code }) => {
    socket.to(roomId).emit("code-change", { code });
  });

  // ADDED: Handle language change event
  socket.on("language-change", ({ roomId, language }) => {
    socket.to(roomId).emit("language-update", { language });
  });

  socket.on('start-typing-lock', ({ roomId }) => {
    if (!roomLocks[roomId]) {
        roomLocks[roomId] = socket.id;
        io.to(roomId).emit('lock-status-update', {
            lockedBy: socket.id,
            username: userSocketMap[socket.id],
        });
    }
  });

  socket.on('stop-typing-lock', ({ roomId }) => {
    if (roomLocks[roomId] === socket.id) {
        delete roomLocks[roomId];
        io.to(roomId).emit('lock-status-update', {
            lockedBy: null,
            username: null,
        });
    }
  });

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      if (roomLocks[roomId] === socket.id) {
          delete roomLocks[roomId];
          socket.to(roomId).emit('lock-status-update', {
            lockedBy: null,
            username: null,
          });
      }
      socket.to(roomId).emit("disconnected", {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });
    });
    delete userSocketMap[socket.id];
    socket.leave();
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected, socket ID:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`Server is running on port ${PORT}`)
);