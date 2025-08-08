// =================================================================
//                      IMPORTS AND SETUP
// =================================================================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors"); // Import the cors package

const app = express();
const server = http.createServer(app);

// Get the frontend URL from environment variables for production,
// with a fallback for local development.
const frontendURL = process.env.FRONTEND_URL || "http://localhost:3000";

// =================================================================
//             MIDDLEWARE AND CORS CONFIGURATION
// =================================================================

// 1. Set up Express CORS Middleware
// This allows your Express server to accept requests from your frontend.
app.use(cors({
    origin: frontendURL,
}));


// 2. Set up Socket.IO CORS Configuration
// This allows the WebSocket connection to be established from your frontend.
const io = new Server(server, {
  cors: {
    origin: frontendURL, // The URL of your Vercel frontend
    methods: ["GET", "POST"], // Allowed methods
  },
});


// =================================================================
//                SOCKET.IO REAL-TIME LOGIC
//         (This is where your existing logic lives)
// =================================================================

// This object will store which users are in which rooms.
const userSocketMap = {};

function getAllConnectedClients(roomId) {
  // This gets a list of all socket IDs in a room.
  const socketIds = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
  // We then map these socket IDs to their usernames.
  return socketIds.map((socketId) => {
    return {
      socketId,
      username: userSocketMap[socketId],
    };
  });
}

io.on("connection", (socket) => {
  console.log("A user connected, socket ID:", socket.id);

  // 'JOIN' event: When a user wants to join a room
  socket.on("join", ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    socket.join(roomId);

    const clients = getAllConnectedClients(roomId);
    console.log(`User ${username} joined room ${roomId}. Clients in room:`, clients);
    
    // Notify all clients in the room that a new user has joined.
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit("joined", {
        clients,
        username,
        socketId: socket.id,
      });
    });
  });

  // 'CODE_CHANGE' event: When code is updated in the editor
  socket.on("code-change", ({ roomId, code }) => {
    // Broadcast the code change to all other clients in the same room.
    socket.in(roomId).emit("code-change", { code });
  });

  // =================================================================
  //        *** NEW CODE BLOCK FOR TYPING INDICATOR ***
  // =================================================================
  // 'TYPING' event: When a user starts typing in the editor
  socket.on('typing', ({ roomId, username }) => {
    // Broadcast to all other clients in the room that this user is typing.
    socket.to(roomId).emit('typing', { username });
  });
  // =================================================================

  // 'SYNC_CODE' event: When a new user joins, get the current code
  socket.on("sync-code", ({ socketId, code }) => {
    io.to(socketId).emit("code-change", { code });
  });

  // 'disconnecting' event: When a user starts to disconnect
  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      // For each room the user is in, notify others that they are leaving.
      socket.in(roomId).emit("disconnected", {
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

// Use the port provided by Render, or 5000 for local development.
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`Server is running on port ${PORT}`)
);