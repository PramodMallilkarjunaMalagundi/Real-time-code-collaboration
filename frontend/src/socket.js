// Filename: frontend/src/socket.js

import { io } from 'socket.io-client';

export const initSocket = async () => {
    const options = {
        'force new connection': true,
        reconnectionAttempt: 'Infinity',
        timeout: 10000,
        transports: ['websocket'],
    };

    // THIS IS THE FIX: We are using the direct URL to your local server
    // instead of an environment variable which is not set.
    return io('http://localhost:5173', options);
};