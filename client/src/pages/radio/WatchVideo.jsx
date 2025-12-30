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
    mute: 1, 
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
  const [isPlayerReady, setIsPlayerReady] = useState({ A: false, B: false });

  const playerARef = useRef(null);
  const playerBRef = useRef(null);
  const keepAliveAudioRef = useRef(null);
  
  // Refs de controle para evitar conflitos
  const lastLoadedRef = useRef({ A: null, B: null });
  const fadeIntervalRef = useRef({ A: null, B: null }); 
  const activePlayerRef = useRef(null); 

  const [opacityA, setOpacityA] = useState(0);
  const [opacityB, setOpacityB] = useState(0);
  const [overlayUrl, setOverlayUrl] = useState(null);
  const [currentTrackInfo, setCurrentTrackInfo] = useState(null);
  const [showTrackInfo, setShowTrackInfo] = useState(false);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('dedalos_local_mute') === 'true');

  // Verifica se o sistema está pronto
  const systemIsReady = radioState && (radioState.playerAtivo === 'A' ? isPlayerReady.A : isPlayerReady.B);

  // --- FUNÇÃO DE FADE SEGURA ---
  const runFade = (player, pKey, startVol, endVol, duration) => {
      if (!player || typeof player.setVolume !== 'function') return;
      
      if (fadeIntervalRef.current[pKey]) clearInterval(fadeIntervalRef.current[pKey]);

      let currentVol = startVol;
      const steps = 20;
      const stepTime = duration / steps;
      const volStep = (endVol - startVol) / steps;

      player.setVolume(currentVol);

      fadeIntervalRef.current[pKey] = setInterval(() => {
          currentVol += volStep;
          if ((volStep > 0 && currentVol >= endVol) || (volStep < 0 && currentVol <= endVol)) {
              player.setVolume(endVol);
              clearInterval(fadeIntervalRef.current[pKey]);
          } else {
              player.setVolume(currentVol);
          }
      }, stepTime);
  };

  // --- SOCKET ---
  useEffect(() => {
    const socket = io(API_URL);
    
    socket.on('maestro:estadoCompleto', (estado) => {
        if (estado.overlayUrl) setOverlayUrl(`${API_URL}${estado.overlayUrl}`);
        setRadioState(estado);
        activePlayerRef.current = estado.playerAtivo; 
        setCurrentTrackInfo(estado.musicaAtual);
    });

    socket.on('maestro:tocarAgora', ({ player, musicaInfo }) => {
        const newState = {
            playerAtivo: player,
            musicaAtual: musicaInfo,
            tempoAtualSegundos: parseInt(musicaInfo.start_segundos) || 0
        };
        setRadioState(newState);
        activePlayerRef.current = player;
        setCurrentTrackInfo(musicaInfo);
    });

    socket.on('maestro:iniciarCrossfade', ({ playerAtivo, proximoPlayer, proximaMusica }) => {
        const newState = {
            playerAtivo: proximoPlayer,
            musicaAtual: proximaMusica,
            tempoAtualSegundos: parseInt(proximaMusica.start_segundos) || 0,
            isCrossfade: true 
        };
        setRadioState(newState);
        activePlayerRef.current = proximoPlayer;
        setCurrentTrackInfo(proximaMusica);
    });
    
    socket.on('maestro:pararTudo', () => {
        if(playerARef.current) playerARef.current.stopVideo();
        if(playerBRef.current) playerBRef.current.stopVideo();
        setOpacityA(0); setOpacityB(0);
        setCurrentTrackInfo(null);
        activePlayerRef.current = null;
        lastLoadedRef.current = { A: null, B: null };
    });

    socket.on('maestro:overlayAtualizado', (url) => setOverlayUrl(url ? `${API_URL}${url}` : null));

    return () => socket.disconnect();
  }, []);

  // --- EXECUTOR ---
  useEffect(() => {
      if (!hasInteracted || !radioState || !radioState.musicaAtual) return;

      const { playerAtivo, musicaAtual, tempoAtualSegundos, isCrossfade } = radioState;
      if (!isPlayerReady[playerAtivo]) return;

      const videoId = musicaAtual.youtube_id;
      const startSeconds = Math.floor(tempoAtualSegundos);

      const executeLoad = (player, pKey) => {
          const loadKey = `${videoId}_${startSeconds}`;
          const isSameVideo = lastLoadedRef.current[pKey] && lastLoadedRef.current[pKey].startsWith(videoId);
          
          if (isSameVideo && !isCrossfade) return;
          
          lastLoadedRef.current[pKey] = loadKey;
          const otherKey = pKey === 'A' ? 'B' : 'A';
          lastLoadedRef.current[otherKey] = null; 

          console.log(`[WatchVideo] PLAY ${pKey}: ${videoId} @ ${startSeconds}s`);
          
          if (fadeIntervalRef.current[pKey]) clearInterval(fadeIntervalRef.current[pKey]);

          player.mute();
          player.loadVideoById({
              videoId: videoId,
              startSeconds: startSeconds
          });
          player.playVideo();
      };

      const executeStop = (player, pKey) => {
          if (!player) return;
          if (fadeIntervalRef.current[pKey]) clearInterval(fadeIntervalRef.current[pKey]);
          
          console.log(`[WatchVideo] STOP ${pKey}`);
          player.mute(); 
          player.stopVideo(); 
      };

      if (playerAtivo === 'A') {
          setOpacityA(1);
          setOpacityB(0);
          
          if (playerARef.current) {
              executeLoad(playerARef.current, 'A');
              if (isCrossfade) {
                  playerARef.current.setVolume(0);
                  runFade(playerARef.current, 'A', 0, 100, CROSSFADE_DURATION_MS);
              } else {
                  playerARef.current.setVolume(100);
              }
          }
          
          if (playerBRef.current) {
              if (isCrossfade) {
                  runFade(playerBRef.current, 'B', 100, 0, CROSSFADE_DURATION_MS);
              } else {
                  executeStop(playerBRef.current, 'B');
              }
          }

      } else {
          setOpacityB(1);
          setOpacityA(0);

          if (playerBRef.current) {
              executeLoad(playerBRef.current, 'B');
              if (isCrossfade) {
                  playerBRef.current.setVolume(0);
                  runFade(playerBRef.current, 'B', 0, 100, CROSSFADE_DURATION_MS);
              } else {
                  playerBRef.current.setVolume(100);
              }
          }
          
          if (playerARef.current) {
              if (isCrossfade) {
                  runFade(playerARef.current, 'A', 100, 0, CROSSFADE_DURATION_MS);
              } else {
                  executeStop(playerARef.current, 'A'); 
              }
          }
      }

  }, [hasInteracted, radioState, isPlayerReady]);

  // --- EVENTOS DO PLAYER ---
  const onPlayerStateChange = (event, pKey) => {
      const player = event.target;
      const status = event.data;
      
      if (activePlayerRef.current !== pKey && activePlayerRef.current !== null) {
          return; 
      }

      if (status === 1 && !isMuted) {
          if (player.getVolume() > 90) player.unMute();
          else player.unMute(); 
      }
      
      if ((status === 2 || status === 5) && hasInteracted) {
          console.log(`[WatchVideo] Kickstarter: Revivendo Player ${pKey}`);
          player.playVideo();
      }
  };

  const onPlayerReady = (evt, key) => {
      if (key === 'A') playerARef.current = evt.target;
      else playerBRef.current = evt.target;
      evt.target.mute();
      setIsPlayerReady(prev => ({ ...prev, [key]: true }));
  };

  const handleInteraction = () => {
      setHasInteracted(true);
      if (keepAliveAudioRef.current) keepAliveAudioRef.current.play().catch(() => {});
  };

  // --- HELPERS VISUAIS (FICHA TÉCNICA CORRIGIDA) ---
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
      const active = activePlayerRef.current === 'A' ? playerARef.current : playerBRef.current;
      if (active) applyMute(active);
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
                  
                  // [CORREÇÃO] Lógica dos Créditos
                  // 1. Intro: Aparece após 10s e fica até 20s
                  const showIntro = rel >= 10 && rel < 20;

                  // 2. Outro: Aparece faltando 20s e some faltando 10s
                  // Fórmula: (total - 20) <= atual < (total - 10)
                  const showOutro = dur > 30 && (t >= (dur - 20) && t < (dur - 10));

                  setShowTrackInfo(showIntro || showOutro);
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
    <div className="relative w-screen h-screen bg-black overflow-hidden cursor-none font-display">
      
      {/* --- TELA DE BLOQUEIO / LOADING --- */}
      {!hasInteracted && (
          <div 
            onClick={handleInteraction}
            className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#0a0a0a] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 via-[#0a0a0a] to-black cursor-pointer group select-none transition-all duration-700"
          >
              {!systemIsReady ? (
                  <div className="flex flex-col items-center gap-6 animate-pulse">
                      <div className="relative w-24 h-24">
                          <div className="absolute inset-0 border-t-4 border-primary rounded-full animate-spin"></div>
                          <div className="absolute inset-3 border-t-4 border-white/20 rounded-full animate-spin-reverse"></div>
                          <span className="material-symbols-outlined absolute inset-0 flex items-center justify-center text-4xl text-white/20">dns</span>
                      </div>
                      <h2 className="text-xl font-bold text-white tracking-[0.2em] uppercase">Sintonizando...</h2>
                  </div>
              ) : (
                  <div className="flex flex-col items-center animate-fade-in-up transform transition-transform duration-700 group-hover:scale-105">
                      <div className="relative flex items-center justify-center mb-10">
                          <div className="absolute w-40 h-40 bg-primary/30 blur-[80px] rounded-full animate-pulse group-hover:bg-primary/50 transition-colors duration-500"></div>
                          <span className="material-symbols-outlined text-9xl text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.4)] group-hover:text-primary transition-all duration-700 ease-out group-hover:rotate-[360deg] group-hover:scale-110">
                              play_circle
                          </span>
                      </div>
                      <h1 className="text-5xl font-bold text-white tracking-widest uppercase mb-4 drop-shadow-lg">Conectar</h1>
                      <div className="flex items-center gap-3 bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-ping"></div>
                          <div className="w-2 h-2 rounded-full bg-green-500 absolute"></div>
                          <p className="text-primary font-mono text-xs tracking-[0.3em] uppercase">Sinal Estabelecido</p>
                      </div>
                      <p className="mt-16 text-white/20 text-[10px] font-mono uppercase tracking-[0.2em] group-hover:text-white/40 transition-colors">
                          Toque em qualquer lugar da tela
                      </p>
                  </div>
              )}
          </div>
      )}

      <audio ref={keepAliveAudioRef} src={SILENT_AUDIO_URI} loop muted={false} volume={0.01} style={{ display: 'none' }} />

      {overlayUrl && (
          <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center">
              <img src={overlayUrl} alt="Overlay" className="w-full h-full object-contain" />
          </div>
      )}

      {/* INFO DA FAIXA */}
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
        <YouTube opts={playerOptions} onReady={(e) => onPlayerReady(e, 'A')} onStateChange={(e) => onPlayerStateChange(e, 'A')} className="w-full h-full pointer-events-none" />
      </div>
      <div className="absolute inset-0 w-full h-full" style={{ opacity: opacityB, transition: `opacity ${CROSSFADE_DURATION_MS}ms linear` }}>
        <YouTube opts={playerOptions} onReady={(e) => onPlayerReady(e, 'B')} onStateChange={(e) => onPlayerStateChange(e, 'B')} className="w-full h-full pointer-events-none" />
      </div>
    </div>
  );
}