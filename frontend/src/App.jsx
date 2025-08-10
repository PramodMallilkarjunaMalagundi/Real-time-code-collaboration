import { useEffect, useState, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";
import toast, { Toaster } from 'react-hot-toast';

const SERVER_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

function App() {
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [joined, setJoined] = useState(false);
  const [clients, setClients] = useState([]);
  const [typingUser, setTypingUser] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("// Start coding here...");
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState("");

  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    // We only want to establish a socket connection if the user has successfully joined.
    if (!joined || !socketRef.current) return;

    const socket = socketRef.current;

    socket.on("joined", ({ clients: serverClients, username, socketId }) => {
      if (username !== userName) {
        toast.success(`${username} joined the room!`);
      }
      setClients(serverClients);
    });

    socket.on("code-change", ({ code: newCode }) => {
      setCode(newCode);
    });

    socket.on("typing", ({ username }) => {
      setTypingUser(username);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setTypingUser("");
      }, 2000);
    });

    socket.on("disconnected", ({ socketId, username }) => {
      toast.error(`${username} left the room.`);
      setClients((prevClients) => {
        return prevClients.filter((client) => client.socketId !== socketId);
      });
    });

    socket.on("languageUpdate", (newLanguage) => {
      setLanguage(newLanguage);
    });

    socket.on("codeResponse", (response) => {
      setOutput(response.run.output || response.run.stderr || "No output.");
    });
  }, [joined, userName]); // Dependency array updated

  const handleJoinRoom = () => {
    if (roomId.trim() && userName.trim()) {
      // Establish the connection first
      socketRef.current = io(SERVER_URL);
      // Then emit the join event
      socketRef.current.emit("join", { roomId, username: userName });
      setJoined(true);
    } else {
      toast.error("Room ID and Username are required.");
    }
  };

  const handleLeaveRoom = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setJoined(false);
    setRoomId("");
    setUserName("");
    setClients([]);
    setCode("// Start coding here...");
  };

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    toast.success('Room ID copied to clipboard!');
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (socketRef.current) {
      socketRef.current.emit("code-change", { roomId, code: newCode });
      socketRef.current.emit("typing", { roomId, username: userName });
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

  // --- NEW RENDER LOGIC ---
  // We now always render the editor, and conditionally render the modal on top.

  return (
    <>
      {/* Conditionally render the Join Modal */}
      {!joined && (
        <div className="join-modal-overlay">
          <div className="join-modal-content">
            <h1>Join a Coding Room</h1>
            <input type="text" placeholder="Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} onKeyUp={(e) => e.key === 'Enter' && handleJoinRoom()} />
            <input type="text" placeholder="Your Name" value={userName} onChange={(e) => setUserName(e.target.value)} onKeyUp={(e) => e.key === 'Enter' && handleJoinRoom()} />
            <button className="btn-join" onClick={handleJoinRoom}>Join</button>
          </div>
        </div>
      )}

      {/* The main editor container */}
      {/* The CSS will handle blurring this when the modal is open */}
      <div className="editor-container">
        <Toaster 
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#3c3c3c',
              color: '#fff',
            },
          }}
        />
        <div className="sidebar">
          <div className="room-info">
            <h2>Room: {roomId}</h2>
            <button onClick={handleCopyRoomId} className="btn btn-secondary">
              Copy ID
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
              <p className="typing-indicator">
                  {typingUser ? `${typingUser} is typing...` : "\u00A0"}
              </p>
              <select className="language-selector" value={language} onChange={handleLanguageChange}>
                  <option value="javascript">JavaScript</option><option value="python">Python</option><option value="java">Java</option><option value="cpp">C++</option><option value="go">Go</option><option value="rust">Rust</option>
              </select>
              <button className="btn btn-secondary leave-btn" onClick={handleLeaveRoom}>
                  Leave Room
              </button>
          </div>
        </div>
        <div className="editor-wrapper">
          <Editor height="55%" language={language} value={code} onChange={handleCodeChange} theme="vs-dark" options={{ minimap: { enabled: false }, fontSize: 16, wordWrap: 'on' }} />
          <div className="io-wrapper"><div className="input-area"><h4>Input </h4><textarea className="io-console" value={stdin} onChange={(e) => setStdin(e.target.value)} placeholder="Enter program input here..."/></div><div className="output-area"><h4>Output</h4><textarea className="io-console" value={output} readOnly placeholder="Output will appear here..."/></div></div>
          <button className="btn btn-primary" onClick={handleRunCode}>
            Execute Code
          </button>
        </div>
      </div>
    </>
  );
}

export default App;