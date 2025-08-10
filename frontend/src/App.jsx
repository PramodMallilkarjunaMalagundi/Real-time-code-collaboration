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
  
  // State for the automatic typing lock
  const [isEditorLocked, setIsEditorLocked] = useState(false);
  const [lockHolder, setLockHolder] = useState(null); // Username of the person typing
  const [mySocketId, setMySocketId] = useState(null); // Reliably stores our own socket ID

  // --- REFS ---
  const socketRef = useRef(null);
  const stopTypingTimeoutRef = useRef(null); // Ref for the "stop typing" timer

  // --- SIDE EFFECTS & SOCKET HANDLING ---
  useEffect(() => {
    // This effect should only run when the user has actively joined a room.
    if (!joined) return;

    const socket = io(SERVER_URL);
    socketRef.current = socket;

    // Set our own socket ID into state as soon as we connect. This is reliable.
    socket.on('connect', () => {
      setMySocketId(socket.id);
    });

    // Send the join event to the server.
    socket.emit("join", { roomId, username: userName });

    // --- SETUP ALL EVENT LISTENERS ---

    socket.on("joined", ({ clients: serverClients }) => {
      setClients(serverClients); 
    });

    socket.on("code-change", ({ code: newCode }) => {
      setCode(newCode);
    });
    
    // Listen for lock status updates from the server.
    socket.on('lock-status-update', ({ lockedBy, username }) => {
        setLockHolder(username);
        // The check now correctly uses the state variable for our ID.
        setIsEditorLocked(lockedBy !== null && lockedBy !== socket.id);
    });

    socket.on("disconnected", ({ socketId }) => {
      setClients((prevClients) => prevClients.filter((client) => client.socketId !== socketId));
    });

    // --- CLEANUP LOGIC ---
    // This function runs when the component unmounts or `joined` becomes false.
    return () => {
      if (socket) {
        socket.disconnect();
      }
      if (stopTypingTimeoutRef.current) {
          clearTimeout(stopTypingTimeoutRef.current);
      }
    };
  }, [joined, roomId, userName]);


  // --- EVENT HANDLERS ---
  const handleJoinRoom = () => {
    if (roomId.trim() && userName.trim()) {
      setJoined(true);
    }
  };
  
  const handleLeaveRoom = () => {
    // If we hold the lock, make sure to release it before leaving.
    if (lockHolder === userName && socketRef.current) {
        socketRef.current.emit('stop-typing-lock', { roomId });
    }
    setJoined(false);
    // Reset all relevant state for the next session
    setRoomId("");
    setUserName("");
    setClients([]);
    setCode("// Start coding here...");
    setLockHolder(null);
    setIsEditorLocked(false);
    setMySocketId(null);
  };
  
  const handleCodeChange = (newCode) => {
    // Always update our local editor's state.
    setCode(newCode);

    // Only send events if we are allowed to edit.
    if (!isEditorLocked && socketRef.current) {
        // If the editor is unlocked, our first keypress should claim the lock.
        if (!lockHolder) {
            socketRef.current.emit('start-typing-lock', { roomId });
        }
        
        // Send the actual code change.
        socketRef.current.emit("code-change", { roomId, code: newCode });

        // Reset the timer to auto-release the lock.
        if (stopTypingTimeoutRef.current) {
            clearTimeout(stopTypingTimeoutRef.current);
        }
        stopTypingTimeoutRef.current = setTimeout(() => {
            // Check if this client still holds the lock before releasing.
            if (socketRef.current) {
              socketRef.current.emit('stop-typing-lock', { roomId });
            }
        }, 2000); // Release lock after 2 seconds of inactivity.
    }
  };

  // --- RENDER LOGIC ---
  if (!joined) {
    return (
      <div className="join-container">
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
        {/* ... Other sidebar elements ... */}
        <h3>Users ({clients.length})</h3>
        <ul className="user-list">
          {clients.map((client) => (
            <li key={client.socketId}>{client.username}</li>
          ))}
        </ul>
        
        <div className="lock-manager">
          <p className="lock-status">
            Editor locked by: <strong>{lockHolder || 'None'}</strong>
          </p>
          {!isEditorLocked && lockHolder === userName && (
             <p className="lock-hint">(You have edit control)</p>
          )}
        </div>
        
        <button className="leave-button" onClick={handleLeaveRoom}>Leave Room</button>
      </div>

      <div className="editor-wrapper">
        <Editor
          height="70%"
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
        {/* ... IO wrapper and other elements ... */}
      </div>
    </div>
  );
}

export default App;