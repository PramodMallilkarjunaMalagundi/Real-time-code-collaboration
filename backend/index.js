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
);```

---

### **Step 2: Update Your Frontend (`frontend/src/App.jsx`)**

Now, we update the frontend to manage the editor's read-only state and provide buttons to request/release the lock.

**Action:** Replace the entire contents of your `frontend/src/App.jsx` file with this new code.

```jsx
import { useEffect, useState, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";

const SERVER_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

function App() {
  // --- STATE MANAGEMENT ---
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [joined, setJoined] = useState(false);
  const [clients, setClients] = useState([]); 
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("// Start coding here...");
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState("");
  const [copySuccess, setCopySuccess] = useState("");

  // ADDED: State to manage the editor lock
  const [isEditorLocked, setIsEditorLocked] = useState(false);
  const [lockHolder, setLockHolder] = useState(null); // Stores the username of the lock holder

  // --- REFS ---
  const socketRef = useRef(null);

  // --- SIDE EFFECTS & SOCKET HANDLING ---
  useEffect(() => {
    if (!joined) return;

    const socket = io(SERVER_URL);
    socketRef.current = socket;

    socket.emit("join", { roomId, userName });

    socket.on("joined", ({ clients: serverClients }) => {
      setClients(serverClients); 
    });

    socket.on("code-change", ({ code: newCode }) => {
      setCode(newCode);
    });
    
    // ADDED: Listener for lock status updates from the server
    socket.on('lock-status-update', ({ lockedBy, username }) => {
        setLockHolder(username); // Update who is displayed as the editor
        // The editor is locked if someone has the lock AND that someone is not me
        const amILockHolder = lockedBy === socket.id;
        setIsEditorLocked(lockedBy !== null && !amILockHolder);
    });

    socket.on("disconnected", ({ socketId, username }) => {
      setClients((prevClients) => prevClients.filter((client) => client.socketId !== socketId));
    });

    // ... other listeners like languageUpdate, codeResponse ...

    // --- CLEANUP LOGIC ---
    return () => {
      socket.disconnect();
      socket.off(); // Removes all listeners for this socket
    };
  }, [joined, roomId, userName]);


  // --- EVENT HANDLERS ---
  const handleJoinRoom = () => { if (roomId.trim() && userName.trim()) setJoined(true); };
  
  const handleLeaveRoom = () => {
    setJoined(false);
    // Reset all relevant state
    setRoomId("");
    setUserName("");
    setClients([]);
    setCode("// Start coding here...");
    setLanguage("javascript");
    setOutput("");
    setStdin("");
    setLockHolder(null);
    setIsEditorLocked(false);
  };
  
  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopySuccess("Copied!");
    setTimeout(() => setCopySuccess(""), 2000);
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    // Only send code changes if the editor is not locked for this client
    if (socketRef.current && !isEditorLocked) {
      socketRef.current.emit("code-change", { roomId, code: newCode });
    }
  };

  // ADDED: Handlers for requesting and releasing the lock
  const handleRequestLock = () => {
    if (socketRef.current) socketRef.current.emit('request-edit-lock', { roomId });
  };
  const handleReleaseLock = () => {
    if (socketRef.current) socketRef.current.emit('release-edit-lock', { roomId });
  };

  const handleRunCode = () => { /* ... run code logic ... */ };
  
  // --- RENDER LOGIC ---
  if (!joined) {
    return (
      <div className="join-container">
        <div className="join-form">
          <h1>Real-Time Code Editor</h1>
          <input
            type="text"
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            onKeyUp={(e) => e.key === 'Enter' && handleJoinRoom()}
          />
          <input
            type="text"
            placeholder="Your Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onKeyUp={(e) => e.key === 'Enter' && handleJoinRoom()}
          />
          <button onClick={handleJoinRoom}>Join Room</button>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <div className="sidebar">
        <div className="room-info">
          <h2>Room: {roomId}</h2>
          <button onClick={handleCopyRoomId} className="copy-button">
            {copySuccess || "Copy ID"}
          </button>
        </div>
        
        <h3>Users ({clients.length})</h3>
        <ul className="user-list">
          {clients.map((client) => (
            <li key={client.socketId}>{client.username}</li>
          ))}
        </ul>
        
        {/* ADDED: New UI for lock management */}
        <div className="lock-manager">
          <p className="lock-status">
            Editing locked by: <strong>{lockHolder || 'None'}</strong>
          </p>
          <div className="lock-buttons">
            <button onClick={handleRequestLock} disabled={lockHolder}>Request Edit</button>
            <button onClick={handleReleaseLock} disabled={!lockHolder || isEditorLocked}>Release Edit</button>
          </div>
        </div>

        <select
          className="language-selector"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="cpp">C++</option>
        </select>
        <button className="leave-button" onClick={handleLeaveRoom}>
          Leave Room
        </button>
      </div>

      <div className="editor-wrapper">
        <Editor
          height="55%"
          language={language}
          value={code}
          onChange={handleCodeChange}
          theme="vs-dark"
          // UPDATED: The 'readOnly' option is now controlled by our state
          options={{ 
              readOnly: isEditorLocked, 
              minimap: { enabled: false }, 
              fontSize: 16, 
              wordWrap: 'on' 
          }}
        />
        <div className="io-wrapper">
          <div className="input-area">
            <h4>Input </h4>
            <textarea
              className="io-console"
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder="Enter program input here..."
            />
          </div>
          <div className="output-area">
            <h4>Output</h4>
            <textarea
              className="io-console"
              value={output}
              readOnly
              placeholder="Output will appear here..."
            />
          </div>
        </div>
        <button className="run-btn" onClick={handleRunCode}>
          Execute Code
        </button>
      </div>
    </div>
  );
}

export default App;