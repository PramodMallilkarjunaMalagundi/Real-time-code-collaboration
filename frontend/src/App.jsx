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

  // ADDED: State for editor lock mechanism
  const [isEditorLocked, setIsEditorLocked] = useState(false);
  const [lockHolder, setLockHolder] = useState(null); // Stores username of lock holder
  const [mySocketId, setMySocketId] = useState(null); // To check if I am the lock holder

  // --- REFS ---
  const socketRef = useRef(null);

  // --- SIDE EFFECTS & SOCKET HANDLING ---
  useEffect(() => {
    if (!joined) return;

    const socket = io(SERVER_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      setMySocketId(socket.id); // Store my own socket ID
    });

    socket.emit("join", { roomId, username: userName });

    socket.on("joined", ({ clients: serverClients }) => {
      setClients(serverClients);
    });

    socket.on("code-change", ({ code: newCode }) => {
      setCode(newCode);
    });

    // ADDED: Listener for lock status updates from the server
    socket.on('lock-status-update', ({ lockedBy, username }) => {
      setLockHolder(username);
      // The editor is locked if someone holds the lock, AND that someone is not me
      const amILockHolder = lockedBy === socket.id;
      setIsEditorLocked(lockedBy !== null && !amILockHolder);
    });

    socket.on("disconnected", ({ socketId }) => {
      setClients((prevClients) => prevClients.filter((client) => client.socketId !== socketId));
    });

    // ... your other listeners ...

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
    // Only update my own code state. The emit happens only if I have the lock.
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

  const handleRunCode = () => { /* ... run code logic ... */ };

  // ADDED: Handlers for lock mechanism
  const handleRequestLock = () => {
    if (socketRef.current) socketRef.current.emit('request-edit-lock', { roomId });
  };
  const handleReleaseLock = () => {
    if (socketRef.current) socketRef.current.emit('release-edit-lock', { roomId });
  };

  // --- RENDER LOGIC ---
  if (!joined) {
    return (
      // Using the new modal styles for the join form
      <div className="join-modal-overlay">
        <div className="join-modal-content">
          <h1>Real-Time Code Editor</h1>
          <input
            type="text"
            placeholder="Enter Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            onKeyUp={(e) => e.key === 'Enter' && handleJoinRoom()}
          />
          <input
            type="text"
            placeholder="Enter Your Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onKeyUp={(e) => e.key === 'Enter' && handleJoinRoom()}
          />
          <button className="btn btn-join" onClick={handleJoinRoom}>Join Room</button>
        </div>
      </div>
    );
  }

  // Determine if I am the current lock holder
  const amILockHolder = lockHolder === userName;

  return (
    <div className="editor-container">
      <div className="sidebar">
        <div className="room-info">
          <h2>Room: {roomId}</h2>
          <button onClick={handleCopyRoomId} className="btn btn-secondary">
            {copySuccess || "Copy ID"}
          </button>
        </div>

        <h3>Users ({clients.length})</h3>
        <ul className="user-list">
          {clients.map((client) => (
            <li key={client.socketId} className="client-item">
              <div className="avatar">
                {client.username ? client.username.charAt(0).toUpperCase() : '?'}
              </div>
              <span className="username">{client.username}</span>
            </li>
          ))}
        </ul>

        <div className="sidebar-footer">
          {/* Lock Manager UI */}
          <div className="lock-manager">
            <p className="lock-status">
              Editor locked by: <strong>{lockHolder || 'None'}</strong>
            </p>
            <div className="lock-buttons">
              <button className="btn btn-secondary" onClick={handleRequestLock} disabled={lockHolder}>Request Lock</button>
              <button className="btn btn-secondary" onClick={handleReleaseLock} disabled={!amILockHolder}>Release Lock</button>
            </div>
          </div>

          <select className="language-selector" value={language} onChange={handleLanguageChange}>
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
          </select>
          <button className="btn btn-secondary leave-btn" onClick={handleLeaveRoom}>
            Leave Room
          </button>
        </div>
      </div>

      <div className="editor-wrapper">
        <Editor
          height="55%"
          language={language}
          value={code}
          onChange={handleCodeChange}
          theme="vs-dark"
          options={{
            readOnly: isEditorLocked, // Editor is read-only if locked by someone else
            minimap: { enabled: false },
            fontSize: 16,
            wordWrap: 'on'
          }}
        />
        <div className="io-wrapper">
          <div className="input-area">
            <h4>Input</h4>
            <textarea className="io-console" value={stdin} onChange={(e) => setStdin(e.target.value)} placeholder="Enter program input here..." />
          </div>
          <div className="output-area">
            <h4>Output</h4>
            <textarea className="io-console" value={output} readOnly placeholder="Output will appear here..." />
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleRunCode}>
          Execute Code
        </button>
      </div>
    </div>
  );
}

export default App;