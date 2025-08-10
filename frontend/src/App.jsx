// In frontend/src/App.jsx

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import JoinPage from './pages/JoinPage';
import EditorPage from './pages/EditorPage';
import './App.css'; // Keep your global styles

const App = () => {
    return (
        <>
            {/* The Toaster is placed here so it's available on all pages */}
            <Toaster position="top-center" />
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<JoinPage />} />
                    <Route path="/editor/:roomId" element={<EditorPage />} />
                </Routes>
            </BrowserRouter>
        </>
    );
};

export default App;