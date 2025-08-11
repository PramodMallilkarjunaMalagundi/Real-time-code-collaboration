// =================================================================
//                      FRONTEND - FINAL DEBUG VERSION
// =================================================================

import { useEffect, useState, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";

const SERVER_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

function App() {
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [joined, setJoined] = useState(false);
  const [clients, setClients] = useState([]);
  const [code, setCode] = useState("// Start coding here...");
  const [lockHolder, setLockHolder] = useState(null);
  const [isEditorLocked, setIsEditorLocked] = useState(false);
  const [mySocketId, setMySocketId] = useState(null);

  const socketRef = useRef(null);
  const stopTypingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!joined) return;
    console.log('[FRONTEND LOG] useEffect running to establish connection...');

    const socket = io(SERVER_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`[FRONTEND LOG] SUCCESSFULLY CONNECTED to server. My Socket ID is: ${socket.id}`);
      setMySocketId(socket.id);
    });

    socket.on('connect_error', (err) => {
      console.error('[FRONTEND LOG] Connection Error:', err.message);
    });

    console.log(`[FRONTEND LOG] Emitting 'join' event for ${userName} in room ${roomId}`);
    socket.emit("join", { roomId, username: userName });

    socket.on("joined", ({ clients, username }) => {
      console.log(`[FRONTEND LOG] Received 'joined' event. User: ${username}. Client list size: ${clients.length}`);
      setClients(clients);
    });

    socket.on("code-change", ({ code: newCode }) => {
      console.log('[FRONTEND LOG] Received "code-change" event.');
      setCode(newCode);
    });

    socket.on('lock-status-update', ({ lockedBy, username }) => {
      console.log(`[FRONTEND LOG] Received 'lock-status-update'. Locked by: ${username}`);
      setLockHolder(username);
      setIsEditorLocked(lockedBy !== null && lockedBy !== socket.id);
    });

    socket.on("disconnected", ({ username }) => {
      console.log(`[FRONTEND LOG] Received 'disconnected' event for ${username}`);
      setClients((prevClients) => prevClients.filter((client) => client.username !== username));
    });

    return () => {
      console.log('[FRONTEND LOG] Cleanup: Disconnecting socket.');
      if (socket) socket.disconnect();
      if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current);
    };
  }, [joined, roomId, userName]);

  const handleJoinRoom = () => { if (roomId.trim() && userName.trim()) setJoined(true); };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (!isEditorLocked && socketRef.current) {
      if (!lockHolder) {
        console.log('[FRONTEND LOG] Sending "start-typing-lock" event.');
        socketRef.current.emit('start-typing-lock', { roomId });
      }
      socketRef.current.emit("code-change", { roomId, code: newCode });

      if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current);
      stopTypingTimeoutRef.current = setTimeout(() => {
        if (socketRef.current) {
          console.log('[FRONTEND LOG] Sending "stop-typing-lock" event.');
          socketRef.current.emit('stop-typing-lock', { roomId });
        }
      }, 2000);
    }
  };
  
  // --- The rest of your handlers and JSX (no changes needed) ---
  const handleLeaveRoom = () => { if (lockHolder === userName && socketRef.current) { socketRef.current.emit('stop-typing-lock', { roomId }); } setJoined(false); setRoomId(""); setUserName(""); setClients([]); setCode("// Start coding here..."); setLockHolder(null); setIsEditorLocked(false); setMySocketId(null); };

  if (!joined) {
    return (
      <div className="join-modal-overlay">
        <div className="join-modal-content">
          <h1>Real-Time Code Editor</h1>
          <input type="text" placeholder="Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} onKeyUp={(e) => e.key === 'Enter' && handleJoinRoom()} />
          <input type="text" placeholder="Your Name" value={userName} onChange={(e) => setUserName(e.target.value)} onKeyUp={(e) => e.key === 'Enter' && handleJoinRoom()} />
          <button className="btn-join" onClick={handleJoinRoom}>Join Room</button>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <div className="sidebar">
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
          {lockHolder ? ( <><strong>{lockHolder}</strong> is typing...</> ) : ( '\u00A0' )}
        </div>
        <div className="sidebar-footer">
            <button className="btn btn-secondary leave-btn" onClick={handleLeaveRoom}>Leave Room</button>
        </div>
      </div>
      <div className="editor-wrapper">
        <Editor
          height="70%"
          language={"javascript"}
          value={code}
          onChange={handleCodeChange}
          theme="vs-dark"
          options={{ readOnly: isEditorLocked, minimap: { enabled: false }, fontSize: 16, wordWrap: 'on' }}
        />
      </div>
    </div>
  );
}

export default App;