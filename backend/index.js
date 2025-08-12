// =================================================================
//                      FINAL BACKEND (All Features Including Execution)
// =================================================================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const axios = require("axios"); // ADDED: For making API requests

const app = express();
const server = http.createServer(app);
const frontendURL = process.env.FRONTEND_URL;

app.use(cors({ origin: frontendURL }));

const io = new Server(server, {
  cors: { origin: frontendURL, methods: ["GET", "POST"] },
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

// Helper object to map our language names to Piston API versions
const languageVersions = {
    javascript: "18.15.0",
    python: "3.10.0",
    java: "15.0.2",
    cpp: "10.2.0"
};

io.on("connection", (socket) => {
  socket.on("join", ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    socket.join(roomId);
    const clients = getAllConnectedClients(roomId);
    io.to(roomId).emit("joined", { clients, username, socketId: socket.id });
  });

  socket.on("code-change", ({ roomId, code }) => {
    socket.to(roomId).emit("code-change", { code });
  });

  socket.on('typing', ({ roomId, username }) => {
    socket.to(roomId).emit('typing', { username });
  });

  socket.on('language-change', ({ roomId, language }) => {
    socket.to(roomId).emit('language-change', { language });
  });

  // ADDED: Listener for the 'compileCode' event
  socket.on('compileCode', async ({ code, language, stdin }) => {
    try {
        const response = await axios.post('https://emkc.org/api/v2/piston/execute', {
            language: language,
            version: languageVersions[language] || "*", // Use mapped version or latest
            files: [{ content: code }],
            stdin: stdin,
        });

        // Send the result ONLY to the user who made the request
        socket.emit('code-response', response.data);

    } catch (error) {
        // Send an error message back to the user
        socket.emit('code-response', {
            run: {
                stderr: error.message,
            }
        });
    }
  });

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      socket.to(roomId).emit("disconnected", {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });
    });
    delete userSocketMap[socket.id];
    socket.leave();
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));