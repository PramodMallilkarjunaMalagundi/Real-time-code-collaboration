import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import axios from "axios";

const app = express();
const server = http.createServer(app);

// --- RENDER.COM DEPLOYMENT HELPER ---
// This keeps your free Render.com instance from sleeping.
const url = `https://real-time-code-collaboration-and-code.onrender.com`;
const interval = 14 * 60 * 1000; // Ping every 14 minutes

function selfPing() {
  axios
    .get(url)
    .then((response) => {
      console.log("Ping successful: Website is awake.");
    })
    .catch((error) => {
      console.error(`Ping failed: ${error.message}`);
    });
}

// Don't ping in a local environment
if (process.env.NODE_ENV === "production") {
  setInterval(selfPing, interval);
}


// --- SOCKET.IO SERVER SETUP ---
const io = new Server(server, {
  cors: {
    origin: "*", // Allows connections from any origin
    methods: ["GET", "POST"],
  },
});

// Using a Map to store rooms and the users in them (as a Set for uniqueness)
const rooms = new Map();

io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);

  let currentRoom = null;
  let currentUser = null;

  // --- JOIN ROOM LOGIC ---
  socket.on("join", ({ roomId, userName }) => {
    // If user is already in a room, handle leaving it first
    if (currentRoom) {
      socket.leave(currentRoom);
      const userSet = rooms.get(currentRoom);
      if (userSet) {
        userSet.delete(currentUser);
        io.to(currentRoom).emit("userJoined", Array.from(userSet));
      }
    }

    currentRoom = roomId;
    currentUser = userName;

    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(userName);

    // Broadcast the updated user list to everyone in the room
    io.to(roomId).emit("userJoined", Array.from(rooms.get(roomId)));
    console.log(`User ${userName} joined room ${roomId}. Users:`, Array.from(rooms.get(roomId)));
  });

  // --- REAL-TIME EVENT HANDLERS ---
  socket.on("codeChange", ({ roomId, code }) => {
    socket.to(roomId).emit("codeUpdate", code);
  });

  socket.on("typing", ({ roomId, userName }) => {
    socket.to(roomId).emit("userTyping", userName);
  });

  socket.on("languageChange", ({ roomId, language }) => {
    io.to(roomId).emit("languageUpdate", language);
  });

  // --- CODE COMPILATION WITH STDIN ---
  socket.on("compileCode", async ({ code, roomId, language, version, stdin }) => {
    console.log(`Compile request for Room ${roomId}:`, { language, stdin });

    if (!rooms.has(roomId)) {
      return; // Room doesn't exist
    }

    try {
      const response = await axios.post(
        "https://emkc.org/api/v2/piston/execute",
        {
          language: language,
          version: version,
          files: [{ content: code }],
          stdin: stdin, // Pass the user's input to the API
        }
      );
      // Send the entire response back to all clients in the room
      io.to(roomId).emit("codeResponse", response.data);
    } catch (error) {
      console.error("Piston API Error:", error.response ? error.response.data : error.message);
      // Send a user-friendly error message back to the client
      io.to(roomId).emit("codeResponse", {
        run: { output: `Error: Could not execute code. ${error.response?.data?.message || ''}` },
      });
    }
  });

  // --- LEAVE & DISCONNECT LOGIC ---
  const handleLeave = () => {
    if (currentRoom && currentUser) {
      const userSet = rooms.get(currentRoom);
      if (userSet) {
        userSet.delete(currentUser);
        // If the room is now empty, delete it
        if (userSet.size === 0) {
          rooms.delete(currentRoom);
          console.log(`Room ${currentRoom} is now empty and has been closed.`);
        } else {
          // Otherwise, just update the user list for remaining users
          io.to(currentRoom).emit("userJoined", Array.from(userSet));
          console.log(`User ${currentUser} left room ${currentRoom}. Users:`, Array.from(userSet));
        }
      }
      socket.leave(currentRoom);
    }
    currentRoom = null;
    currentUser = null;
  };

  socket.on("leaveRoom", handleLeave);
  socket.on("disconnect", () => {
    handleLeave();
    console.log("User Disconnected:", socket.id);
  });
});

// --- EXPRESS STATIC FILE SERVING ---
const port = process.env.PORT || 5000;
const __dirname = path.resolve();

// Serve the built React app from the 'frontend/dist' directory
app.use(express.static(path.join(__dirname, "/frontend/dist")));

// For any other route, serve the index.html file (for client-side routing)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});