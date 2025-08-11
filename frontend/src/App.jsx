// =================================================================
//                      FINAL App.jsx (with Code Execution)
// =================================================================

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
  const [copySuccess, setCopySuccess] = useState("");
  const [typingUser, setTypingUser] = useState(null);

  // --- REFS ---
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const executeToastIdRef = useRef(null);

  // --- SIDE EFFECTS & SOCKET HANDLING ---
  useEffect(() => {
    if (!joined) return;

    const socket = io(SERVER_URL);
    socketRef.current = socket;

    socket.on('connect', () => { /* ... */ });
    socket.emit("join", { roomId, username: userName });

    // --- EVENT LISTENERS ---
    socket.on("joined", ({ clients: serverClients, username }) => {
      setClients(serverClients);
      if (username !== userName) toast.success(`${username} joined the room.`);
    });
    socket.on("code-change", ({ code: newCode }) => setCode(newCode));
    socket.on('typing', ({ username }) => { /* ... */ });
    socket.on('language-change', ({ language: newLanguage }) => setLanguage(newLanguage));
    socket.on("disconnected", ({ socketId, username }) => {
      setClients((prevClients) => prevClients.filter((client) => client.socketId !== socketId));
      toast.error(`${username} left the room.`);
    });

    // UPDATED: Ensure this listener is active and working
    socket.on("codeResponse", (response) => {
      if (executeToastIdRef.current) toast.dismiss(executeToastIdRef.current);
      const outputMsg = response.run.output || response.run.stderr || "No output.";
      setOutput(outputMsg);
      if (response.run.stderr) {
        toast.error('Code execution failed!');
      } else {
        toast.success('Code executed successfully!');
      }
    });

    // --- CLEANUP ---
    return () => { /* ... */ };
  }, [joined, roomId, userName]);


  // --- EVENT HANDLERS ---
  const handleJoinRoom = () => { /* ... */ };
  const handleLeaveRoom = () => { /* ... */ };
  const handleCopyRoomId = () => { /* ... */ };
  const handleCodeChange = (newCode) => { /* ... */ };
  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    if (socketRef.current) socketRef.current.emit('language-change', { roomId, language: newLanguage });
  };

  const handleRunCode = () => {
    setOutput("Executing...");
    executeToastIdRef.current = toast.loading('Executing code...');
    if (socketRef.current) {
      socketRef.current.emit("compileCode", { code, language, stdin });
    }
  };

  // --- RENDER LOGIC ---
  return ( /* ... YOUR EXISTING JSX ... */ );
}

export default App;