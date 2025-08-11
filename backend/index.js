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
const roomLocks = {}; 

function getAllConnectedClients(roomId) {
  // Use io.sockets.adapter.rooms to get all socket IDs in the room
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
  console.log("BACKEND LOG: A user connected, socket ID:", socket.id);

  socket.on("join", ({ roomId, username }) => {
    console.log(`BACKEND LOG: Received 'join' event from ${username} for room ${roomId}`);
    userSocketMap[socket.id] = username;
    socket.join(roomId);

    const clients = getAllConnectedClients(roomId);
    
    // *** FINAL DEBUG LOG - This is the most important part ***
    // We are now broadcasting the 'joined' event specifically to everyone in the room.
    console.log(`BACKEND LOG: Broadcasting 'joined' to ${clients.length} clients in room ${roomId}`);
    io.to(roomId).emit("joined", {
        clients,
        username, // The name of the user who just joined
        socketId: socket.id,
    });
    
    // Send the current lock status to the new user
    const lockedBySocketId = roomLocks[roomId];
    const lockHolderUsername = lockedBySocketId ? userSocketMap[lockedBySocketId] : null;
    socket.emit('lock-status-update', {
        lockedBy: lockedBySocketId,
        username: lockHolderUsername,
    });
  });

  socket.on("code-change", ({ roomId, code }) => {
    // Send to everyone in the room except the sender
    socket.to(roomId).emit("code-change", { code });
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
    console.log("BACKEND LOG: A user disconnected, socket ID:", socket.id);
  });
});

// =================================================================
//                      START THE SERVER
// =================================================================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`Server is running on port ${PORT}`)
);