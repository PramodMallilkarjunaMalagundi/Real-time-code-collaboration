// =================================================================
//                      FINAL FRONTEND (All Features)
// =================================================================

import { useEffect, useState, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";
import { Toaster, toast } from 'react-hot-toast';

const SERVER_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

function App() {
  // --- STATE MANAGEMENT ---
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [joined, setJoined] = useState(false);
  const [clients, setClients] = useState([]);
  const [code, setCode] = useState("// Start coding here...");
  const [language, setLanguage] = useState("javascript");
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState("");
  const [copySuccess, setCopySuccess] = useState("");
  const [typingUser, setTypingUser] = useState(null);

  // --- REFS ---
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // --- SIDE EFFECTS & SOCKET HANDLING ---
  useEffect(() => {
    if (!joined) return;

    const socket = io(SERVER_URL);
    socketRef.current = socket;

    socket.emit("join", { roomId, username: userName });

    socket.on("joined", ({ clients: serverClients, username }) => {
      if (username !== userName) toast.success(`${username} joined the room.`);
      setClients(serverClients);
    });

    socket.on("code-change", ({ code: newCode }) => setCode(newCode));
    
    // ADDED: Listener for language changes
    socket.on("language-change", ({ language: newLanguage }) => {
        setLanguage(newLanguage);
    });

    socket.on('typing', ({ username }) => {
      if (username !== userName) {
        setTypingUser(username);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setTypingUser(null);
        }, 2000);
      }
    });

    socket.on("disconnected", ({ username }) => {
      if (username) toast.error(`${username} left the room.`);
      setClients((prevClients) => prevClients.filter((client) => client.username !== username));
    });

    return () => {
      if (socket) socket.disconnect();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [joined, roomId, userName]);


  // --- EVENT HANDLERS ---
  const handleJoinRoom = () => { if (roomId.trim() && userName.trim()) setJoined(true); };
  const handleLeaveRoom = () => { /* ... reset state ... */ setJoined(false); };
  
  // ADDED: The copy room ID handler is now back
  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopySuccess("Copied!");
    toast.success("Room ID copied!");
    setTimeout(() => setCopySuccess(""), 2000);
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (socketRef.current) {
      socketRef.current.emit("code-change", { roomId, code: newCode });
      socketRef.current.emit('typing', { roomId, username: userName });
    }
  };
  
  // ADDED: Handler to change language and notify others
  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    if (socketRef.current) {
        socketRef.current.emit('language-change', { roomId, language: newLanguage });
    }
  };

  const handleRunCode = () => { /* ... run code logic ... */ };

  // --- RENDER LOGIC ---
  return (
    <div className="app-container">
      <div><Toaster position="top-right" /></div>

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

      {/* UPDATED: Added the conditional 'blurred' class to this container */}
      <div className={`editor-container ${!joined ? 'blurred' : ''}`}>
        <div className="sidebar">
          <div className="room-info">
            <h2>Room: {roomId || '...'}</h2>
            <button className="btn btn-secondary" onClick={handleCopyRoomId}>
              {copySuccess || "Copy ID"}
            </button>
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
            {typingUser ? ( <><strong>{typingUser}</strong> is typing...</> ) : ( '\u00A0' )}
          </div>
          <div className="sidebar-footer">
            {/* UPDATED: This now uses the new event handler */}
            <select className="language-selector" value={language} onChange={handleLanguageChange}>
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
            options={{ minimap: { enabled: false }, fontSize: 16, wordWrap: 'on' }}
          />
          <div className="io-wrapper">
            <div className="input-area">
              <h4>Input </h4>
              <textarea className="io-console" value={stdin} onChange={(e) => setStdin(e.target.value)} placeholder="Enter program input here..." />
            </div>
            <div className="output-area">
              <h4>Output</h4>
              <textarea className="io-console" value={output} readOnly placeholder="Output will appear here..." />
            </div>
          </div>
          <button className="btn btn-primary run-btn" onClick={handleRunCode}>Execute Code</button>
        </div>
      </div>
    </div>
  );
}

export default App;