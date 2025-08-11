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
  const [code, setCode] = useState("// Start coding here...");
  const [language, setLanguage] = useState("javascript");
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState("");
  
  const [isEditorLocked, setIsEditorLocked] = useState(false);
  const [lockHolder, setLockHolder] = useState(null);

  // --- REFS ---
  const socketRef = useRef(null);
  const stopTypingTimeoutRef = useRef(null);

  // --- SIDE EFFECTS & SOCKET HANDLING ---
  useEffect(() => {
    // This effect handles the entire connection lifecycle based on `joined` state.
    if (!joined) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = io(SERVER_URL);
    socketRef.current = socket;

    // This is the primary listener. It only runs once the connection is confirmed.
    socket.on('connect', () => {
      // Now we know `socket.id` is valid and stable.
      console.log("CLIENT LOG: Connected to server with ID:", socket.id);

      // We set up all other event listeners INSIDE this connect block.
      // This guarantees they are created in a scope where socket.id is correct.
      socket.on("joined", ({ clients: serverClients }) => {
        setClients(serverClients);
      });

      socket.on("code-change", ({ code: newCode }) => {
        setCode(newCode);
      });

      socket.on('lock-status-update', ({ lockedBy, username }) => {
        setLockHolder(username);
        // This check is now 100% reliable.
        setIsEditorLocked(lockedBy !== null && lockedBy !== socket.id);
      });

      socket.on("disconnected", ({ socketId }) => {
        setClients((prevClients) => prevClients.filter((client) => client.socketId !== socketId));
      });

      socket.on("language-update", ({ language: newLanguage }) => {
        setLanguage(newLanguage);
      });
      
      socket.on("codeResponse", (response) => {
        setOutput(response.run.output || response.run.stderr || "No output.");
      });

      // After all listeners are ready, we emit the join event.
      socket.emit("join", { roomId, username: userName });
    });

    // Cleanup logic for when the component unmounts or `joined` becomes false.
    return () => {
      socket.disconnect();
    };
  }, [joined, roomId, userName]);


  // --- EVENT HANDLERS ---
  const handleJoinRoom = () => { if (roomId.trim() && userName.trim()) setJoined(true); };

  const handleLeaveRoom = () => {
    if (lockHolder === userName && socketRef.current) {
      socketRef.current.emit('stop-typing-lock', { roomId });
    }
    setJoined(false);
    setRoomId("");
    setUserName("");
    setClients([]);
    setCode("// Start coding here...");
    setLockHolder(null);
    setIsEditorLocked(false);
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (!isEditorLocked && socketRef.current) {
      if (!lockHolder) {
        socketRef.current.emit('start-typing-lock', { roomId });
      }
      socketRef.current.emit("code-change", { roomId, code: newCode });
      if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current);
      stopTypingTimeoutRef.current = setTimeout(() => {
        if (socketRef.current) socketRef.current.emit('stop-typing-lock', { roomId });
      }, 2000);
    }
  };
  
  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    if (socketRef.current) {
      socketRef.current.emit("language-change", { roomId, language: newLanguage });
    }
  };
  
  const handleRunCode = () => {
    setOutput("Executing...");
    if (socketRef.current) {
      socketRef.current.emit("compileCode", { code, roomId, language, version: "*", stdin });
    }
  };

  // --- RENDER LOGIC ---
  if (!joined) {
    return (
      <div className="join-modal-overlay"> 
          <div className="join-modal-content">
            <h1>Real-Time Code Editor</h1>
            <input type="text" placeholder="Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} onKeyUp={(e) => e.key === 'Enter' && handleJoinRoom()}/>
            <input type="text" placeholder="Your Name" value={userName} onChange={(e) => setUserName(e.target.value)} onKeyUp={(e) => e.key === 'Enter' && handleJoinRoom()}/>
            <button className="btn-join" onClick={handleJoinRoom}>Join Room</button>
          </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <div className="sidebar">
        <div className="room-info">
          <h2>Room: {roomId}</h2>
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
          {lockHolder ? `${lockHolder} is typing...` : '\u00A0'}
        </div>
        <div className="sidebar-footer">
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
          options={{
            readOnly: isEditorLocked,
            minimap: { enabled: false },
            fontSize: 16,
            wordWrap: 'on'
          }}
        />
        {/* RESTORED: The missing IO wrapper and button */}
        <div className="io-wrapper">
          <div className="input-area">
            <h4>Input</h4>
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
        <button className="btn btn-primary run-btn" onClick={handleRunCode}>
          Execute Code
        </button>
      </div>
    </div>
  );
}

export default App;