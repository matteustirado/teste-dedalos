import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

// Importação das Páginas
import Home from './pages/Home'
import DJController from './pages/radio/DJController'
import MusicCollection from './pages/radio/MusicCollection'
import PlaylistCreator from './pages/radio/PlaylistCreator'
import Library from './pages/radio/Library'
import Schedule from './pages/radio/Schedule'
import WatchVideo from './pages/radio/WatchVideo'
import Jukebox from './pages/radio/Jukebox'

// NOVA PÁGINA: Histórico de Pedidos
import RequestHistory from './pages/radio/RequestHistory'

function App() {
  return (
    <Router>
      {/* Container de notificações global */}
      <ToastContainer 
        position="top-right" 
        autoClose={3000} 
        theme="dark" 
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />

      <Routes>
        {/* Home */}
        <Route path="/" element={<Home />} />
        
        {/* Ferramentas Administrativas da Rádio */}
        <Route path="/radio/dj" element={<DJController />} />
        <Route path="/radio/collection" element={<MusicCollection />} />
        <Route path="/radio/playlist-creator" element={<PlaylistCreator />} />
        <Route path="/radio/playlist-creator/:playlistId" element={<PlaylistCreator />} />
        <Route path="/radio/library" element={<Library />} />
        <Route path="/radio/schedule" element={<Schedule />} />
        
        {/* NOVA ROTA: Histórico de Pedidos */}
        <Route path="/radio/requests-history" element={<RequestHistory />} />
        
        {/* Visualização Pública (TV/Telão) */}
        <Route path="/radio/watch" element={<WatchVideo />} />

        {/* Interface do Cliente (Tablet) */}
        <Route path="/jukebox/:unidade" element={<Jukebox />} />
      </Routes>
    </Router>
  )
}

export default App