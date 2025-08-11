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
// This object will now store who is the designated "typist" for each room.
const roomTypist = {}; 

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
    
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit("joined", { clients, username, socketId: socket.id });
    });

    // When a new user joins, tell them who the current typist is.
    const typistSocketId = roomTypist[roomId];
    const typistUsername = typistSocketId ? userSocketMap[typistSocketId] : null;
    socket.emit('typist-update', {
        socketId: typistSocketId,
        username: typistUsername,
    });
  });

  socket.on("code-change", ({ roomId, code }) => {
    // SERVER-SIDE ENFORCEMENT: Only broadcast code changes from the official typist.
    if (!roomTypist[roomId] || roomTypist[roomId] === socket.id) {
        // If the room has no typist, the first person to type becomes the typist.
        if (!roomTypist[roomId]) {
            roomTypist[roomId] = socket.id;
            io.to(roomId).emit('typist-update', {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });
        }
        socket.to(roomId).emit("code-change", { code });
    }
  });

  // When a user's client says they've stopped typing, release the typist role.
  socket.on('stop-typing', ({ roomId }) => {
    if (roomTypist[roomId] === socket.id) {
        delete roomTypist[roomId];
        io.to(roomId).emit('typist-update', {
            socketId: null,
            username: null,
        });
    }
  });

  socket.on("language-change", ({ roomId, language }) => {
    socket.to(roomId).emit("language-update", { language });
  });

  // Auto-release typist role on disconnect.
  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      if (roomTypist[roomId] === socket.id) {
          delete roomTypist[roomId];
          socket.to(roomId).emit('typist-update', {
            socketId: null,
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
});

// =================================================================
//                      START THE SERVER
// =================================================================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`Server is running on port ${PORT}`)
);