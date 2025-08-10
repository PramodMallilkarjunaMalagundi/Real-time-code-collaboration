const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const axios = require("axios"); // ADDED: Import axios

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
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit("joined", { clients, username, socketId: socket.id });
    });
  });

  socket.on("code-change", ({ roomId, code }) => {
    socket.to(roomId).emit("code-change", { code });
  });

  socket.on('typing', ({ roomId, username }) => {
    socket.to(roomId).emit('typing', { username });
  });

  // =================================================================
  //        *** NEW CODE EXECUTION LOGIC ***
  // =================================================================
  socket.on("compileCode", async ({ code, language, stdin }) => {
    console.log("BACKEND LOG: Received compileCode event for language:", language);
    const endpoint = "https://emkc.org/api/v2/piston/execute";
    
    // Piston API uses slightly different names for some languages
    const languageForApi = language === 'cpp' ? 'c++' : language;

    try {
      const response = await axios.post(endpoint, {
        language: languageForApi,
        version: "*", // Use the latest version
        files: [{ content: code }],
        stdin: stdin,
      });

      // Send the result back to the specific user who requested it
      socket.emit("codeResponse", response.data);
      console.log("BACKEND LOG: Sent codeResponse back to client.");

    } catch (error) {
      console.error("BACKEND LOG: Error calling Piston API:", error.response ? error.response.data : error.message);
      // Send an error message back to the client
      socket.emit("codeResponse", { 
        run: { 
          output: "Error executing code. Please check the server logs.",
          stderr: error.message 
        } 
      });
    }
  });
  // =================================================================

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

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`Server is running on port ${PORT}`)
);