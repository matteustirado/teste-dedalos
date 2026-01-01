import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Páginas Gerais
import Home from './pages/Home';

// Rádio Dedalos
import DJController from './pages/radio/DJController';
import MusicCollection from './pages/radio/MusicCollection';
import PlaylistCreator from './pages/radio/PlaylistCreator';
import Library from './pages/radio/Library';
import Schedule from './pages/radio/Schedule';
import WatchVideo from './pages/radio/WatchVideo';
import Jukebox from './pages/radio/Jukebox';
import RequestHistory from './pages/radio/RequestHistory'; // Se existir

// Ferramentas de Manutenção
import GoldenThursday from './pages/tools/GoldenThursday'; // Importação da Quinta Premiada

function App() {
  return (
    <BrowserRouter>
      <ToastContainer 
        position="top-right" 
        autoClose={3000} 
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
        {/* Home */}
        <Route path="/" element={<Home />} />

        {/* Rádio Dedalos */}
        <Route path="/radio/dj" element={<DJController />} />
        <Route path="/radio/collection" element={<MusicCollection />} />
        <Route path="/radio/playlist-creator" element={<PlaylistCreator />} />
        <Route path="/radio/library" element={<Library />} />
        <Route path="/radio/schedule" element={<Schedule />} />
        <Route path="/radio/watch" element={<WatchVideo />} />
        
        {/* Rotas Públicas da Jukebox */}
        <Route path="/radio/jukebox" element={<Jukebox />} />
        <Route path="/radio/jukebox/:unidade" element={<Jukebox />} />

        {/* Ferramentas de Manutenção */}
        <Route path="/tools/thursday/:unidade" element={<GoldenThursday />} />
        
        {/* Fallback para rota sem unidade, redirecionando ou abrindo padrão (opcional) */}
        <Route path="/tools/thursday" element={<GoldenThursday />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;