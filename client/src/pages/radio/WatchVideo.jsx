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
    mute: 1, // Começa mudo
  },
};

const fadeVolume = (player, startVol, endVol, duration) => {
    if (!player || typeof player.setVolume !== 'function') return;
    let currentVol = startVol;
    const steps = 20;
    const stepTime = duration / steps;
    const volStep = (endVol - startVol) / steps;

    player.setVolume(currentVol);

    const timer = setInterval(() => {
        currentVol += volStep;
        if ((volStep > 0 && currentVol >= endVol) || (volStep < 0 && currentVol <= endVol)) {
            player.setVolume(endVol);
            clearInterval(timer);
        } else {
            player.setVolume(currentVol);
        }
    }, stepTime);
};

export default function WatchVideo() {
  // --- ESTADOS ---
  const [hasInteracted, setHasInteracted] = useState(false);
  const [radioState, setRadioState] = useState(null);
  
  // [NOVO] Monitora se o Iframe do YouTube realmente carregou
  const [isPlayerReady, setIsPlayerReady] = useState({ A: false, B: false });

  const playerARef = useRef(null);
  const playerBRef = useRef(null);
  const keepAliveAudioRef = useRef(null);

  // Memória para evitar reloads no mesmo vídeo
  const lastLoadedRef = useRef({ A: null, B: null });

  const [opacityA, setOpacityA] = useState(0);
  const [opacityB, setOpacityB] = useState(0);
  const [overlayUrl, setOverlayUrl] = useState(null);
  const [currentTrackInfo, setCurrentTrackInfo] = useState(null);
  const [showTrackInfo, setShowTrackInfo] = useState(false);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('dedalos_local_mute') === 'true');

  // --- SOCKET ---
  useEffect(() => {
    const socket = io(API_URL);
    
    socket.on('maestro:estadoCompleto', (estado) => {
        if (estado.overlayUrl) setOverlayUrl(`${API_URL}${estado.overlayUrl}`);
        setRadioState(estado);
        setCurrentTrackInfo(estado.musicaAtual);
    });

    socket.on('maestro:tocarAgora', ({ player, musicaInfo }) => {
        setRadioState({
            playerAtivo: player,
            musicaAtual: musicaInfo,
            tempoAtualSegundos: parseInt(musicaInfo.start_segundos) || 0
        });
        setCurrentTrackInfo(musicaInfo);
    });

    socket.on('maestro:iniciarCrossfade', ({ playerAtivo, proximoPlayer, proximaMusica }) => {
        setRadioState({
            playerAtivo: proximoPlayer,
            musicaAtual: proximaMusica,
            tempoAtualSegundos: parseInt(proximaMusica.start_segundos) || 0,
            isCrossfade: true 
        });
        setCurrentTrackInfo(proximaMusica);
    });
    
    socket.on('maestro:pararTudo', () => {
        if(playerARef.current) playerARef.current.stopVideo();
        if(playerBRef.current) playerBRef.current.stopVideo();
        setOpacityA(0); setOpacityB(0);
        setCurrentTrackInfo(null);
        lastLoadedRef.current = { A: null, B: null };
    });

    socket.on('maestro:overlayAtualizado', (url) => setOverlayUrl(url ? `${API_URL}${url}` : null));

    return () => socket.disconnect();
  }, []);

  // --- EXECUTOR (A MÁGICA DO REFRESH) ---
  // Este efeito roda quando: Clica, Recebe Dados OU o Player fica Pronto
  useEffect(() => {
      // 1. O usuário precisa ter clicado
      if (!hasInteracted) return;
      // 2. Precisamos ter dados da rádio
      if (!radioState || !radioState.musicaAtual) return;

      const { playerAtivo, musicaAtual, tempoAtualSegundos, isCrossfade } = radioState;
      
      // 3. [CRUCIAL] O player da vez precisa estar 100% carregado
      if (!isPlayerReady[playerAtivo]) {
          console.log(`[WatchVideo] Aguardando Player ${playerAtivo} carregar...`);
          return; // Espera o onPlayerReady disparar este efeito novamente
      }

      const videoId = musicaAtual.youtube_id;
      const startSeconds = Math.floor(tempoAtualSegundos);

      // Função de Carregamento
      const executeLoad = (player, pKey) => {
          const loadKey = `${videoId}_${startSeconds}`;
          
          // Se já carregamos esse vídeo/tempo específico, ignoramos (exceto se for refresh inicial)
          const isSameVideo = lastLoadedRef.current[pKey] && lastLoadedRef.current[pKey].startsWith(videoId);
          
          if (isSameVideo && !isCrossfade) return;
          
          lastLoadedRef.current[pKey] = loadKey;

          console.log(`[WatchVideo] Executando Player ${pKey}: ${videoId} iniciar em ${startSeconds}s`);
          
          // LINK COMPOSTO VIA OBJETO (Garante minutagem exata)
          player.mute();
          player.loadVideoById({
              videoId: videoId,
              startSeconds: startSeconds
          });
          player.playVideo();
      };

      if (playerAtivo === 'A') {
          setOpacityA(1);
          setOpacityB(0);
          
          if (playerARef.current) {
              executeLoad(playerARef.current, 'A');
              
              if (isCrossfade) {
                  playerARef.current.setVolume(0);
                  fadeVolume(playerARef.current, 0, 100, CROSSFADE_DURATION_MS);
              } else {
                  playerARef.current.setVolume(100);
              }
          }
          
          if (playerBRef.current && !isCrossfade) playerBRef.current.stopVideo();
          if (playerBRef.current && isCrossfade) fadeVolume(playerBRef.current, 100, 0, CROSSFADE_DURATION_MS);

      } else {
          setOpacityB(1);
          setOpacityA(0);

          if (playerBRef.current) {
              executeLoad(playerBRef.current, 'B');

              if (isCrossfade) {
                  playerBRef.current.setVolume(0);
                  fadeVolume(playerBRef.current, 0, 100, CROSSFADE_DURATION_MS);
              } else {
                  playerBRef.current.setVolume(100);
              }
          }
          
          if (playerARef.current && !isCrossfade) playerARef.current.stopVideo();
          if (playerARef.current && isCrossfade) fadeVolume(playerARef.current, 100, 0, CROSSFADE_DURATION_MS);
      }

  }, [hasInteracted, radioState, isPlayerReady]); // <--- Agora monitoramos a prontidão do player

  // --- EVENTOS DO PLAYER ---
  const onPlayerStateChange = (event) => {
      const player = event.target;
      const status = event.data;
      
      if (status === 1) { // Playing
          if (!isMuted) {
              if (player.getVolume() > 90) player.unMute();
              else player.unMute(); 
          }
      }
      
      // Fallback: Se pausar sozinho após interação, força play
      if ((status === 2 || status === 5) && hasInteracted) {
          player.playVideo();
      }
  };

  const onPlayerReady = (evt, key) => {
      console.log(`[WatchVideo] Player ${key} ON READY.`);
      if (key === 'A') playerARef.current = evt.target;
      else playerBRef.current = evt.target;
      
      evt.target.mute();
      
      // Atualiza estado para avisar o Executor que pode tocar
      setIsPlayerReady(prev => ({ ...prev, [key]: true }));
  };

  const handleInteraction = () => {
      setHasInteracted(true);
      if (keepAliveAudioRef.current) keepAliveAudioRef.current.play().catch(() => {});
      // Não precisamos forçar setRadioState aqui, pois 'hasInteracted' já dispara o useEffect
  };

  // --- HELPERS ---
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'dedalos_local_mute') setIsMuted(e.newValue === 'true');
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('dedalos_mute_update', () => setIsMuted(localStorage.getItem('dedalos_local_mute') === 'true'));
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
      const applyMute = (player) => {
          if (player && typeof player.mute === 'function') {
              if (isMuted) player.mute(); else player.unMute();
          }
      };
      applyMute(playerARef.current);
      applyMute(playerBRef.current);
  }, [isMuted]);

  useEffect(() => {
      const timer = setInterval(async () => {
          if(!currentTrackInfo || !hasInteracted) return;
          const active = opacityA ? playerARef.current : playerBRef.current;
          if(active && typeof active.getCurrentTime === 'function') {
              try {
                  const t = await active.getCurrentTime();
                  const start = currentTrackInfo.start_segundos || 0;
                  const dur = currentTrackInfo.end_segundos || currentTrackInfo.duracao_segundos || 0;
                  const rel = t - start;
                  setShowTrackInfo((rel >= 0 && rel < 10) || (dur > 30 && t >= dur - 10));
              } catch(e){}
          }
      }, 500);
      return () => clearInterval(timer);
  }, [currentTrackInfo, opacityA, hasInteracted]);

  const getArtistDisplay = () => {
      if (!currentTrackInfo) return '';
      let text = currentTrackInfo.artista || '';
      if (currentTrackInfo.artistas_participantes?.length > 0) text += ` feat. ${currentTrackInfo.artistas_participantes.join(', ')}`;
      return text;
  };
  const metaClass = "bg-black/50 backdrop-blur-sm px-4 py-1 rounded-r-full border-l-4 border-gray-400 shadow-md";
  const labelClass = "text-primary/90 font-bold uppercase text-xs mr-2 tracking-wider";

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden cursor-none">
      
      {!hasInteracted && (
          <div 
            onClick={handleInteraction}
            className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md cursor-pointer hover:bg-black/80 transition-all group"
          >
              <div className="bg-primary/20 p-8 rounded-full mb-6 group-hover:scale-110 transition-transform duration-300">
                  <span className="material-symbols-outlined text-8xl text-primary animate-pulse">play_arrow</span>
              </div>
              <h1 className="text-4xl font-bold text-white tracking-widest uppercase mb-2">Conectar à Rádio</h1>
              <p className="text-white/50 text-sm font-mono">Toque para sincronizar o sinal</p>
          </div>
      )}

      <audio ref={keepAliveAudioRef} src={SILENT_AUDIO_URI} loop muted={false} volume={0.01} style={{ display: 'none' }} />

      {overlayUrl && (
          <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center">
              <img src={overlayUrl} alt="Overlay" className="w-full h-full object-contain" />
          </div>
      )}

      <div className={`absolute bottom-16 left-16 z-40 pointer-events-none transition-all duration-1000 ease-in-out transform ${showTrackInfo && currentTrackInfo ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        {currentTrackInfo && (
            <div className="flex flex-col items-start space-y-1">
                <div className="bg-black/80 backdrop-blur-sm px-6 py-2 rounded-r-full border-l-4 border-primary shadow-lg mb-1">
                    <h1 className="text-white text-3xl font-bold font-display uppercase tracking-wide drop-shadow-md">{currentTrackInfo.titulo}</h1>
                </div>
                {(currentTrackInfo.artista || currentTrackInfo.artistas_participantes?.length > 0) && (
                     <div className="bg-black/70 backdrop-blur-sm px-5 py-1.5 rounded-r-full border-l-4 border-white shadow-lg mb-1">
                        <p className="text-gray-100 text-xl font-semibold drop-shadow-md">{getArtistDisplay()}</p>
                    </div>
                )}
                <div className="space-y-1">
                    {currentTrackInfo.album && <div className={metaClass}><p className="text-gray-200 text-base font-medium"><span className={labelClass}>ÁLBUM:</span>{currentTrackInfo.album}</p></div>}
                    {currentTrackInfo.gravadora && <div className={metaClass}><p className="text-gray-200 text-base font-medium"><span className={labelClass}>GRAVADORA:</span>{currentTrackInfo.gravadora}</p></div>}
                    {currentTrackInfo.diretor && <div className={metaClass}><p className="text-gray-200 text-base font-medium"><span className={labelClass}>DIRETOR:</span>{currentTrackInfo.diretor}</p></div>}
                </div>
            </div>
        )}
      </div>

      <div className="absolute inset-0 w-full h-full" style={{ opacity: opacityA, transition: `opacity ${CROSSFADE_DURATION_MS}ms linear` }}>
        <YouTube 
            opts={playerOptions} 
            onReady={(e) => onPlayerReady(e, 'A')} 
            onStateChange={onPlayerStateChange}
            className="w-full h-full pointer-events-none" 
        />
      </div>
      <div className="absolute inset-0 w-full h-full" style={{ opacity: opacityB, transition: `opacity ${CROSSFADE_DURATION_MS}ms linear` }}>
        <YouTube 
            opts={playerOptions} 
            onReady={(e) => onPlayerReady(e, 'B')} 
            onStateChange={onPlayerStateChange}
            className="w-full h-full pointer-events-none" 
        />
      </div>
    </div>
  );
}