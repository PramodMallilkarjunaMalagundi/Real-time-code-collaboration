// =================================================================
//                      IMPORTS AND SETUP
// =================================================================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const frontendURL = process.env.FRONTEND_URL;

// =================================================================
//             MIDDLEWARE AND CORS CONFIGURATION
// =================================================================

app.use(cors({ origin: frontendURL }));

const io = new Server(server, {
  cors: {
    origin: frontendURL,
    methods: ["GET", "POST"],
  },
});

// =================================================================
//                STATE MANAGEMENT
// =================================================================

const userSocketMap = {};
// ADDED: Store the current language for each room
const roomState = {}; // Format: { roomId: { language: 'javascript' } }

function getAllConnectedClients(roomId) {
  const socketIds = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
  return socketIds.map((socketId) => ({
    socketId,
    username: userSocketMap[socketId],
  }));
}

// =================================================================
//                SOCKET.IO REAL-TIME LOGIC
// =================================================================

io.on("connection", (socket) => {
  console.log("A user connected, socket ID:", socket.id);

  socket.on("join", ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    socket.join(roomId);

    // If room has no state, initialize it with default language
    if (!roomState[roomId]) {
      roomState[roomId] = { language: 'javascript' };
    }

    const clients = getAllConnectedClients(roomId);
    
    // Notify all clients about the new user
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit("joined", { clients, username, socketId: socket.id });
    });

    // Send the current room's language to the new user
    socket.emit('language-change', { language: roomState[roomId].language });
  });

  socket.on("code-change", ({ roomId, code }) => {
    socket.to(roomId).emit("code-change", { code });
  });

  // ADDED: Handle language synchronization
  socket.on('language-change', ({ roomId, language }) => {
    if (roomState[roomId]) {
        roomState[roomId].language = language;
    }
    // Broadcast the language change to everyone in the room
    io.to(roomId).emit('language-change', { language });
  });

  // ADDED: Handle typing indicator
  socket.on('typing', ({ roomId, username }) => {
    socket.to(roomId).emit('typing', { username });
  });

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      // Standard disconnect notification
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

// =================================================================
//                      START THE SERVER
// =================================================================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`Server is running on port ${PORT}`)
);