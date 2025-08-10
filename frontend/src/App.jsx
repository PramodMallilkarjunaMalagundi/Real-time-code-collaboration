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

  // ADDED: State for typing indicator
  const [typingUser, setTypingUser] = useState("");
  
  // --- REFS ---
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null); // Ref to manage the typing timeout

  // --- SIDE EFFECTS & SOCKET HANDLING ---
  useEffect(() => {
    if (!joined) return;

    const socket = io(SERVER_URL);
    socketRef.current = socket;

    socket.emit("join", { roomId, username: userName });

    socket.on("joined", ({ clients: serverClients }) => {
      setClients(serverClients);
    });

    socket.on("code-change", ({ code: newCode }) => {
      setCode(newCode);
    });

    // ADDED: Listener for typing indicator
    socket.on('typing', ({ username }) => {
      // Don't show typing indicator for myself
      if (username !== userName) {
        setTypingUser(username);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          setTypingUser("");
        }, 2000); // Hide indicator after 2 seconds of inactivity
      }
    });

    // ADDED: Listener for language synchronization
    socket.on('language-change', ({ language: newLanguage }) => {
      setLanguage(newLanguage);
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
  };
  
  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopySuccess("Copied!");
    setTimeout(() => setCopySuccess(""), 2000);
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (socketRef.current) {
      socketRef.current.emit("code-change", { roomId, code: newCode });
      // Emit typing event on code change
      socketRef.current.emit("typing", { roomId, username: userName });
    }
  };

  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    // We update the state locally immediately for a responsive feel,
    // but the server will send back the authoritative state.
    setLanguage(newLanguage);
    if (socketRef.current) {
      // Tell the server about the language change so it can broadcast
      socketRef.current.emit("language-change", { roomId, language: newLanguage });
    }
  };

  const handleRunCode = () => { /* ... */ };


  // --- RENDER LOGIC ---
  if (!joined) {
    return (
      <div className="join-modal-overlay">
        <div className="join-modal-content">
          <h1>Real-Time Code Editor</h1>
          <input type="text" placeholder="Enter Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} onKeyUp={(e) => e.key === 'Enter' && handleJoinRoom()} />
          <input type="text" placeholder="Enter Your Name" value={userName} onChange={(e) => setUserName(e.target.value)} onKeyUp={(e) => e.key === 'Enter' && handleJoinRoom()} />
          <button className="btn btn-join" onClick={handleJoinRoom}>Join Room</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
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
             {/* Typing Indicator UI */}
            <p className="typing-indicator">
              {typingUser ? `${typingUser} is typing...` : "\u00A0"}
            </p>
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
            options={{ minimap: { enabled: false }, fontSize: 16, wordWrap: 'on' }}
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
    </div>
  );
}

export default App;