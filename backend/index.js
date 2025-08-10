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

// This is a standard Express middleware for general CORS, which is good practice.
app.use(cors({ origin: frontendURL }));

// This is the specific CORS configuration for Socket.IO.
const io = new Server(server, {
  cors: {
    origin: frontendURL, // The URL of your Vercel frontend
    methods: ["GET", "POST"], // Allowed methods
  },
});


// =================================================================
//                SOCKET.IO REAL-TIME LOGIC
// =================================================================

const userSocketMap = {};

function getAllConnectedClients(roomId) {
  const socketIds = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
  return socketIds.map((socketId) => ({
    socketId,
    username: userSocketMap[socketId],
  }));
}

io.on("connection", (socket) => {
  console.log("BACKEND LOG: A user connected, socket ID:", socket.id);

  socket.on("join", ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    socket.join(roomId);

    const clients = getAllConnectedClients(roomId);
    console.log(`BACKEND LOG: User ${username} joined room ${roomId}.`);
    
    // Notify all clients in the room that a new user has joined.
    clients.forEach(({ socketId }) => {
      // *** FINAL DEBUG LOG ***
      console.log(`BACKEND LOG: Attempting to send 'joined' event to ${socketId}`);
      io.to(socketId).emit("joined", {
        clients,
        username,
        socketId: socket.id,
      });
    });
  });

  socket.on("code-change", ({ roomId, code }) => {
    socket.to(roomId).emit("code-change", { code });
  });

  socket.on('typing', ({ roomId, username }) => {
    // *** FINAL DEBUG LOG ***
    console.log(`BACKEND LOG: Received 'typing' from ${username}, broadcasting to room ${roomId}`);
    socket.to(roomId).emit('typing', { username });
  });

  socket.on("sync-code", ({ socketId, code }) => {
    io.to(socketId).emit("code-change", { code });
  });

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      socket.in(roomId).emit("disconnected", {
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