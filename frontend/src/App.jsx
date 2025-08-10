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

  // State for the automatic typing lock
  const [isEditorLocked, setIsEditorLocked] = useState(false);
  const [lockHolder, setLockHolder] = useState(null); // Username of the person typing
  const [mySocketId, setMySocketId] = useState(null);

  // --- REFS ---
  const socketRef = useRef(null);
  const stopTypingTimeoutRef = useRef(null); // Ref for the "stop typing" timer

  // --- SIDE EFFECTS & SOCKET HANDLING ---
  useEffect(() => {
    if (!joined) return;

    const socket = io(SERVER_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      setMySocketId(socket.id);
    });

    socket.emit("join", { roomId, username: userName });

    socket.on("joined", ({ clients: serverClients }) => setClients(serverClients));
    socket.on("code-change", ({ code: newCode }) => setCode(newCode));

    socket.on('lock-status-update', ({ lockedBy, username }) => {
        setLockHolder(username);
        setIsEditorLocked(lockedBy !== null && lockedBy !== socket.id);
    });

    socket.on("disconnected", ({ socketId }) => {
      setClients((prevClients) => prevClients.filter((client) => client.socketId !== socketId));
    });

    return () => {
      socket.disconnect();
      socket.off();
    };
  }, [joined, roomId, userName]);


  // --- EVENT HANDLERS ---
  const handleJoinRoom = () => { if (roomId.trim() && userName.trim()) setJoined(true); };
  
  const handleLeaveRoom = () => {
    // Before leaving, if this user holds the lock, release it
    if (lockHolder === userName && socketRef.current) {
        socketRef.current.emit('stop-typing-lock', { roomId });
    }
    setJoined(false);
    // ... reset other state ...
  };
  
  const handleCodeChange = (newCode) => {
    // You can always update your own local code state
    setCode(newCode);

    // But only send socket events if you have permission
    if (!isEditorLocked && socketRef.current) {
        // If this is the first character typed (i.e., we don't have the lock yet)
        // immediately request it.
        if (!lockHolder) {
            socketRef.current.emit('start-typing-lock', { roomId });
        }
        
        // Send the code change
        socketRef.current.emit("code-change", { roomId, code: newCode });

        // Set up a timer to automatically release the lock when typing stops
        if (stopTypingTimeoutRef.current) {
            clearTimeout(stopTypingTimeoutRef.current);
        }
        stopTypingTimeoutRef.current = setTimeout(() => {
            socketRef.current.emit('stop-typing-lock', { roomId });
        }, 2000); // Release lock after 2 seconds of inactivity
    }
  };


  // --- RENDER LOGIC ---
  if (!joined) {
    return ;
  }

  return (
    <div className="editor-container">
      <div className="sidebar">
        {/* ... Room info, users list, language selector, etc. ... */}
        
        {/* UPDATED: Simplified UI for lock status */}
        <div className="lock-manager">
          <p className="lock-status">
            Editor locked by: <strong>{lockHolder || 'None'}</strong>
          </p>
          {!isEditorLocked && lockHolder === userName && (
             <p className="lock-hint">(You have the lock)</p>
          )}
        </div>

        {/* ... The rest of the sidebar ... */}
      </div>

      <div className="editor-wrapper">
        <Editor
          height="70%" // Increased height slightly
          language={language}
          value={code}
          onChange={handleCodeChange}
          theme="vs-dark"
          options={{ 
              readOnly: isEditorLocked, 
              minimap: { enabled: false }, 
              fontSize: 16, 
              wordWrap: 'on' 
          }}
        />
        {/* ... IO wrapper and Execute button ... */}
      </div>
    </div>
  );
}

export default App;