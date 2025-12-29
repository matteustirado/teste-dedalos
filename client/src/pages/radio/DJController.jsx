import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';
import axios from 'axios';
import Sidebar from '../../components/Sidebar';

const API_URL = 'http://localhost:4000';

const formatDuration = (totalSeconds) => {
    if (typeof totalSeconds !== 'number' || totalSeconds < 0) return '0:00';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const AlbumArtVinyl = ({ musicaAtual }) => {
  const thumbnailUrl = musicaAtual?.thumbnail_url || 'https://placehold.co/300x300/1e1e1e/333333?text=Rádio+Dedalos';
  return (
    <div className="relative w-72 h-40 flex-shrink-0">
      <div 
        className="absolute top-1/2 left-1/2 h-[90%] aspect-square rounded-full flex items-center justify-center border-4 border-gray-800 shadow-xl transition-transform duration-500 ease-out"
        style={{
          background: 'conic-gradient(from 0deg, #111 0deg, #333 45deg, #111 90deg, #333 135deg, #111 180deg, #333 225deg, #111 270deg, #333 315deg, #111 360deg)',
          animation: musicaAtual ? 'spin 3s linear infinite' : 'none',
          transform: musicaAtual ? 'translate(50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.8)',
          opacity: musicaAtual ? 1 : 0,
          zIndex: 0 
        }}
      >
        <div className="absolute w-[95%] h-[95%] rounded-full border border-white/5"></div>
        <div className="absolute w-[60%] h-[60%] rounded-full border border-white/5"></div>
        <div className="w-1/3 h-1/3 bg-primary rounded-full border-4 border-gray-900 shadow-inner flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
        </div>
      </div>
      <img
        key={thumbnailUrl}
        src={thumbnailUrl}
        alt="Capa do Álbum"
        className="relative z-10 w-full h-full object-cover rounded-lg shadow-lg animate-fade-in"
      />
      <style>{`
        @keyframes spin { from { transform: translate(50%, -50%) rotate(0deg); } to { transform: translate(50%, -50%) rotate(360deg); } }
        @keyframes fade-in { from { opacity: 0.5; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.5s ease-out; }
      `}</style>
    </div>
  );
};

const ProgressBar = ({ progresso, crossfadeInfo }) => {
    const { tempoAtual, tempoTotal } = progresso;
    const progressPercent = tempoTotal > 0 ? (tempoAtual / tempoTotal) * 100 : 0;
    let crossfadeProgressPercent = 0;
    const crossfadeDuration = 4;
    
    if (crossfadeInfo && tempoTotal > 0) {
        const tempoInicioCrossfade = tempoTotal - crossfadeDuration;
        if (tempoAtual > tempoInicioCrossfade) {
            const progressoCrossfade = (tempoAtual - tempoInicioCrossfade) / crossfadeDuration;
            crossfadeProgressPercent = Math.min(progressoCrossfade * 100, 100);
        }
    }
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${String(secs).padStart(2, '0')}`;
    }
    
    return (
        <div className="w-full py-2">
            <div className="relative w-full h-1.5 bg-white/20 rounded-full">
                <div 
                    className="absolute top-0 left-0 h-1.5 rounded-full bg-gradient-to-r from-primary to-orange-500"
                    style={{ width: `${progressPercent}%`, transition: 'width 250ms linear' }}
                ></div>
                <div 
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-primary shadow"
                    style={{ left: `${progressPercent}%`, transition: 'left 250ms linear' }}
                ></div>

                {crossfadeInfo && (
                    <>
                        <div 
                            className="absolute top-0 left-0 h-1.5 rounded-full bg-gradient-to-r from-red-600 to-orange-500 opacity-75"
                            style={{ width: `${crossfadeProgressPercent}%`, transition: 'width 250ms linear' }}
                        ></div>
                        <div 
                            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-red-600 shadow"
                            style={{ left: `${crossfadeProgressPercent}%`, transition: 'left 250ms linear' }}
                        ></div>
                    </>
                )}
            </div>
            <div className="flex justify-between text-xs text-text-muted mt-1">
                <span>{formatTime(tempoAtual)}</span>
                <span>{formatTime(tempoTotal)}</span>
            </div>
        </div>
    );
};

export default function DJController() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null); // Ref para o input de arquivo
  
  const [socket, setSocket] = useState(null);
  const [musicaAtual, setMusicaAtual] = useState(null);
  const [fila, setFila] = useState([]);
  const [progresso, setProgresso] = useState({ tempoAtual: 0, tempoTotal: 0 });
  const [isConnected, setIsConnected] = useState(false);
  const [activeOverlay, setActiveOverlay] = useState(null); // Estado para saber se tem overlay
  
  const [isMuted, setIsMuted] = useState(() => {
      return localStorage.getItem('dedalos_local_mute') === 'true';
  });
  
  const [crossfadeInfo, setCrossfadeInfo] = useState(null);
  
  const [playlists, setPlaylists] = useState([]);
  const [acervo, setAcervo] = useState([]);
  const [comerciais, setComerciais] = useState([]);
  const [buscaAcervo, setBuscaAcervo] = useState("");
  
  useEffect(() => {
    const newSocket = io(API_URL);
    setSocket(newSocket);
    console.log("[DJController] Conectando ao Maestro...");

    newSocket.on('connect', () => { setIsConnected(true); });
    newSocket.on('disconnect', () => { setIsConnected(false); });
    
    newSocket.on('maestro:estadoCompleto', (estado) => {
        setMusicaAtual(estado.musicaAtual || null);
        setProgresso({
            tempoAtual: estado.tempoAtualSegundos || 0,
            tempoTotal: estado.musicaAtual ? (estado.musicaAtual.end_segundos ?? estado.musicaAtual.duracao_segundos) : 0
        });
        setCrossfadeInfo(null);
        setActiveOverlay(estado.overlayUrl); // Recebe overlay atual
    });
    
    newSocket.on('maestro:filaAtualizada', (novaFila) => { setFila(novaFila || []); });
    
    newSocket.on('maestro:progresso', (info) => { 
        setProgresso(info); 
    });
    
    newSocket.on('maestro:iniciarCrossfade', ({ playerAtivo, proximoPlayer, proximaMusica }) => {
        setCrossfadeInfo({ playerAtivo, proximoPlayer, proximaMusica });
    });
    
    newSocket.on('maestro:tocarAgora', ({ player, musicaInfo }) => {
         setMusicaAtual(musicaInfo);
         setCrossfadeInfo(null);
         setProgresso({ tempoAtual: 0, tempoTotal: musicaInfo.end_segundos ?? musicaInfo.duracao_segundos });
    });
    
    newSocket.on('maestro:pararTudo', () => {
        setMusicaAtual(null);
        setProgresso({ tempoAtual: 0, tempoTotal: 0 });
        setCrossfadeInfo(null);
    });

    // Escuta atualização de overlay em tempo real
    newSocket.on('maestro:overlayAtualizado', (url) => {
        setActiveOverlay(url);
    });

    axios.get(`${API_URL}/api/playlists`)
        .then(res => setPlaylists(res.data || []))
        .catch(err => toast.error("Falha ao carregar playlists."));
        
    axios.get(`${API_URL}/api/tracks`)
        .then(res => {
            setAcervo(res.data.filter(t => !t.is_commercial) || []);
            setComerciais(res.data.filter(t => t.is_commercial) || []);
        })
        .catch(err => toast.error("Falha ao carregar acervo/comerciais."));

    return () => { newSocket.disconnect(); };
  }, []); 

  const handlePularMusica = () => { if (socket) socket.emit('dj:pularMusica'); }
  const handleTocarComercialAgora = (trackId = null) => {
      if (socket) socket.emit('dj:tocarComercialAgora', trackId); 
  }
  
  const handleMuteToggle = () => { 
      const newState = !isMuted;
      setIsMuted(newState);
      localStorage.setItem('dedalos_local_mute', newState);
      window.dispatchEvent(new Event('storage'));
  }

  // --- LÓGICA DE UPLOAD DE OVERLAY ---
  const handleOverlayClick = () => {
      fileInputRef.current.click();
  }

  const handleOverlayUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('overlay', file);

      try {
          await axios.post(`${API_URL}/api/overlay`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
          });
          toast.success("Marca d'água atualizada!");
      } catch (err) {
          console.error(err);
          toast.error("Erro ao enviar marca d'água.");
      }
      // Limpa o input
      e.target.value = null;
  }

  const handleRemoveOverlay = async (e) => {
      e.preventDefault(); // Previne abrir o seletor de arquivos se clicar com botão direito
      e.stopPropagation();
      if(window.confirm("Remover marca d'água da tela?")) {
        try {
            await axios.delete(`${API_URL}/api/overlay`);
            toast.info("Marca d'água removida.");
        } catch (err) {
            toast.error("Erro ao remover.");
        }
      }
  }
  // ------------------------------------
  
  const handleCarregarPlaylist = (playlistId) => {
      if (socket) socket.emit('dj:carregarPlaylistManual', playlistId);
  }
  const handleDjAdicionarPedido = (trackId) => {
       if (socket) socket.emit('dj:adicionarPedido', trackId);
       setBuscaAcervo("");
  }
  
  const handleVeto = (itemId) => { if (socket && itemId) { socket.emit('dj:vetarPedido', itemId); } }
  
  const getTagInfo = (item) => {
       switch (item.tipo) {
           case 'COMERCIAL_MANUAL': return { text: 'COMERCIAL', color: 'bg-yellow-500/20 text-yellow-400' };
           case 'DJ_PEDIDO': return { text: 'DJ', color: 'bg-blue-500/20 text-blue-400' };
           case 'JUKEBOX': return { text: item.unidade || 'JUKEBOX', color: 'bg-green-500/20 text-green-400' };
           case 'PLAYLIST': return { text: 'PLAYLIST', color: 'bg-purple-500/20 text-purple-400' };
           default: return { text: '??', color: 'bg-gray-500/20 text-gray-400' };
       }
  }
  
  const acervoFiltrado = useMemo(() => {
       if (!buscaAcervo) return [];
       return acervo
           .filter(t => t.titulo.toLowerCase().includes(buscaAcervo.toLowerCase()))
           .slice(0, 5);
  }, [buscaAcervo, acervo]);


  return (
    <div className="min-h-screen bg-gradient-warm flex">
      <Sidebar 
        activePage="dj" 
        headerTitle="Painel do DJ" 
        headerIcon="radio"
        headerExtra={
            <span className={`absolute bottom-0 right-0 block h-3.5 w-3.5 rounded-full border-2 border-bg-dark-primary ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
        }
      />
      
      {/* Input Oculto para Upload */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleOverlayUpload} 
        accept="image/png" 
        className="hidden" 
      />

      <main className="ml-64 flex-1 p-8 overflow-y-auto">
        <div className="grid grid-cols-3 gap-6">
          
          <div className="col-span-3 lg:col-span-2 flex flex-col gap-6">
            
            <div className="liquid-glass rounded-xl p-6" style={{ height: '280px' }}>
              <h1 className="text-2xl font-bold text-white mb-4">Tocando Agora</h1>
              <div className="flex gap-6 items-start">
                  <AlbumArtVinyl musicaAtual={musicaAtual} />
                  
                  <div className="flex flex-col gap-3 w-full flex-1 min-w-0 pl-14">
                      {musicaAtual ? (
                          <div className="animate-fade-in text-left">
                               <p className="text-white text-xl font-bold leading-tight truncate" title={musicaAtual.titulo}>{musicaAtual.titulo}</p>
                               <p className="text-text-muted text-base font-medium">{musicaAtual.artista}</p>
                          </div>
                      ) : (
                          <div className="text-left">
                               <p className="text-white text-xl font-bold leading-tight truncate">Rádio Dedalos</p>
                               <p className="text-text-muted text-base font-medium">{isConnected ? "Carregando..." : "Desconectado"}</p>
                          </div>
                      )}
                      
                      <div className="flex items-center justify-start gap-3">
                          <button 
                            onClick={handleMuteToggle} 
                            className={`flex shrink-0 items-center justify-center rounded-full w-14 h-14 transition-all duration-300 ${isMuted ? 'bg-white/20 text-red-400 hover:bg-white/30' : 'bg-primary text-white hover:bg-primary/80'}`}
                            title={isMuted ? "Ativar Som (Monitor)" : "Mutar Som (Monitor)"}
                          >
                            <span className="material-symbols-outlined text-3xl">
                                {isMuted ? 'volume_off' : 'volume_up'}
                            </span>
                          </button>
                          
                          <button 
                            onClick={handlePularMusica}
                            className="flex shrink-0 items-center justify-center rounded-full w-10 h-10 text-white hover:text-primary transition-colors"
                            title="Pular Música (Global)"
                          >
                            <span className="material-symbols-outlined text-2xl">skip_next</span>
                          </button>

                          {/* BOTÃO DE OVERLAY (MARCA D'ÁGUA) */}
                          <div className="h-8 w-px bg-white/10 mx-1"></div>
                          
                          <button 
                            onClick={handleOverlayClick}
                            onContextMenu={handleRemoveOverlay} // Clique direito para remover
                            className={`flex shrink-0 items-center justify-center rounded-full w-10 h-10 transition-colors ${activeOverlay ? 'bg-blue-500 text-white hover:bg-blue-600' : 'text-white hover:text-blue-400'}`}
                            title="Adicionar Marca D'água (Overlay) - Clique Direito para remover"
                          >
                            <span className="material-symbols-outlined text-2xl">branding_watermark</span>
                          </button>

                      </div>

                      <ProgressBar progresso={progresso} crossfadeInfo={crossfadeInfo} />
                  </div>
              </div>
            </div>
            
            <div className="liquid-glass rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">Próximos na Fila</h2>
                <div className="flex items-center gap-2 relative">
                  <input 
                    className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white text-sm placeholder:text-text-muted focus:ring-2 focus:ring-primary w-64" 
                    placeholder="Buscar no Acervo para adicionar..." 
                    type="text"
                    value={buscaAcervo}
                    onChange={(e) => setBuscaAcervo(e.target.value)}
                  />
                  {buscaAcervo && acervoFiltrado.length > 0 && (
                      <div className="absolute top-full right-0 w-64 mt-2 bg-bg-dark-secondary border border-white/10 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                          {acervoFiltrado.map(track => (
                              <div 
                                key={track.id} 
                                onClick={() => handleDjAdicionarPedido(track.id)}
                                className="p-3 hover:bg-primary/20 cursor-pointer"
                              >
                                  <p className="text-white text-sm font-medium truncate">{track.titulo}</p>
                                  <p className="text-text-muted text-xs truncate">{track.artista}</p>
                              </div>
                          ))}
                      </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {fila.length === 0 && <p className="text-text-muted text-sm text-center py-4">Fila de pedidos vazia.</p>}
                
                {fila.map((item, index) => {
                    const tag = getTagInfo(item);
                    return (
                        <div key={`${item.id}-${index}`} className="flex items-center p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                            <span className="text-lg text-text-muted font-mono w-6 text-left">{index + 1}.</span>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-white text-sm truncate" title={item.titulo}>{item.titulo || "Carregando..."}</p>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tag.color}`}>
                                    {tag.text}
                                </span>
                            </div>
                            <button 
                                onClick={() => handleVeto(item.id)}
                                className="p-1 text-red-500 hover:bg-red-500/20 rounded-full"
                                title="Vetar este pedido"
                            >
                                <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                        </div>
                    );
                })}
              </div>
            </div>
          </div>

          <div className="col-span-3 lg:col-span-1 flex flex-col gap-6">
            
            <div className="liquid-glass rounded-xl p-6" style={{ height: '280px' }}>
              <h2 className="text-xl font-bold text-white mb-4">Playlists</h2>
              <div className="space-y-3 mb-3 overflow-y-auto h-36 pr-2">
                {playlists.length === 0 && <p className="text-text-muted text-sm">Carregando playlists...</p>}
                {playlists.map((playlist) => (
                  <div key={playlist.id} className="bg-white/5 p-4 rounded-lg flex items-center justify-between hover:bg-white/10 transition-colors">
                    <div>
                      <p className="font-semibold text-white text-sm truncate" title={playlist.nome}>{playlist.nome}</p>
                      <p className="text-xs text-text-muted">{playlist.tracks_ids.length} músicas</p>
                    </div>
                    <button 
                        onClick={() => handleCarregarPlaylist(playlist.id)}
                        className="bg-primary/20 text-primary px-3 py-1 rounded-md text-xs font-semibold hover:bg-primary/30 transition-colors"
                        title="Carregar esta playlist (modo manual)"
                    >
                        Carregar
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => navigate('/radio/library')} className="w-full bg-white/10 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white/20 transition-colors mb-2">Ver Mais</button>
            </div>
            
            <div className="liquid-glass rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Comerciais</h2>
              <div className="space-y-3 mb-3 max-h-48 overflow-y-auto pr-2">
                {comerciais.length === 0 && <p className="text-text-muted text-sm">Nenhum comercial encontrado.</p>}
                {comerciais.map((commercial) => (
                  <div key={commercial.id} className="bg-white/5 p-3 rounded-lg flex items-center justify-between hover:bg-white/10 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-sm truncate">{commercial.titulo}</p>
                      <p className="text-xs text-text-muted">{formatDuration(commercial.end_segundos - commercial.start_segundos)}</p>
                    </div>
                    <button 
                        onClick={() => handleTocarComercialAgora(commercial.id)}
                        className="text-primary hover:text-primary/80 transition-colors"
                        title="Tocar este comercial agora (Prioridade)"
                    >
                      <span className="material-symbols-outlined">play_circle</span>
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => navigate('/radio/collection')} className="w-full bg-white/10 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white/20 transition-colors">Gerenciar Comerciais</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}