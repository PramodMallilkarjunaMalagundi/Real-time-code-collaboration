const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const frontendURL = process.env.FRONTEND_URL;

const io = new Server(server, {
  cors: {
    origin: frontendURL,
    methods: ["GET", "POST"],
  },
});

const userSocketMap = {};

function getAllConnectedClients(roomId) {
  const room = io.sockets.adapter.rooms.get(roomId);
  if (!room) return [];
  const socketIds = Array.from(room);
  return socketIds.map((socketId) => ({
    socketId,
    username: userSocketMap[socketId],
  }));
}

io.on("connection", (socket) => {
  console.log(`BACKEND LOG [1]: A user connected. Socket ID: ${socket.id}`);

  socket.on("join", ({ roomId, username }) => {
    console.log(`BACKEND LOG [2]: Received 'join' event from '${username}' for room '${roomId}'.`);
    
    userSocketMap[socket.id] = username;
    socket.join(roomId);
    console.log(`BACKEND LOG [3]: Socket ${socket.id} has now officially joined room '${roomId}'.`);

    const clients = getAllConnectedClients(roomId);
    console.log(`BACKEND LOG [4]: The room now contains ${clients.length} client(s).`);

    // The single most important test: broadcasting the 'joined' event
    console.log(`BACKEND LOG [5]: ATTEMPTING TO BROADCAST 'joined' to everyone in room '${roomId}'...`);
    io.to(roomId).emit("joined", { clients });
    console.log(`BACKEND LOG [6]: Broadcast command for 'joined' has been executed.`);
  });

  socket.on("code-change", ({ roomId, code }) => {
    socket.to(roomId).emit("code-change", { code });
  });

  // All other events are simplified for this test
  socket.on("disconnecting", () => {
    delete userSocketMap[socket.id];
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));