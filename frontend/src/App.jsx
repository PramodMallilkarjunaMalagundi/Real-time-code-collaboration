import { useEffect, useState, useRef } from "react";
import "./App.css"; 
import io from "socket.io-client";
import Editor from "@monaco-editor/react";
import toast, { Toaster } from 'react-hot-toast';

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
  
  // State for the "is typing..." indicator
  const [typingUser, setTypingUser] = useState(null);

  // --- REFS ---
  const socketRef = useRef(null);

  // --- SIDE EFFECTS & SOCKET HANDLING ---
  useEffect(() => {
    if (!joined) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = io(SERVER_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log("CLIENT LOG: Connected with ID:", socket.id);
      socket.emit("join", { roomId, username: userName });
    });

    socket.on("joined", ({ clients: serverClients, username }) => {
      if (username !== userName) {
        toast.success(`${username} joined the room.`);
      }
      setClients(serverClients);
    });

    socket.on("code-change", ({ code: newCode }) => setCode(newCode));
    
    // This listener for the "is typing..." indicator remains.
    socket.on('typing', ({ username }) => {
        if (username !== userName) {
            setTypingUser(username);
            setTimeout(() => setTypingUser(null), 2000); // Hide after 2s
        }
    });

    socket.on("disconnected", ({ username }) => {
      toast.error(`${username} left the room.`);
      setClients((prevClients) => prevClients.filter((client) => client.username !== username));
    });

    socket.on("language-update", ({ language: newLanguage }) => setLanguage(newLanguage));
    socket.on("codeResponse", (response) => {
      setOutput(response.run.output || response.run.stderr || "No output.");
    });

    return () => {
      socket.disconnect();
    };
  }, [joined, roomId, userName]);


  // --- EVENT HANDLERS ---
  const handleJoinRoom = () => { if (roomId.trim() && userName.trim()) setJoined(true); };

  const handleLeaveRoom = () => {
    setJoined(false);
    setRoomId("");
    setUserName("");
    setClients([]);
    setCode("// Start coding here...");
  };

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    toast.success('Room ID copied!');
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode); // Always update local state
    if (socketRef.current) {
      // Always send code changes
      socketRef.current.emit("code-change", { roomId, code: newCode });
      // Also send a typing event so others know who is editing
      socketRef.current.emit("typing", { roomId, username: userName });
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
        <Toaster position="top-center" />
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
      <Toaster position="top-center" />
      <div className="sidebar">
        <div className="room-info">
          <h2>Room: {roomId}</h2>
          <button className="btn btn-secondary" onClick={handleCopyRoomId}>Copy ID</button>
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
          {typingUser ? `${typingUser} is typing...` : '\u00A0'}
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
            readOnly: false, // Editor is NEVER read-only now
            minimap: { enabled: false },
            fontSize: 16,
            wordWrap: 'on'
          }}
        />
        <div className="io-wrapper">
          <div className="input-area">
            <h4>Input</h4>
            <textarea className="io-console" value={stdin} onChange={(e) => setStdin(e.target.value)} placeholder="Enter program input here..."/>
          </div>
          <div className="output-area">
            <h4>Output</h4>
            <textarea className="io-console" value={output} readOnly placeholder="Output will appear here..."/>
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