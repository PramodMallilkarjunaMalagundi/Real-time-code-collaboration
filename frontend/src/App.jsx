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

  // State for automatic typing lock
  const [isEditorLocked, setIsEditorLocked] = useState(false);
  const [lockHolder, setLockHolder] = useState(null); // Username of the person typing

  // --- REFS ---
  const socketRef = useRef(null);
  const stopTypingTimeoutRef = useRef(null); // Ref for the "stop typing" timer

  // --- SIDE EFFECTS & SOCKET HANDLING ---
  useEffect(() => {
    if (!joined) return;

    const socket = io(SERVER_URL);
    socketRef.current = socket;
    let my_socket_id = '';
    socket.on('connect', () => { my_socket_id = socket.id; });

    socket.emit("join", { roomId, username: userName });

    socket.on("joined", ({ clients: serverClients }) => setClients(serverClients));
    socket.on("code-change", ({ code: newCode }) => setCode(newCode));

    // Listen for lock status updates from the server
    socket.on('lock-status-update', ({ lockedBy, username }) => {
      setLockHolder(username);
      // The editor is locked if someone holds the lock, AND that someone is not me
      setIsEditorLocked(lockedBy !== null && lockedBy !== my_socket_id);
    });

    socket.on("disconnected", ({ socketId }) => {
      setClients((prevClients) => prevClients.filter((client) => client.socketId !== socketId));
    });

    return () => { socket.disconnect(); socket.off(); };
  }, [joined, roomId, userName]);


  // --- EVENT HANDLERS ---
  const handleJoinRoom = () => { if (roomId.trim() && userName.trim()) setJoined(true); };
  const handleLeaveRoom = () => {
    setJoined(false);
    setRoomId(""); setUserName(""); setClients([]);
    setCode("// Start coding here...");
    setLockHolder(null);
  };
  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopySuccess("Copied!");
    setTimeout(() => setCopySuccess(""), 2000);
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode); // Update my own editor immediately
    
    if (socketRef.current) {
      // If the editor is locked by someone else, don't send updates
      if (isEditorLocked) return;

      // Clear any existing "stop typing" timer
      if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current);

      // Tell the server I've started typing (this will try to acquire the lock)
      socketRef.current.emit('start-typing', { roomId });

      // Send the actual code change
      socketRef.current.emit("code-change", { roomId, code: newCode });

      // Set a new timer to automatically release the lock when I stop typing
      stopTypingTimeoutRef.current = setTimeout(() => {
        socketRef.current.emit('stop-typing', { roomId });
      }, 2500); // 2.5 second timeout
    }
  };

  const handleRunCode = () => { /* ... */ };

  // --- RENDER LOGIC ---
  if (!joined) {
    return ( /* ... Join Modal JSX is unchanged ... */ );
  }

  return (
    <div className={`app-container ${!joined ? 'blurred' : ''}`}>
      {!joined && ( /* ... Join Modal JSX ... */ )}
      <div className="editor-container">
        <div className="sidebar">
          <div className="room-info">
            <h2>Room: {roomId}</h2>
            <button onClick={handleCopyRoomId} className="btn btn-secondary">{copySuccess || "Copy ID"}</button>
          </div>
          <h3>Users ({clients.length})</h3>
          <ul className="user-list">
            {clients.map((client) => (
              <li key={client.socketId} className="client-item">
                <div className="avatar">{client.username.charAt(0).toUpperCase()}</div>
                <span className="username">{client.username}</span>
              </li>
            ))}
          </ul>
          {/* The typing indicator is now the lock status indicator */}
          <p className="typing-indicator">
            {lockHolder ? `${lockHolder} is typing...` : "\u00A0"}
          </p>
          <div className="sidebar-footer">
            <select className="language-selector" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
            </select>
            <button className="btn btn-secondary leave-btn" onClick={handleLeaveRoom}>Leave Room</button>
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
              <textarea className="io-console" value={stdin} onChange={(e) => setStdin(e.g.value)} placeholder="Enter program input here..." />
            </div>
            <div className="output-area">
              <h4>Output</h4>
              <textarea className="io-console" value={output} readOnly placeholder="Output will appear here..." />
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleRunCode}>Execute Code</button>
        </div>
      </div>
    </div>
  );
}

export default App;