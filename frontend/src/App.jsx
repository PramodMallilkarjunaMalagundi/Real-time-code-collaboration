import { useEffect, useState, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";

const SERVER_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

function App() {
  // --- STATE AND REFS ---
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [clients, setClients] = useState([]);
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("// Start coding here...");
  const [isEditorLocked, setIsEditorLocked] = useState(false);
  const [lockHolder, setLockHolder] = useState(null);
  
  const socketRef = useRef(null);
  const stopTypingTimeoutRef = useRef(null);

  // --- SOCKET.IO LOGIC ---
  useEffect(() => {
    if (!joined) return;

    const socket = io(SERVER_URL);
    socketRef.current = socket;

    socket.emit("join", { roomId, username: userName });

    socket.on("joined", ({ clients: serverClients }) => setClients(serverClients));
    socket.on("code-change", ({ code: newCode }) => setCode(newCode));
    socket.on("language-update", (newLanguage) => setLanguage(newLanguage));
    socket.on('lock-status-update', ({ lockedBy, username }) => {
      setLockHolder(username);
      setIsEditorLocked(lockedBy !== null && lockedBy !== socket.id);
    });
    socket.on("disconnected", ({ socketId }) => {
      setClients((prevClients) => prevClients.filter((client) => client.socketId !== socketId));
    });

    return () => {
      socket.disconnect();
      if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current);
    };
  }, [joined, roomId, userName]);

  // --- EVENT HANDLERS ---
  const handleJoinRoom = () => { if (roomId.trim() && userName.trim()) setJoined(true); };
  const handleLeaveRoom = () => {
    if (lockHolder === userName && socketRef.current) socketRef.current.emit('stop-typing-lock', { roomId });
    setJoined(false);
    // ... reset state ...
  };
  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    if (socketRef.current) socketRef.current.emit("language-change", { roomId, language: newLanguage });
  };
  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (!isEditorLocked && socketRef.current) {
      if (!lockHolder) socketRef.current.emit('start-typing-lock', { roomId });
      socketRef.current.emit("code-change", { roomId, code: newCode });
      if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current);
      stopTypingTimeoutRef.current = setTimeout(() => {
        if (socketRef.current) socketRef.current.emit('stop-typing-lock', { roomId });
      }, 2000);
    }
  };

  // --- RENDER LOGIC ---
  return (
    // CORRECTED: This wrapper is necessary for the blur effect
    <div className="app-container">
      {/* The main editor is always present */}
      <div className={`editor-container ${!joined ? 'blurred' : ''}`}>
        <div className="sidebar">
          {/* ... Sidebar content ... */}
          <div className="room-info">
            <h2>Room: {roomId || '...'}</h2>
          </div>
          <h3>Users ({clients.length})</h3>
          <ul className="user-list">
            {clients.map((client) => (
              <li className="client-item" key={client.socketId}>
                <div className="avatar">{client.username.charAt(0).toUpperCase()}</div>
                <span>{client.username}</span>
              </li>
            ))}
          </ul>
          <div className="typing-indicator">
             {lockHolder ? `${lockHolder} is typing...` : '\u00A0' }
          </div>
          <div className="sidebar-footer">
            <select className="language-selector" value={language} onChange={handleLanguageChange}>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
            </select>
            <button className="btn btn-secondary leave-btn" onClick={handleLeaveRoom}>Leave Room</button>
          </div>
        </div>
        <div className="editor-wrapper">
          <Editor
            height="100%"
            language={language}
            value={code}
            onChange={handleCodeChange}
            theme="vs-dark"
            options={{ readOnly: isEditorLocked, minimap: { enabled: false }, fontSize: 16, wordWrap: 'on' }}
          />
        </div>
      </div>
      {/* The join modal overlays everything if not joined */}
      {!joined && (
        <div className="join-modal-overlay">
          <div className="join-modal-content">
            <h1>Real-Time Code Editor</h1>
            <input type="text" placeholder="Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} onKeyUp={(e) => e.key === 'Enter' && handleJoinRoom()} />
            <input type="text" placeholder="Your Name" value={userName} onChange={(e) => setUserName(e.target.value)} onKeyUp={(e) => e.key === 'Enter' && handleJoinRoom()} />
            <button className="btn-join" onClick={handleJoinRoom}>Join Room</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;