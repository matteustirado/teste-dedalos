import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import YouTube from 'react-youtube';

const API_URL = 'http://localhost:4000';
const CROSSFADE_DURATION_MS = 4000;
const SILENT_AUDIO_URI = "data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";

const playerOptions = {
  height: '100%',
  width: '100%',
  playerVars: {
    autoplay: 1,
    controls: 0,
    disablekb: 1,
    fs: 0,
    iv_load_policy: 3,
    modestbranding: 1,
    rel: 0,
    playsinline: 1,
  },
};

const fadeVolume = (player, startVol, endVol, duration) => {
    if (!player || typeof player.setVolume !== 'function') return;
    
    let currentVol = startVol;
    const intervalTime = 50;
    const step = (endVol - startVol) / (duration / intervalTime);

    player.setVolume(currentVol);

    const timer = setInterval(() => {
        currentVol += step;
        
        if ((step > 0 && currentVol >= endVol) || (step < 0 && currentVol <= endVol)) {
            player.setVolume(endVol);
            if (endVol === 0) {
                player.pauseVideo();
            }
            clearInterval(timer);
        } else {
            player.setVolume(currentVol);
        }
    }, intervalTime);
};

export default function WatchVideo() {
  const playerARef = useRef(null);
  const playerBRef = useRef(null);
  const pendingStateRef = useRef(null);
  const keepAliveAudioRef = useRef(null);

  const [playerA, setPlayerA] = useState({ videoId: null, opacity: 0 });
  const [playerB, setPlayerB] = useState({ videoId: null, opacity: 0 });
  
  const [overlayUrl, setOverlayUrl] = useState(null);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('dedalos_local_mute') === 'true');

  const [currentTrackInfo, setCurrentTrackInfo] = useState(null);
  const [showTrackInfo, setShowTrackInfo] = useState(false);

  // --- KEEP ALIVE ---
  useEffect(() => {
    const startKeepAlive = () => {
        if (keepAliveAudioRef.current) {
            keepAliveAudioRef.current.play().catch(() => {});
        }
    };
    startKeepAlive();
    window.addEventListener('click', startKeepAlive);
    return () => window.removeEventListener('click', startKeepAlive);
  }, []);

  // --- CRÉDITOS ---
  useEffect(() => {
    const timer = setInterval(async () => {
        let activePlayer = null;
        if (playerA.opacity === 1 && playerARef.current) activePlayer = playerARef.current;
        else if (playerB.opacity === 1 && playerBRef.current) activePlayer = playerBRef.current;

        if (activePlayer && typeof activePlayer.getCurrentTime === 'function' && currentTrackInfo) {
            try {
                const time = await activePlayer.getCurrentTime();
                const duration = currentTrackInfo.end_segundos || currentTrackInfo.duracao_segundos || 0;

                const isIntro = time >= 10 && time < 20;
                const isOutro = duration > 30 && (time >= (duration - 20) && time < (duration - 10));
                
                if (isIntro || isOutro) {
                    setShowTrackInfo(true);
                } else {
                    setShowTrackInfo(false);
                }
            } catch (e) {}
        }
    }, 500);
    return () => clearInterval(timer);
  }, [playerA, playerB, currentTrackInfo]);

  // --- MUTE SYNC ---
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'dedalos_local_mute') {
        const novoEstado = e.newValue === 'true';
        setIsMuted(novoEstado);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    const handleLocalEvent = () => {
         const localState = localStorage.getItem('dedalos_local_mute') === 'true';
         setIsMuted(localState);
    };
    window.addEventListener('dedalos_mute_update', handleLocalEvent);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('dedalos_mute_update', handleLocalEvent);
    };
  }, []);

  useEffect(() => {
      const applyMuteInfo = (player) => {
          if (player && typeof player.mute === 'function') {
              if (isMuted) { player.mute(); } else { player.unMute(); }
          }
      };
      applyMuteInfo(playerARef.current);
      applyMuteInfo(playerBRef.current);
  }, [isMuted]);

  const syncAndPlay = (playerInstance, videoId, startSeconds, volume = 100) => {
      if (!playerInstance) return;
      console.log(`[WatchVideo] Sincronizando: ${videoId} em ${startSeconds}s`);
      playerInstance.loadVideoById({ videoId: videoId, startSeconds: startSeconds });
      playerInstance.setVolume(volume);
      if (isMuted) playerInstance.mute(); else playerInstance.unMute();
      playerInstance.playVideo();
  };

  const handlePlayerReady = (event, playerKey) => {
      const playerInstance = event.target;
      if (playerKey === 'A') playerARef.current = playerInstance;
      else playerBRef.current = playerInstance;
      if (isMuted) playerInstance.mute();
      
      console.log(`[WatchVideo] Player ${playerKey} pronto.`);
      
      if (pendingStateRef.current) {
          const { playerAtivo, musicaInfo, tempoAtualSegundos } = pendingStateRef.current;
          if (playerAtivo === playerKey && musicaInfo) {
               const startEfetivo = (musicaInfo.start_segundos || 0) + tempoAtualSegundos;
               if (playerKey === 'A') {
                   setPlayerA({ videoId: musicaInfo.youtube_id, opacity: 1 });
                   setPlayerB(p => ({...p, opacity: 0}));
                   syncAndPlay(playerInstance, musicaInfo.youtube_id, startEfetivo, 100);
               } else {
                   setPlayerB({ videoId: musicaInfo.youtube_id, opacity: 1 });
                   setPlayerA(p => ({...p, opacity: 0}));
                   syncAndPlay(playerInstance, musicaInfo.youtube_id, startEfetivo, 100);
               }
               pendingStateRef.current = null;
          }
      }
  };

  useEffect(() => {
    const socket = io(API_URL);
    console.log("[WatchVideo] Conectando ao Maestro...");

    socket.on('maestro:estadoCompleto', (estado) => {
        if (estado.overlayUrl) { setOverlayUrl(`${API_URL}${estado.overlayUrl}`); } 
        else { setOverlayUrl(null); }

        if (estado.musicaAtual && estado.playerAtivo) {
            console.log("[WatchVideo] Estado inicial recebido:", estado);
            setCurrentTrackInfo(estado.musicaAtual);
            const startEfetivo = (estado.musicaAtual.start_segundos || 0) + (estado.tempoAtualSegundos || 0);
            
            if (estado.playerAtivo === 'A') {
                setPlayerA({ videoId: estado.musicaAtual.youtube_id, opacity: 1 });
                setPlayerB(prev => ({ ...prev, opacity: 0 }));
            } else {
                setPlayerB({ videoId: estado.musicaAtual.youtube_id, opacity: 1 });
                setPlayerA(prev => ({ ...prev, opacity: 0 }));
            }
            
            pendingStateRef.current = { playerAtivo: estado.playerAtivo, musicaInfo: estado.musicaAtual, tempoAtualSegundos: estado.tempoAtualSegundos || 0 };
            
            // Tenta aplicar imediatamente se possível
            if (estado.playerAtivo === 'A' && playerARef.current) {
                 syncAndPlay(playerARef.current, estado.musicaAtual.youtube_id, startEfetivo, 100);
                 pendingStateRef.current = null;
            } 
            else if (estado.playerAtivo === 'B' && playerBRef.current) {
                 syncAndPlay(playerBRef.current, estado.musicaAtual.youtube_id, startEfetivo, 100);
                 pendingStateRef.current = null;
            }
        }
    });

    socket.on('maestro:overlayAtualizado', (url) => {
        if (url) setOverlayUrl(`${API_URL}${url}`);
        else setOverlayUrl(null);
    });

    socket.on('maestro:tocarAgora', ({ player, musicaInfo }) => {
      console.log(`[WatchVideo] 'tocarAgora' (Player ${player})`, musicaInfo);
      setCurrentTrackInfo(musicaInfo);
      setShowTrackInfo(false); 

      const { youtube_id, start_segundos } = musicaInfo;
      const startEfetivo = start_segundos || 0;

      if (player === 'A') {
        setPlayerA({ videoId: youtube_id, opacity: 1 });
        setPlayerB(prev => ({ ...prev, opacity: 0 }));
        
        // CORREÇÃO CRÍTICA DO CROSSFADE:
        // Se o Player A já estiver com este vídeo carregado (vindo do crossfade), NÃO recarregue.
        const playerInstance = playerARef.current;
        if (playerInstance) {
            // Verifica se o vídeo já está carregado ou tocando
            const currentVideoUrl = playerInstance.getVideoUrl();
            const isSameVideo = currentVideoUrl && currentVideoUrl.includes(youtube_id);
            
            if (isSameVideo) {
                console.log("[WatchVideo] Vídeo já está no player A (pós-crossfade). Apenas garantindo volume/visibilidade.");
                playerInstance.setVolume(100);
                if (isMuted) playerInstance.mute(); else playerInstance.unMute();
                // Não chama loadVideoById aqui para não resetar o tempo
            } else {
                syncAndPlay(playerInstance, youtube_id, startEfetivo, 100);
            }
        } else {
             pendingStateRef.current = { playerAtivo: 'A', musicaInfo, tempoAtualSegundos: 0 };
        }
        
        // Para o outro player
        if (playerBRef.current) playerBRef.current.stopVideo();
        
      } else {
        // Lógica espelhada para o Player B
        setPlayerB({ videoId: youtube_id, opacity: 1 });
        setPlayerA(prev => ({ ...prev, opacity: 0 }));
        
        const playerInstance = playerBRef.current;
        if (playerInstance) {
            const currentVideoUrl = playerInstance.getVideoUrl();
            const isSameVideo = currentVideoUrl && currentVideoUrl.includes(youtube_id);

            if (isSameVideo) {
                console.log("[WatchVideo] Vídeo já está no player B (pós-crossfade). Apenas garantindo volume/visibilidade.");
                playerInstance.setVolume(100);
                if (isMuted) playerInstance.mute(); else playerInstance.unMute();
            } else {
                syncAndPlay(playerInstance, youtube_id, startEfetivo, 100);
            }
        } else {
             pendingStateRef.current = { playerAtivo: 'B', musicaInfo, tempoAtualSegundos: 0 };
        }
        
        if (playerARef.current) playerARef.current.stopVideo();
      }
    });

    socket.on('maestro:iniciarCrossfade', ({ playerAtivo, proximoPlayer, proximaMusica }) => {
      // Nota: Não atualizamos currentTrackInfo aqui para não mostrar os créditos da próxima música antes da hora
      const { youtube_id, start_segundos } = proximaMusica;
      const startEfetivo = start_segundos || 0;

      if (proximoPlayer === 'B') {
        setPlayerB({ videoId: youtube_id, opacity: 1 });
        if (playerBRef.current) {
            playerBRef.current.loadVideoById({ videoId: youtube_id, startSeconds: startEfetivo });
            playerBRef.current.setVolume(0); // Começa mudo
            if(isMuted) playerBRef.current.mute();
            playerBRef.current.playVideo();
            fadeVolume(playerBRef.current, 0, 100, CROSSFADE_DURATION_MS); // Sobe o som
        }
        setPlayerA(prev => ({ ...prev, opacity: 0 }));
        if (playerARef.current) { fadeVolume(playerARef.current, 100, 0, CROSSFADE_DURATION_MS); } // Desce o som do atual
      } else {
        setPlayerA({ videoId: youtube_id, opacity: 1 });
        if (playerARef.current) {
            playerARef.current.loadVideoById({ videoId: youtube_id, startSeconds: startEfetivo });
            playerARef.current.setVolume(0);
            if(isMuted) playerARef.current.mute();
            playerARef.current.playVideo();
            fadeVolume(playerARef.current, 0, 100, CROSSFADE_DURATION_MS);
        }
        setPlayerB(prev => ({ ...prev, opacity: 0 }));
        if (playerBRef.current) { fadeVolume(playerBRef.current, 100, 0, CROSSFADE_DURATION_MS); }
      }
    });
    
    socket.on('maestro:pararTudo', () => {
        if (playerARef.current) playerARef.current.stopVideo();
        if (playerBRef.current) playerBRef.current.stopVideo();
        setPlayerA({ videoId: null, opacity: 0 });
        setPlayerB({ videoId: null, opacity: 0 });
        setCurrentTrackInfo(null);
        setShowTrackInfo(false);
    });

    return () => {
      socket.off('maestro:estadoCompleto');
      socket.off('maestro:overlayAtualizado');
      socket.off('maestro:tocarAgora');
      socket.off('maestro:iniciarCrossfade');
      socket.off('maestro:pararTudo');
      socket.disconnect();
    };
  }, []); 

  const getArtistDisplay = () => {
      if (!currentTrackInfo) return '';
      let text = currentTrackInfo.artista || '';
      if (currentTrackInfo.artistas_participantes && Array.isArray(currentTrackInfo.artistas_participantes) && currentTrackInfo.artistas_participantes.length > 0) {
          text += ` feat. ${currentTrackInfo.artistas_participantes.join(', ')}`;
      }
      return text;
  };

  // ESTILO UNIFICADO PARA OS METADADOS
  const metaContainerClass = "bg-black/50 backdrop-blur-sm px-4 py-1 rounded-r-full border-l-4 border-gray-400 shadow-md";
  const metaTextClass = "text-gray-200 text-base font-medium drop-shadow-md";
  const metaLabelClass = "text-primary/90 font-bold uppercase text-xs mr-2 tracking-wider";

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden cursor-none">
      
      <audio ref={keepAliveAudioRef} src={SILENT_AUDIO_URI} loop autoPlay muted={false} volume={0.01} style={{ display: 'none' }} />

      {overlayUrl && (
          <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center">
              <img src={overlayUrl} alt="Overlay" className="w-full h-full object-contain" />
          </div>
      )}

      {/* CAMADA DE CRÉDITOS */}
      <div 
        className={`absolute bottom-16 left-16 z-40 pointer-events-none transition-all duration-1000 ease-in-out transform ${showTrackInfo && currentTrackInfo ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
      >
        {currentTrackInfo && (
            <div className="flex flex-col items-start space-y-1">
                <div className="bg-black/80 backdrop-blur-sm px-6 py-2 rounded-r-full border-l-4 border-primary shadow-lg mb-1">
                    <h1 className="text-white text-3xl font-bold font-display uppercase tracking-wide drop-shadow-md">
                        {currentTrackInfo.titulo}
                    </h1>
                </div>

                {(currentTrackInfo.artista || (currentTrackInfo.artistas_participantes && currentTrackInfo.artistas_participantes.length > 0)) && (
                     <div className="bg-black/70 backdrop-blur-sm px-5 py-1.5 rounded-r-full border-l-4 border-white shadow-lg mb-1">
                        <p className="text-gray-100 text-xl font-semibold drop-shadow-md">
                            {getArtistDisplay()}
                        </p>
                    </div>
                )}

                <div className="space-y-1">
                    {currentTrackInfo.album && (
                        <div className={metaContainerClass}>
                            <p className={metaTextClass}>
                                <span className={metaLabelClass}>ÁLBUM:</span>
                                {currentTrackInfo.album}
                            </p>
                        </div>
                    )}
                    {currentTrackInfo.gravadora && (
                        <div className={metaContainerClass}>
                             <p className={metaTextClass}>
                                <span className={metaLabelClass}>GRAVADORA:</span>
                                {currentTrackInfo.gravadora}
                            </p>
                        </div>
                    )}
                    {currentTrackInfo.diretor && (
                        <div className={metaContainerClass}>
                             <p className={metaTextClass}>
                                <span className={metaLabelClass}>DIRETOR DO VIDEOCLIPE:</span>
                                {currentTrackInfo.diretor}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>

      <div className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: playerA.opacity, transition: `opacity ${CROSSFADE_DURATION_MS}ms linear` }}>
        {playerA.videoId && (
          <YouTube videoId={playerA.videoId} opts={playerOptions} onReady={(e) => handlePlayerReady(e, 'A')} className="w-full h-full pointer-events-none" />
        )}
      </div>
      <div className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: playerB.opacity, transition: `opacity ${CROSSFADE_DURATION_MS}ms linear` }}>
        {playerB.videoId && (
          <YouTube videoId={playerB.videoId} opts={playerOptions} onReady={(e) => handlePlayerReady(e, 'B')} className="w-full h-full pointer-events-none" />
        )}
      </div>
    </div>
  );
}