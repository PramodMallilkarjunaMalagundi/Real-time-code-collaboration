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

  // State for automatic typing lock
  const [isEditorLocked, setIsEditorLocked] = useState(false);
  const [lockHolder, setLockHolder] = useState(null); // Username of the person typing
  // CORRECTED: Storing our own socket ID in state to avoid timing issues
  const [mySocketId, setMySocketId] = useState(null);

  // --- REFS ---
  const socketRef = useRef(null);
  const stopTypingTimeoutRef = useRef(null); // Ref for the "stop typing" timer

  // --- SIDE EFFECTS & SOCKET HANDLING ---
  useEffect(() => {
    if (!joined) return;

    const socket = io(SERVER_URL);
    socketRef.current = socket;

    // CORRECTED: Set our socket ID reliably into state on connection
    socket.on('connect', () => {
      setMySocketId(socket.id);
    });

    socket.emit("join", { roomId, username: userName });

    socket.on("joined", ({ clients: serverClients }) => setClients(serverClients));
    socket.on("code-change", ({ code: newCode }) => setCode(newCode));

    // Listen for lock status updates from the server
    socket.on('lock-status-update', ({ lockedBy, username }) => {
      setLockHolder(username);
      // CORRECTED: Now this check reliably uses the state variable for our ID
      setIsEditorLocked(lockedBy !== null && lockedBy !== mySocketId);
    });

    socket.on("disconnected", ({ socketId }) => {
      setClients((prevClients) => prevClients.filter((client) => client.socketId !== socketId));
    });

    return () => {
      socket.disconnect();
      socket.off();
    };
  }, [joined, roomId, userName, mySocketId]); // Added mySocketId to dependency array


  // --- EVENT HANDLERS ---
  const handleJoinRoom = () => { if (roomId.trim() && userName.trim()) setJoined(true); };
  
  const handleLeaveRoom = () => {
    setJoined(false);
 