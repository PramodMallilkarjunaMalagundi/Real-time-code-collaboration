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
  
  // State for the "Typist" system
  const [typist, setTypist] = useState({ socketId: null, username: null });
  const [mySocketId, setMySocketId] = useState(null);
  
  // This is a derived state. It's recalculated on every render for accuracy.
  const isEditorLocked = typist.socketId !== null && typist.socketId !== mySocketId;

  // --- REFS ---
  const socketRef = useRef(null);
  const stopTypingTimeoutRef = useRef(null); // Ref for the "stop typing" timer

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
      setMySocketId(socket.id);
    });

    socket.on("joined", ({ clients: serverClients, username }) => {
      if (username !== userName) toast.success(`${username} joined the room.`);
      setClients(serverClients);
    });

    socket.on("code-change", ({ code: newCode }) => setCode(newCode));
    
    // Listen for updates on who the current typist is.
    socket.on('typist-update', ({ socketId, username }) => {
      setTypist({ socketId, username });
    });

    socket.on("disconnected", ({ username }) => {
      toast.error(`${username} left the room.`);
      setClients((prevClients) => prevClients.filter((client) => client.username !== username));
    });

    socket.on("language-update", ({ language: newLanguage }) => setLanguage(newLanguage));
    socket.on("codeResponse", (response) => {
      setOutput(response.run.output || response.run.stderr || "No output.");
    });

    socket.emit("join", { roomId, username: userName });

    return () => {
      socket.disconnect();
    };
  }, [joined, roomId, userName]);


  // --- EVENT HANDLERS ---
  const handleJoinRoom = () => { if (roomId.trim() && userName.trim()) setJoined(true); };

  const handleLeaveRoom = () => {
    if (typist.username === userName && socketRef.current) {
      socketRef.current.emit('stop-typing', { roomId });
    }
    setJoined(false);
    setRoomId("");
    setUserName("");
    setClients([]);
    setCode("// Start coding here...");
    setTypist({ socketId: null, username: null });
    setMySocketId(null);
  };

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    toast.success('Room ID copied!');
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode); // Always update local state
    
    // Only send events if you are allowed to edit.
    if (!isEditorLocked && socketRef.current) {
        // Send the code change. The server will make you the typist if the role is open.
        socketRef.current.emit("code-change", { roomId, code: newCode });

        // Reset the timer that will release your "typist" role.
        if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current);
        
        stopTypingTimeoutRef.current = setTimeout(() => {
            if (socketRef.current) socketRef.current.emit('stop-typing', { roomId });
        }, 1500); // After 1.5 seconds of inactivity, you are no longer the typist.
    }
  };
  
  const handleLanguageChange = (e) => { /* ... same as before ... */ };
  const handleRunCode = () => { /* ... same as before ... */ };

  // --- RENDER LOGIC ---
  if (!joined) {
    return ( /* ... Join form JSX is the same ... */ );
  }

  return (
    <div className="editor-container">
      <Toaster position="top-center" />
      <div className="sidebar">
        {/* ... room info, users list ... */}
        <div className="typing-indicator">
          {typist.username ? `${typist.username} is typing...` : '\u00A0'}
        </div>
        {/* ... language selector, leave button ... */}
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
        {/* ... IO wrapper and execute button ... */}
      </div>
    </div>
  );
}
// Fill in the missing JSX for brevity
App.prototype.render = function() {
  if (!this.state.joined) {
    return (
      <div className="join-modal-overlay"> 
          <div className="join-modal-content">
            <h1>Real-Time Code Editor</h1>
            <input type="text" placeholder="Room ID" value={this.state.roomId} onChange={(e) => this.setState({roomId: e.target.value})} onKeyUp={(e) => e.key === 'Enter' && this.handleJoinRoom()}/>
            <input type="text" placeholder="Your Name" value={this.state.userName} onChange={(e) => this.setState({userName: e.target.value})} onKeyUp={(e) => e.key === 'Enter' && this.handleJoinRoom()}/>
            <button className="btn-join" onClick={this.handleJoinRoom}>Join Room</button>
          </div>
      </div>
    );
  }
  return (
      <div className="editor-container">
        <Toaster position="top-center" />
        <div className="sidebar">
          <div className="room-info">
            <h2>Room: {this.state.roomId}</h2>
            <button className="btn btn-secondary" onClick={this.handleCopyRoomId}>Copy ID</button>
          </div>
          <h3>Users ({this.state.clients.length})</h3>
          <ul className="user-list">
            {this.state.clients.map((client) => (
              <li className="client-item" key={client.socketId}>
                <div className="avatar">{client.username.charAt(0).toUpperCase()}</div>
                <span>{client.username}</span>
              </li>
            ))}
          </ul>
          <div className="typing-indicator">
            {this.state.typist.username ? `${this.state.typist.username} is typing...` : '\u00A0'}
          </div>
          <div className="sidebar-footer">
            <select className="language-selector" value={this.state.language} onChange={this.handleLanguageChange}>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
            </select>
            <button className="btn btn-secondary leave-btn" onClick={this.handleLeaveRoom}>Leave Room</button>
          </div>
        </div>
        <div className="editor-wrapper">
          <Editor
            height="55%"
            language={this.state.language}
            value={this.state.code}
            onChange={(code) => this.handleCodeChange(code)}
            theme="vs-dark"
            options={{
              readOnly: this.state.isEditorLocked,
              minimap: { enabled: false },
              fontSize: 16,
              wordWrap: 'on'
            }}
          />
          <div className="io-wrapper">
            <div className="input-area">
              <h4>Input</h4>
              <textarea className="io-console" value={this.state.stdin} onChange={(e) => this.setState({stdin: e.target.value})} placeholder="Enter program input here..."/>
            </div>
            <div className="output-area">
              <h4>Output</h4>
              <textarea className="io-console" value={this.state.output} readOnly placeholder="Output will appear here..."/>
            </div>
          </div>
          <button className="btn btn-primary run-btn" onClick={this.handleRunCode}>
            Execute Code
          </button>
        </div>
      </div>
    );
}
export default App;