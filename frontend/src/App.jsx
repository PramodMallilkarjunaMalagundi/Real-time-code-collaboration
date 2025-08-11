// =================================================================
//                      FINAL, COMPLETE App.jsx
// =================================================================

import { useEffect, useState, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";

const SERVER_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

function App() {
  // --- STATE MANAGEMENT (ALL UI ELEMENTS RESTORED) ---
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [joined, setJoined] = useState(false);
  const [clients, setClients] = useState([]);
  const [code, setCode] = useState("// Start coding here...");
  const [language, setLanguage] = useState("javascript");
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState("");
  const [copySuccess, setCopySuccess] = useState("");
  
  // State for the simple "is typing" indicator
  const [typingUser, setTypingUser] = useState(null);

  // --- REFS ---
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // --- SIDE EFFECTS & SOCKET HANDLING ---
  useEffect(() => {
    if (!joined) return;

    const socket = io(SERVER_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`Connected to server with ID: ${socket.id}`);
    });

    socket.emit("join", { roomId, username: userName });

    // --- EVENT LISTENERS ---
    socket.on("joined", ({ clients: serverClients }) => {
      setClients(serverClients);
    });

    socket.on("code-change", ({ code: newCode }) => {
      setCode(newCode);
    });

    socket.on('typing', ({ username }) => {
      // Don't show the "is typing" message for yourself
      if (username !== userName) {
        setTypingUser(username);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setTypingUser(null);
        }, 2000); // "is typing" message disappears after 2 seconds
      }
    });

    socket.on("disconnected", ({ socketId }) => {
      setClients((prevClients) => prevClients.filter((client) => client.socketId !== socketId));
    });

    // --- CLEANUP ---
    return () => {
      if (socket) socket.disconnect();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [joined, roomId, userName]);


  // --- EVENT HANDLERS (ALL HANDLERS RESTORED) ---
  const handleJoinRoom = () => { if (roomId.trim() && userName.trim()) setJoined(true); };

  const handleLeaveRoom = () => {
    setJoined(false);
    setRoomId(""); setUserName(""); setClients([]); setCode("// Start coding here...");
    setTypingUser(null);
  };
  
  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopySuccess("Copied!");
    setTimeout(() => setCopySuccess(""), 2000);
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (socketRef.current) {
      // Send the code change on every keystroke
      socketRef.current.emit("code-change", { roomId, code: newCode });
      // Also send a "typing" event so others can see the indicator
      socketRef.current.emit('typing', { roomId, username: userName });
    }
  };
  
  const handleRunCode = () => {
    setOutput("Executing...");
    if (socketRef.current) {
      socketRef.current.emit("compileCode", { code, roomId, language, stdin });
    }
  };

  // --- RENDER LOGIC ---
  return (
    <div className="app-container">
      {/* --- JOIN MODAL --- */}
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

      {/* --- MAIN EDITOR PAGE --- */}
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
            {typingUser ? (
              <>
                <strong>{typingUser}</strong> is typing...
              </>
            ) : (
              '\u00A0' // Non-breaking space to maintain layout
            )}
          </div>
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
              minimap: { enabled: false },
              fontSize: 16,
              wordWrap: 'on'
            }}
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