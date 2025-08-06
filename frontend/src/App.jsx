import { useEffect, useState, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";

// --- Configuration ---
// Change this URL to your deployed server URL when you deploy.
// For local development, it should point to your local server.
const SERVER_URL = "http://localhost:5000";


function App() {
  // --- STATE MANAGEMENT ---
  // State for the join screen
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [joined, setJoined] = useState(false);

  // State for the editor and collaboration
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [typingUser, setTypingUser] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("// Start coding here...");
  const [stdin, setStdin] = useState(""); // For user input to the program
  const [output, setOutput] = useState("");
  const [copySuccess, setCopySuccess] = useState("");

  // --- REFS ---
  // Use a ref to hold the socket instance. It persists across re-renders.
  const socketRef = useRef(null);
  // Use a ref to manage the timer for the "is typing" indicator
  const typingTimeoutRef = useRef(null);


  // --- SIDE EFFECTS & SOCKET HANDLING ---
  useEffect(() => {
    // This effect handles the socket connection lifecycle.
    // It runs only when the user's `joined` status changes.
    if (!joined) return;

    // 1. CREATE AND CONNECT SOCKET
    socketRef.current = io(SERVER_URL);
    const socket = socketRef.current;

    // 2. EMIT JOIN EVENT
    socket.emit("join", { roomId, userName });

    // 3. SETUP EVENT LISTENERS
    socket.on("userJoined", (usersFromServer) => {
      console.log("Users in room:", usersFromServer);
      setConnectedUsers(usersFromServer);
    });

    socket.on("codeUpdate", (newCode) => {
      setCode(newCode);
    });

    socket.on("userTyping", (user) => {
      setTypingUser(`${user}...`);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setTypingUser("");
      }, 3000); // Indicator disappears after 3 seconds of inactivity
    });

    socket.on("languageUpdate", (newLanguage) => {
      setLanguage(newLanguage);
    });

    socket.on("codeResponse", (response) => {
      setOutput(response.run.output || response.run.stderr || "No output.");
    });

    // 4. CLEANUP LOGIC
    // This function runs when the component unmounts or before the effect re-runs.
    return () => {
      socket.emit("leaveRoom");
      socket.disconnect();
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
    // Reset all relevant state
    setRoomId("");
    setUserName("");
    setConnectedUsers([]);
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
      socketRef.current.emit("codeChange", { roomId, code: newCode });
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
      // Send code AND the stdin content
      socketRef.current.emit("compileCode", {
        code,
        roomId,
        language,
        version: "*", // Or manage version state if needed
        stdin,
      });
    }
  };


  // --- RENDER LOGIC ---

  // Show the Join Room form if the user hasn't joined yet
  if (!joined) {
    return (
      <div className="join-container">
        <div className="join-form">
          <h1>Real-Time Code Editor</h1>
          <input
            type="text"
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            onKeyUp={(e) => e.key === 'Enter' && handleJoinRoom()}
          />
          <input
            type="text"
            placeholder="Your Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onKeyUp={(e) => e.key === 'Enter' && handleJoinRoom()}
          />
          <button onClick={handleJoinRoom}>Join Room</button>
        </div>
      </div>
    );
  }

  // Show the main editor if the user has joined
  return (
    <div className="editor-container">
      <div className="sidebar">
        <div className="room-info">
          <h2>Room: {roomId}</h2>
          <button onClick={handleCopyRoomId} className="copy-button">
            {copySuccess || "Copy ID"}
          </button>
        </div>
        <h3>Users ({connectedUsers.length})</h3>
        <ul className="user-list">
          {connectedUsers.map((user) => (
            <li key={user}>{user}</li>
          ))}
        </ul>
        <p className="typing-indicator">
          {typingUser ? `${typingUser} is typing...` : "\u00A0"}
        </p>
        <select
          className="language-selector"
          value={language}
          onChange={handleLanguageChange}
        >
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="cpp">C++</option>
          <option value="go">Go</option>
          <option value="rust">Rust</option>
        </select>
        <button className="leave-button" onClick={handleLeaveRoom}>
          Leave Room
        </button>
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
        <button className="run-btn" onClick={handleRunCode}>
          Execute Code
        </button>
      </div>
    </div>
  );
}

export default App;