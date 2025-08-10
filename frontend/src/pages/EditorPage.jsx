// In frontend/src/pages/EditorPage.jsx

// We move all the editor logic here from App.jsx
import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom'; // Import router hooks
import io from 'socket.io-client';
import Editor from '@monaco-editor/react';
import toast from 'react-hot-toast';

const SERVER_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
// Boilerplate code object remains the same
const boilerplate = { /* ... paste your existing boilerplate object here ... */ };

// Rename the function from App to EditorPage
const EditorPage = () => {
    // Get the roomId from the URL and the username from the state passed by the router
    const { roomId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const userName = location.state?.userName;

    // All your existing state and refs for the editor page remain here
    const [clients, setClients] = useState([]);
    const [typingUser, setTypingUser] = useState('');
    const [language, setLanguage] = useState('javascript');
    const [code, setCode] = useState(boilerplate.javascript); // Start with boilerplate
    const [stdin, setStdin] = useState('');
    const [output, setOutput] = useState('');

    const socketRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    useEffect(() => {
        // Redirect back to join page if no username is provided
        if (!userName) {
            navigate('/');
            toast.error("Username is required to enter a room.");
            return;
        }

        socketRef.current = io(SERVER_URL);
        const socket = socketRef.current;
        
        socket.emit('join', { roomId, username: userName });

        // --- All your socket.on() listeners remain exactly the same ---
        // socket.on('joined', ...);
        // socket.on('code-change', ...);
        // ... etc. ...

        return () => {
            // Cleanup logic remains the same
        };
    }, [userName, roomId, navigate]); // Add roomId and navigate to dependency array

    // --- All your handler functions remain the same ---
    // handleLeaveRoom, handleCopyRoomId, handleCodeChange, etc.
    // Small change to handleLeaveRoom:
    const handleLeaveRoom = () => {
        navigate('/'); // Navigate back to the join page
    };

    const handleCopyRoomId = () => {
        // Now we can copy the full URL
        navigator.clipboard.writeText(window.location.href);
        toast.success('Share link copied to clipboard!');
    };

    // --- The JSX for the editor page remains almost the same ---
    // Just ensure you are not conditionally rendering based on a 'joined' state
    return (
        <div className="editor-container">
            {/* The entire JSX for the sidebar and editor wrapper goes here */}
        </div>
    );
};

export default EditorPage;