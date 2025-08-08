import { useEffect, useState, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";

// --- Configuration ---
// FIXED: Use environment variables for the server URL. This is crucial for deployment.
// Vercel will provide this value. For local dev, create a .env.local file.
const SERVER_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";


function App() {
  // --- STATE MANAGEMENT ---
  // State for the join screen
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [joined, setJoined] = useState(false);

  // State for the editor and collaboration
  // FIXED: Renamed for clarity from connectedUsers to clients
  const [clients, setClients] = useState([]); 
  const [typingUser, setTypingUser] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("// Start coding here...");
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState("");
  const [copySuccess, setCopySuccess] = useState("");

  // --- REFS ---
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);


  // --- SIDE EFFECTS & SOCKET HANDLING ---
  useEffect(() => {
    if (!joined) return;

    // 1. CREATE AND CONNECT SOCKET
    socketRef.current = io(SERVER_URL);
    const socket = socketRef.current;

    // 2. EMIT JOIN EVENT
    // The backend will receive this and add the user to the room.
    socket.emit("join", { roomId, userName });

    // 3. SETUP EVENT LISTENERS (This section contains the main fixes)
    
    // FIXED: The backend sends 'joined', not 'userJoined'.
    // The payload is an object containing the full client list.
    socket.on("joined", ({ clients: serverClients, username, socketId }) => {
      console.log(`${username} joined the room.`);
      // Update the state with the complete list of clients from the server.
      setClients(serverClients); 
    });

    // FIXED: The backend sends 'code-change', not 'codeUpdate'.
    // The payload is an object { code: newCode }.
    socket.on("code-change", ({ code: newCode }) => {
      setCode(newCode);
    });

    // FIXED: The backend sends 'typing', not 'userTyping'.
    // The payload is an object { username: user }.
    socket.on("typing", ({ username }) => {
      setTypingUser(username); // Just the name, we add " is typing..." in the UI
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setTypingUser("");
      }, 2000); 
    });
    
    // ADDED: A listener for when a user disconnects.
    socket.on("disconnected", ({ socketId, username }) => {
      console.log(`${username} left the room.`);
      // Filter the clients list to remove the user who left.
      setClients((prevClients) => {
        return prevClients.filter((client) => client.socketId !== socketId);
      });
    });

    // Your other listeners (languageUpdate, codeResponse) may also need
    // to be checked against your backend if they are custom.
    socket.on("languageUpdate", (newLanguage) => {
      setLanguage(newLanguage);
    });

    socket.on("codeResponse", (response) => {
      setOutput(response.run.output || response.run.stderr || "No output.");
    });


    // 4. CLEANUP LOGIC
    return () => {
      socket.disconnect();
      // ADDED: Make sure to remove all listeners on cleanup.
      socket.off('joined');
      socket.off('code-change');
      socket.off('typing');
      socket.off('disconnected');
      socketRef.current = null;
    };
  }, [joined, roomId, userName]);


  // --- EVENT HANDLERS ---
  const handleJoinRoom = () => {
    if (roomId.trim() && userName.trim()) {
      setJoined(true);
    }
  };

  const handleLeaveRoom = () => {
    setJoined(false);
    setRoomId("");
    setUserName("");
    setClients([]);
    setCode("// Start coding here...");
    setLanguage("javascript");
    setOutput("");
    setStdin("");
  };

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopySuccess("Copied!");
    setTimeout(() => setCopySuccess(""), 2000);
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (socketRef.current) {
      // FIXED: The backend event is 'code-change'.
      socketRef.current.emit("code-change", { roomId, code: newCode });
      // FIXED: The backend event is 'typing'.
      socketRef.current.emit("typing", { roomId, userName });
    }
  };

  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    if (socketRef.current) {
      socketRef.current.emit("languageChange", { roomId, language: newLanguage });
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
      <div className="join-container">
        {/* ... The Join Room form remains the same ... */}
        <div className="join-form">
          <h1>Real-Time Code Editor</h1>
          <input type="text" placeholder="Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} onKeyUp={(e) => e.key === 'Enter' && handleJoinRoom()}/>
          <input type="text" placeholder="Your Name" value={userName} onChange={(e) => setUserName(e.target.value)} onKeyUp={(e) => e.key === 'Enter' && handleJoinRoom()}/>
          <button onClick={handleJoinRoom}>Join Room</button>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <div className="sidebar">
        <div className="room-info">
          <h2>Room: {roomId}</h2>
          <button onClick={handleCopyRoomId} className="copy-button">
            {copySuccess || "Copy ID"}
          </button>
        </div>
        {/* FIXED: The state is now named `clients` */}
        <h3>Users ({clients.length})</h3>
        <ul className="user-list">
          {/* FIXED: `clients` is an array of objects, so we need to access `client.username` */}
          {clients.map((client) => (
            <li key={client.socketId}>{client.username}</li>
          ))}
        </ul>
        <p className="typing-indicator">
          {/* FIXED: Display logic for typing indicator */}
          {typingUser ? `${typingUser} is typing...` : "\u00A0"}
        </p>
        <select className="language-selector" value={language} onChange={handleLanguageChange}>
          {/* ... Options remain the same ... */}
          <option value="javascript">JavaScript</option><option value="python">Python</option><option value="java">Java</option><option value="cpp">C++</option><option value="go">Go</option><option value="rust">Rust</option>
        </select>
        <button className="leave-button" onClick={handleLeaveRoom}> Leave Room </button>
      </div>

      <div className="editor-wrapper">
        {/* ... Editor and IO areas remain the same ... */}
        <Editor height="55%" language={language} value={code} onChange={handleCodeChange} theme="vs-dark" options={{ minimap: { enabled: false }, fontSize: 16, wordWrap: 'on' }}/>
        <div className="io-wrapper"><div className="input-area"><h4>Input </h4><textarea className="io-console" value={stdin} onChange={(e) => setStdin(e.target.value)} placeholder="Enter program input here..."/></div><div className="output-area"><h4>Output</h4><textarea className="io-console" value={output} readOnly placeholder="Output will appear here..."/></div></div>
        <button className="run-btn" onClick={handleRunCode}> Execute Code </button>
      </div>
    </div>
  );
}

export default App;