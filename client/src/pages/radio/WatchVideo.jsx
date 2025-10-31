import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import YouTube from 'react-youtube';

const API_URL = 'http://localhost:4000';
const CROSSFADE_DURATION_MS = 4000;

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

  const [playerA, setPlayerA] = useState({ videoId: null, opacity: 0 });
  const [playerB, setPlayerB] = useState({ videoId: null, opacity: 0 });

  useEffect(() => {
    const socket = io(API_URL);
    console.log("[WatchVideo] Conectando ao Maestro...");

    socket.on('maestro:tocarAgora', ({ player, musicaInfo }) => {
      console.log(`[WatchVideo] 'tocarAgora' (Player ${player})`, musicaInfo);
      const { youtube_id, start_segundos } = musicaInfo;

      if (player === 'A') {
        setPlayerA({ videoId: youtube_id, opacity: 1 });
        setPlayerB(prev => ({ ...prev, opacity: 0 }));
        
        if (playerARef.current) {
            playerARef.current.loadVideoById(youtube_id, start_segundos || 0);
            playerARef.current.setVolume(100);
            playerARef.current.playVideo();
        }
        if (playerBRef.current) playerBRef.current.stopVideo();
        
      } else {
        setPlayerB({ videoId: youtube_id, opacity: 1 });
        setPlayerA(prev => ({ ...prev, opacity: 0 }));
        
        if (playerBRef.current) {
            playerBRef.current.loadVideoById(youtube_id, start_segundos || 0);
            playerBRef.current.setVolume(100);
            playerBRef.current.playVideo();
        }
        if (playerARef.current) playerARef.current.stopVideo();
      }
    });

    socket.on('maestro:iniciarCrossfade', ({ playerAtivo, proximoPlayer, proximaMusica }) => {
      console.log(`[WatchVideo] 'iniciarCrossfade'. Ativo: ${playerAtivo}, Próximo: ${proximoPlayer}`, proximaMusica);
      const { youtube_id, start_segundos } = proximaMusica;

      if (proximoPlayer === 'B') {
        setPlayerB({ videoId: youtube_id, opacity: 1 });
        if (playerBRef.current) {
            playerBRef.current.loadVideoById(youtube_id, start_segundos || 0);
            playerBRef.current.setVolume(0);
            playerBRef.current.playVideo();
            fadeVolume(playerBRef.current, 0, 100, CROSSFADE_DURATION_MS);
        }
        setPlayerA(prev => ({ ...prev, opacity: 0 }));
        if (playerARef.current) {
            fadeVolume(playerARef.current, 100, 0, CROSSFADE_DURATION_MS);
        }
      } else {
        setPlayerA({ videoId: youtube_id, opacity: 1 });
        if (playerARef.current) {
            playerARef.current.loadVideoById(youtube_id, start_segundos || 0);
            playerARef.current.setVolume(0);
            playerARef.current.playVideo();
            fadeVolume(playerARef.current, 0, 100, CROSSFADE_DURATION_MS);
        }
        setPlayerB(prev => ({ ...prev, opacity: 0 }));
        if (playerBRef.current) {
            fadeVolume(playerBRef.current, 100, 0, CROSSFADE_DURATION_MS);
        }
      }
    });
    
    socket.on('maestro:pararTudo', () => {
        console.log("[WatchVideo] Recebido 'pararTudo'. Parando players.");
        if (playerARef.current) playerARef.current.stopVideo();
        if (playerBRef.current) playerBRef.current.stopVideo();
        setPlayerA({ videoId: null, opacity: 0 });
        setPlayerB({ videoId: null, opacity: 0 });
    });

    return () => {
      console.log("[WatchVideo] Desconectando Socket...");
      socket.off('maestro:tocarAgora');
      socket.off('maestro:iniciarCrossfade');
      socket.off('maestro:pararTudo');
      socket.disconnect();
    };
  }, []);

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden cursor-none">
      
      <div
        className="absolute inset-0 w-full h-full"
        style={{ opacity: playerA.opacity, transition: `opacity ${CROSSFADE_DURATION_MS}ms linear` }}
      >
        {playerA.videoId && (
          <YouTube
            videoId={playerA.videoId}
            opts={playerOptions}
            onReady={(e) => { playerARef.current = e.target; }}
            className="w-full h-full"
          />
        )}
      </div>
      
      <div
        className="absolute inset-0 w-full h-full"
        style={{ opacity: playerB.opacity, transition: `opacity ${CROSSFADE_DURATION_MS}ms linear` }}
      >
        {playerB.videoId && (
          <YouTube
            videoId={playerB.videoId}
            opts={playerOptions}
            onReady={(e) => { playerBRef.current = e.target; }}
            className="w-full h-full"
          />
        )}
      </div>
      
    </div>
  );
}