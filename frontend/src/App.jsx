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

  // State for editor lock mechanism
  const [isEditorLocked, setIsEditorLocked] = useState(false);
  const [lockHolder, setLockHolder] = useState(null);
  const [mySocketId, setMySocketId] = useState(null);

  // --- REFS ---
  const socketRef = useRef(null);

  // --- SIDE EFFECTS & SOCKET HANDLING ---
  useEffect(() => {
    if (!joined) return;

    const socket = io(SERVER_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      setMySocketId(socket.id);
    });

    socket.emit("join", { roomId, username: userName });

    socket.on("joined", ({ clients: serverClients }) => {
      setClients(serverClients);
    });

    socket.on("code-change", ({ code: newCode }) => {
      setCode(newCode);
    });

    socket.on('lock-status-update', ({ lockedBy, username }) => {
      setLockHolder(username);
      const amILockHolder = lockedBy === socket.id;
      setIsEditorLocked(lockedBy !== null && !amILockHolder);
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
    setJoined(false);
    setRoomId(""); setUserName(""); setClients([]);
    setCode("// Start coding here...");
    setLockHolder(null); setIsEditorLocked(false);
  };
  
  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopySuccess("Copied!");
    setTimeout(() => setCopySuccess(""), 2000);
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (socketRef.current && !isEditorLocked) {
      socketRef.current.emit("code-change", { roomId, code: newCode });
    }
  };

  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    if (socketRef.current) {
        socketRef.current.emit("languageChange", { roomId, language: newLanguage });
    }
  };

  const handleRunCode = () => { /* ... */ };

  const handleRequestLock = () => {
    if (socketRef.current) socketRef.current.emit('request-edit-lock', { roomId });
  };
  const handleReleaseLock = () => {
    if (socketRef.current) socketRef.current.emit('release-edit-lock', { roomId });
  };


  // --- RENDER LOGIC ---

  // UPDATED: Reverted to the original inline join page UI
  if (!joined) {
    return (
      <div className="join-page-wrapper">
        <div className="join-form-wrapper">
          <h1 className="join-page-title">Real-Time Code Editor</h1>
          <div className="join-input-group">
            <input
              type="text"
              className="join-input"
              placeholder="Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyUp={(e) => e.key === 'Enter' && handleJoinRoom()}
            />
            <input
              type="text"
              className="join-input"
              placeholder="Your Name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onKeyUp={(e) => e.key === 'Enter' && handleJoinRoom()}
            />
            <button className="btn btn-join" onClick={handleJoinRoom}>Join Room</button>
          </div>
          <p className="join-page-info">Enter a Room ID and name to start collaborating.</p>
        </div>
      </div>
    );
  }

  const amILockHolder = lockHolder === userName;

  // The editor page JSX remains the same
  return (
    <div className="editor-container">
        {/* ... This part is unchanged ... */}
        {/* ... All sidebar and editor JSX ... */}
    </div>
  );
}

export default App;