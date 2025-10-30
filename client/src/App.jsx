import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import PlaylistCreator from './pages/radio/PlaylistCreator'
import DJController from './pages/radio/DJController'
import Library from './pages/radio/Library'
import MusicCollection from './pages/radio/MusicCollection'
import Schedule from './pages/radio/Schedule'
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-bg-dark-secondary">
        <ToastContainer
            position="bottom-right"
            autoClose={4000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="dark"
        />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/radio/playlist-creator" element={<PlaylistCreator />} />
          <Route path="/radio/playlist-creator/:playlistId" element={<PlaylistCreator />} />
          <Route path="/radio/dj" element={<DJController />} />
          <Route path="/radio/library" element={<Library />} />
          <Route path="/radio/collection" element={<MusicCollection />} />
          <Route path="/radio/schedule" element={<Schedule />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App