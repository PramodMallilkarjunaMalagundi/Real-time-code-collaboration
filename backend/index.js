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
// ADDED: This object will store who holds the edit lock for each room.
// Format: { roomId: socketId }
const roomLocks = {}; 

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

    const clients = getAllConnectedClients(roomId);
    
    // Notify all clients about the new user
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit("joined", { clients, username, socketId: socket.id });
    });

    // ADDED: When a new user joins, immediately tell them the current lock status
    const lockedBySocketId = roomLocks[roomId];
    const lockHolderUsername = lockedBySocketId ? userSocketMap[lockedBySocketId] : null;
    socket.emit('lock-status-update', {
        lockedBy: lockedBySocketId,
        username: lockHolderUsername,
    });
  });

  // 'CODE_CHANGE' is now only sent by the lock holder, so we just broadcast it.
  socket.on("code-change", ({ roomId, code }) => {
    socket.to(roomId).emit("code-change", { code });
  });

  // ADDED: Logic for requesting the edit lock
  socket.on('request-edit-lock', ({ roomId }) => {
    // Grant lock only if the room is not already locked
    if (!roomLocks[roomId]) {
        roomLocks[roomId] = socket.id;
        // Broadcast the new lock status to everyone in the room
        io.to(roomId).emit('lock-status-update', {
            lockedBy: socket.id,
            username: userSocketMap[socket.id],
        });
    }
  });

  // ADDED: Logic for releasing the edit lock
  socket.on('release-edit-lock', ({ roomId }) => {
    // Release lock only if the requester is the current lock holder
    if (roomLocks[roomId] === socket.id) {
        delete roomLocks[roomId];
        // Broadcast the new (unlocked) status to everyone
        io.to(roomId).emit('lock-status-update', {
            lockedBy: null,
            username: null,
        });
    }
  });


  // CRITICAL UPDATE: Auto-release lock on disconnect
  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      // If the disconnecting user holds the lock, release it
      if (roomLocks[roomId] === socket.id) {
          delete roomLocks[roomId];
          // Broadcast the unlocked status to the remaining users
          socket.to(roomId).emit('lock-status-update', {
            lockedBy: null,
            username: null,
          });
      }

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