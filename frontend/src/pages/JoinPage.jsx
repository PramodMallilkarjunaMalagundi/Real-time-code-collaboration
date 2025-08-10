// In frontend/src/pages/JoinPage.jsx

import React, { useState } from 'react';
import { v4 as uuidV4 } from 'uuid'; // Import the UUID generator
import { useNavigate } from 'react-router-dom'; // Import the navigation hook
import toast from 'react-hot-toast';

const JoinPage = () => {
    const navigate = useNavigate();
    const [roomId, setRoomId] = useState('');
    const [userName, setUserName] = useState('');

    const createNewRoom = (e) => {
        e.preventDefault();
        const id = uuidV4(); // Generate a unique ID
        setRoomId(id);
        toast.success('Created a new room');
    };

    const joinRoom = () => {
        if (!roomId || !userName) {
            toast.error('Room ID & username is required');
            return;
        }
        // Navigate to the editor page with the room ID and pass the username
        navigate(`/editor/${roomId}`, {
            state: {
                userName,
            },
        });
    };

    const handleInputEnter = (e) => {
        if (e.code === 'Enter') {
            joinRoom();
        }
    };

    return (
        <div className="join-container">
            <div className="join-form">
                <h1>Real-Time Code Editor</h1>
                <input
                    type="text"
                    placeholder="Enter Room ID"
                    onChange={(e) => setRoomId(e.target.value)}
                    value={roomId}
                    onKeyUp={handleInputEnter}
                />
                <input
                    type="text"
                    placeholder="Your Name"
                    onChange={(e) => setUserName(e.target.value)}
                    value={userName}
                    onKeyUp={handleInputEnter}
                />
                <button className="btn-join" onClick={joinRoom}>Join</button>
                <p className="create-room-info">
                    Don't have an invite?&nbsp;
                    <a onClick={createNewRoom} href="" className="create-new-btn">
                        Create a new room
                    </a>
                </p>
            </div>
        </div>
    );
};

export default JoinPage;