// =================================================================
//                      FINAL App.jsx (with Notifications)
// =================================================================

import { useEffect, useState, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";
// ADDED: Import react-hot-toast
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
  const [stdin, setStdin] = useState(""); // ADDED: Restore stdin state
  const [output, setOutput] = useState(""); // ADDED: Restore output state
  const [copySuccess, setCopySuccess] = useState("");
  
  const [typingUser, setTypingUser] = useState(null);

  // --- REFS ---
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  // ADDED: Ref for the code execution toast ID
  const executeToastIdRef = useRef(null);


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
    socket.on("joined", ({ clients: serverClients, username }) => { // ADDED username param
      setClients(serverClients);
      // ADDED: Notification for user joined (only for others)
      if (username !== userName) {
        toast.success(`${username} joined the room.`);
      }
    });

    socket.on("code-change", ({ code: newCode }) => {
      setCode(newCode);
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

    socket.on("disconnected", ({ socketId, username }) => { // ADDED username param
      setClients((prevClients) => prevClients.filter((client) => client.socketId !== socketId));
      // ADDED: Notification for user disconnected
      toast.error(`${username} left the room.`);
    });

    // ADDED: Listener for code execution response
    socket.on("codeResponse", (response) => {
      // ADDED: Dismiss the loading toast
      if (executeToastIdRef.current) {
        toast.dismiss(executeToastIdRef.current);
      }
      
      const outputMsg = response.run.output || response.run.stderr || "No output.";
      setOutput(outputMsg);
      
      // ADDED: Show success/error toast based on output
      if (response.run.stderr) {
        toast.error('Code execution failed!');
      } else {
        toast.success('Code executed successfully!');
      }
    });


    // --- CLEANUP ---
    return () => {
      if (socket) socket.disconnect();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      // ADDED: Dismiss any lingering toast if component unmounts
      if (executeToastIdRef.current) {
        toast.dismiss(executeToastIdRef.current);
      }
    };
  }, [joined, roomId, userName]);


  // --- EVENT HANDLERS ---
  const handleJoinRoom = () => { if (roomId.trim() && userName.trim()) setJoined(true); };

  const handleLeaveRoom = () => {
    setJoined(false);
    setRoomId(""); setUserName(""); setClients([]); setCode("// Start coding here...");
    setTypingUser(null);
    // ADDED: Optional - show a leave notification for self
    toast('You have left the room.', { icon: '👋' });
  };
  
  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    // ADDED: Use react-hot-toast for copy success
    toast.success('Room ID copied!');
    // Removed setCopySuccess and setTimeout as toast handles it
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (socketRef.current) {
      socketRef.current.emit("code-change", { roomId, code: newCode });
      socketRef.current.emit('typing', { roomId, username: userName });
    }
  };
  
  // ADDED: handleRunCode with loading and output setting
  const handleRunCode = () => {
    setOutput("Executing...");
    // ADDED: Show a loading toast
    executeToastIdRef.current = toast.loading('Executing code...');
    if (socketRef.current) {
      // Assuming 'compileCode' is the event your backend expects for execution
      socketRef.current.emit("compileCode", { code, roomId, language, stdin });
    }
  };


  // --- RENDER LOGIC ---
  return (
    <div className="app-container">
      {/* ADDED: Toaster component for notifications */}
      <Toaster 
        position="bottom-right" // Position of toasts
        reverseOrder={false}     // New toasts appear at the bottom
      />

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

      <div className={`editor-container ${!joined ? 'blurred' : ''}`}>
        <div className="sidebar">
          <div className="room-info">
            <h2>Room: {roomId || '...'}</h2>
            <button className="btn btn-secondary" onClick={handleCopyRoomId}>
              {copySuccess || "Copy ID"} {/* copySuccess is no longer used but can remain for initial render */}
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
              '\u00A0'
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