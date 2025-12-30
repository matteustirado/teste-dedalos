import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { validateCustomerCode } from '../../utils/customerValidator';

const API_URL = 'http://localhost:4000';
const INACTIVITY_TIMEOUT_MS = 20000;
const DAYS_TRANSLATION = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
const SHORT_DAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export default function Jukebox() {
  const { unidade } = useParams();
  const unitLabel = unidade ? unidade.toUpperCase() : 'SP';

  const [socket, setSocket] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [musicaAtual, setMusicaAtual] = useState(null);
  const [fila, setFila] = useState([]);
  const [playlistDoDia, setPlaylistDoDia] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [customerCode, setCustomerCode] = useState('');
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [isCodeError, setIsCodeError] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  
  const [requestStatus, setRequestStatus] = useState('IDLE'); 
  const [refusalReason, setRefusalReason] = useState('');

  const [showDropdown, setShowDropdown] = useState(false);
  
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);
  const inactivityTimerRef = useRef(null);

  const currentDayIndex = new Date().getDay();
  const currentDayName = useMemo(() => DAYS_TRANSLATION[currentDayIndex], [currentDayIndex]);

  const fetchTracks = () => {
      axios.get(`${API_URL}/api/tracks`).then(res => {
          const validTracks = res.data.filter(t => t.status_processamento === 'PROCESSADO' && !t.is_commercial);
          setTracks(validTracks);
      }).catch(err => console.error("Erro ao atualizar lista de músicas:", err));
  };

  const resetForm = () => {
      setSearchTerm('');
      setCustomerCode('');
      setSelectedTrack(null);
      setIsCodeError(false);
      setRequestStatus('IDLE');
      setRefusalReason('');
      setShowDropdown(false); 
      if (searchInputRef.current) searchInputRef.current.blur();
  };

  const resetInactivityTimer = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
          if (searchTerm || customerCode || selectedTrack || requestStatus !== 'IDLE') {
              resetForm();
          }
      }, INACTIVITY_TIMEOUT_MS);
  };

  useEffect(() => {
    const handleClickOrFocusOutside = (event) => {
        if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
            setShowDropdown(false);
        }
    };
    document.addEventListener('mousedown', handleClickOrFocusOutside);
    document.addEventListener('focusin', handleClickOrFocusOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOrFocusOutside);
        document.removeEventListener('focusin', handleClickOrFocusOutside);
    };
  }, []);

  useEffect(() => {
      const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];
      const handleActivity = () => resetInactivityTimer();
      events.forEach(event => window.addEventListener(event, handleActivity));
      resetInactivityTimer();
      return () => {
          events.forEach(event => window.removeEventListener(event, handleActivity));
          if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      };
  }, [searchTerm, customerCode, selectedTrack, requestStatus]);

  useEffect(() => {
    const newSocket = io(API_URL);
    setSocket(newSocket);

    fetchTracks();

    const fetchTheme = async () => {
        const today = new Date();
        const dateString = today.toISOString().split('T')[0];
        try {
            const res = await axios.get(`${API_URL}/api/agendamentos/${dateString}`);
            const schedule = res.data;
            const firstSlot = Object.values(schedule).find(item => item !== null);
            
            if (firstSlot) {
                const pRes = await axios.get(`${API_URL}/api/playlists`);
                const playlist = pRes.data.find(p => p.id === firstSlot.playlist_id);
                setPlaylistDoDia(playlist);
            }
        } catch (e) {
            console.error("Erro ao buscar tema do dia", e);
        }
    };
    fetchTheme();

    newSocket.on('maestro:estadoCompleto', (estado) => { setMusicaAtual(estado.musicaAtual); });
    newSocket.on('maestro:tocarAgora', ({ musicaInfo }) => { setMusicaAtual(musicaInfo); });
    newSocket.on('maestro:filaAtualizada', (novaFila) => { setFila(novaFila || []); });
    
    newSocket.on('acervo:atualizado', () => {
        fetchTracks();
    });

    // --- OUVINTES DE RESPOSTA (Corrige o giro infinito) ---
    
    // 1. Pedido Aceito (Música da Lista)
    newSocket.on('jukebox:pedidoAceito', () => {
        setIsValidating(false); // Para o spinner
        setRequestStatus('SUCCESS_REQUEST');
        setTimeout(() => resetForm(), 5000);
    });

    // 2. Sugestão Aceita (Manual)
    newSocket.on('jukebox:sugestaoAceita', () => {
        setIsValidating(false); // Para o spinner
        setRequestStatus('SUCCESS_SUGGESTION');
        setTimeout(() => resetForm(), 5000);
    });

    // 3. Pedido Recusado (Já tocando/fila cheia/vetado)
    newSocket.on('jukebox:pedidoRecusado', ({ motivo }) => {
        setIsValidating(false);
        setRefusalReason(motivo || 'Pedido não pôde ser processado.');
        setRequestStatus('ERROR_REFUSED');
        setTimeout(() => resetForm(), 6000);
    });

    // 4. Erro Genérico (Limite spam, erros de banco)
    newSocket.on('jukebox:erroPedido', ({ message }) => {
        setIsValidating(false);
        setRefusalReason(message || 'Erro desconhecido.');
        setRequestStatus('ERROR_REFUSED');
        setTimeout(() => resetForm(), 6000);
    });

    return () => newSocket.disconnect();
  }, []);

  const availableTracks = useMemo(() => {
    let filtered = tracks;
    if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        filtered = tracks.filter(track => 
            track.titulo.toLowerCase().includes(lowerTerm) || 
            (track.artista && track.artista.toLowerCase().includes(lowerTerm))
        );
    }

    return filtered.sort((a, b) => {
        const aAvailable = Array.isArray(a.dias_semana) && a.dias_semana.includes(currentDayIndex);
        const bAvailable = Array.isArray(b.dias_semana) && b.dias_semana.includes(currentDayIndex);

        if (aAvailable && !bAvailable) return -1; 
        if (!aAvailable && bAvailable) return 1;  
        return 0; 
    }).slice(0, 8); 
  }, [tracks, searchTerm, currentDayIndex]);

  const topArtistasPlaylist = useMemo(() => {
      if (!playlistDoDia || !tracks.length) return [];
      let playlistTrackIds = playlistDoDia.tracks_ids;
      if (typeof playlistTrackIds === 'string') {
          try { playlistTrackIds = JSON.parse(playlistTrackIds); } catch(e) { playlistTrackIds = []; }
      }
      if (!Array.isArray(playlistTrackIds) || playlistTrackIds.length === 0) return [];
      const artistCount = {};
      playlistTrackIds.forEach(id => {
          const track = tracks.find(t => t.id == id);
          if (track && track.artista) {
              const mainArtist = track.artista.split(/,| feat\.|&/)[0].trim();
              if (mainArtist) artistCount[mainArtist] = (artistCount[mainArtist] || 0) + 1;
          }
      });
      return Object.entries(artistCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name);
  }, [playlistDoDia, tracks]);

  const handleSelectTrack = (track) => {
    const isAvailableToday = Array.isArray(track.dias_semana) && track.dias_semana.includes(currentDayIndex);
    if (!isAvailableToday) return; 

    setSelectedTrack(track);
    setSearchTerm(`${track.titulo} - ${track.artista}`);
    setIsCodeError(false);
    setShowDropdown(false); 
  };

  const handleSubmit = async () => {
    setIsCodeError(false);
    setIsValidating(true); // Inicia spinner

    try {
        const isValid = await validateCustomerCode(customerCode, unitLabel);
        
        if (!isValid) {
            setIsCodeError(true);
            setIsValidating(false);
            return;
        }

        if (socket) {
            if (selectedTrack) {
                socket.emit('jukebox:adicionarPedido', {
                    trackId: selectedTrack.id,
                    pulseiraId: customerCode,
                    unidade: unitLabel,
                    titulo: selectedTrack.titulo,
                    tipo: 'JUKEBOX'
                });
            } else {
                socket.emit('jukebox:enviarSugestao', {
                    termo: searchTerm,
                    pulseiraId: customerCode,
                    unidade: unitLabel
                });
                // REMOVIDO: A atualização otimista aqui. Agora espera 'jukebox:sugestaoAceita'
            }
        }
    } catch (error) {
        console.error(error);
        setIsValidating(false);
    }
  };

  // --- RENDERIZAÇÃO DE FEEDBACK ---
  if (requestStatus !== 'IDLE') {
      let icon = '';
      let colorClass = '';
      let title = '';
      let message = '';
      let buttonText = 'Voltar';

      switch (requestStatus) {
          case 'SUCCESS_REQUEST':
              icon = 'check_circle';
              colorClass = 'text-green-500';
              title = 'Pedido Confirmado!';
              message = `Sua música foi adicionada à fila da unidade ${unitLabel}.`;
              break;
          case 'SUCCESS_SUGGESTION':
              icon = 'lightbulb';
              colorClass = 'text-yellow-400';
              title = 'Sugestão Enviada!';
              message = 'Obrigado! Sua sugestão foi enviada para nossos DJs.';
              break;
          case 'ERROR_REFUSED':
              icon = 'cancel'; 
              colorClass = 'text-red-500';
              title = 'Pedido Não Aceito';
              message = refusalReason || 'Não foi possível adicionar esta música no momento.';
              buttonText = 'Tentar Outra';
              break;
          default: break;
      }

      return (
          <div className="h-screen w-screen bg-gradient-warm flex flex-col items-center justify-center p-8 text-center animate-fade-in select-none">
              <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-6 shadow-2xl bg-white/10 backdrop-blur-lg border border-white/10`}>
                  <span className={`material-symbols-outlined text-7xl ${colorClass} drop-shadow-lg`}>{icon}</span>
              </div>
              <h1 className="text-4xl font-bold text-white mb-3 tracking-wide">
                  {title}
              </h1>
              <p className="text-2xl text-white/80 max-w-4xl leading-relaxed">
                  {message}
              </p>
              <button onClick={resetForm} className="mt-10 bg-white/10 text-white px-8 py-3 rounded-xl hover:bg-white/20 transition-colors font-bold uppercase tracking-wider text-sm border border-white/10">
                  {buttonText}
              </button>
          </div>
      );
  }

  return (
    <div className="h-screen w-screen bg-gradient-warm p-8 flex flex-col overflow-hidden select-none text-white">
      
      <div className="grid grid-cols-12 gap-8 h-full">
        
        {/* === ESQUERDA === */}
        <div className="col-span-5 flex flex-col gap-8 h-full">
            
            <div className="liquid-glass p-6 rounded-3xl relative overflow-hidden group flex-shrink-0">
                 <div className="flex justify-between items-start mb-6">
                     <div className="flex items-center gap-2 bg-black/30 rounded-lg p-1">
                         <div className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${unitLabel === 'SP' ? 'bg-primary text-white shadow-lg' : 'text-white/30'}`}>SP</div>
                         <div className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${unitLabel === 'BH' ? 'bg-primary text-white shadow-lg' : 'text-white/30'}`}>BH</div>
                     </div>
                     <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-green-400 tracking-wider uppercase opacity-80">No Ar</span>
                        <div className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 shadow-[0_0_10px_#4ade80]"></span>
                        </div>
                     </div>
                 </div>
                 
                 <div className="flex gap-5 items-center">
                     <div className="w-24 h-24 rounded-full border-4 border-white/10 shadow-2xl overflow-hidden flex-shrink-0 bg-black relative flex items-center justify-center">
                        <div className="w-full h-full animate-spin-slow flex items-center justify-center">
                            <img src={musicaAtual?.thumbnail_url || 'https://placehold.co/150/111/333'} className="w-full h-full object-cover scale-[1.7]" alt="Vinil" />
                        </div>
                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/10 to-transparent pointer-events-none z-10"></div>
                        <div className="absolute w-2 h-2 bg-black rounded-full z-20 border border-white/20"></div>
                     </div>
                     <div className="min-w-0 pr-2">
                         <p className="text-white text-xl font-bold leading-tight line-clamp-2 drop-shadow-md">{musicaAtual?.titulo || 'Rádio Dedalos'}</p>
                         <p className="text-primary text-sm font-bold mt-1 truncate">{musicaAtual?.artista || 'Conectado'}</p>
                     </div>
                 </div>
            </div>

            <div className="liquid-glass p-6 rounded-3xl flex-1 flex flex-col min-h-0">
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">queue_music</span> Próximas
                </h3>
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                    {fila.slice(0, 8).map((item, idx) => (
                        <div key={`${item.id}-${idx}`} className="flex items-center gap-4 p-3 bg-white/5 rounded-xl border border-white/5 shadow-sm">
                            <span className="text-white/20 font-mono text-sm w-4 text-center">{idx + 1}</span>
                            <div className="min-w-0 flex-1">
                                <p className="text-white font-medium text-sm truncate">{item.titulo}</p>
                                <div className="flex items-center justify-between mt-1">
                                    <p className="text-white/40 text-[10px] truncate max-w-[60%]">{item.artista || 'Desconhecido'}</p>
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide ${item.unidade === 'SP' ? 'bg-blue-500/20 text-blue-300' : item.unidade === 'BH' ? 'bg-yellow-500/20 text-yellow-300' : item.tipo === 'DJ' ? 'bg-purple-500/20 text-purple-300' : 'bg-white/10 text-white/40'}`}>
                                        {item.tipo === 'DJ_PEDIDO' ? 'DJ' : (item.unidade || 'AUTO')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {fila.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center opacity-30">
                            <span className="material-symbols-outlined text-4xl mb-2">playlist_add</span>
                            <p className="text-xs text-center">Fila vazia.<br/>Peça sua música!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* === DIREITA === */}
        <div className="col-span-7 flex flex-col gap-8 h-full">
            {/* CARD DE BUSCA - Z-INDEX 50 */}
            <div className="liquid-glass p-8 rounded-3xl shadow-lg flex-shrink-0 relative z-50">
                <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-4xl">search</span> Pedir Música
                </h2>
                
                <div ref={searchContainerRef} className="relative mb-6">
                    <input 
                        ref={searchInputRef}
                        type="text" 
                        className="w-full bg-black/30 border border-white/10 rounded-2xl py-4 pl-6 pr-4 text-lg text-white placeholder:text-white/30 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                        placeholder="Buscar música ou artista..."
                        value={searchTerm}
                        onFocus={() => setShowDropdown(true)} 
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setShowDropdown(true); 
                            if(selectedTrack) setSelectedTrack(null);
                        }}
                    />
                    
                    {searchTerm && !selectedTrack && showDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden max-h-56 overflow-y-auto custom-scrollbar">
                            {availableTracks.length > 0 ? (
                                availableTracks.map(track => {
                                    const isAvailableToday = Array.isArray(track.dias_semana) && track.dias_semana.includes(currentDayIndex);
                                    
                                    return (
                                        <div 
                                            key={track.id} 
                                            onClick={() => handleSelectTrack(track)} 
                                            className={`flex items-center gap-4 p-4 border-b border-white/5 last:border-0 transition-all
                                                ${isAvailableToday ? 'hover:bg-white/10 cursor-pointer' : 'opacity-40 cursor-not-allowed grayscale-[0.5]'}
                                            `}
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-white/10 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                                <img src={track.thumbnail_url} className="w-full h-full object-cover scale-[1.7]" alt="" />
                                            </div>
                                            
                                            <div className="min-w-0 flex-1">
                                                <p className="text-white text-base font-medium truncate">{track.titulo}</p>
                                                <p className="text-white/40 text-xs truncate">{track.artista}</p>
                                            </div>
                                            
                                            <div className="flex gap-1 ml-3 flex-shrink-0">
                                                {SHORT_DAYS.map((dayName, idx) => {
                                                    const isDayActive = Array.isArray(track.dias_semana) && track.dias_semana.includes(idx);
                                                    if (!isDayActive) return null;
                                                    const isToday = idx === currentDayIndex;
                                                    return (
                                                        <span key={idx} className={`text-[10px] font-bold px-1.5 py-0.5 rounded border 
                                                            ${isToday ? 'bg-green-500/20 text-green-400 border-green-500/30 shadow-[0_0_8px_rgba(74,222,128,0.2)]' : 'bg-white/5 text-white/30 border-white/10'}
                                                        `}>
                                                            {dayName}
                                                        </span>
                                                    );
                                                })}
                                            </div>

                                            {isAvailableToday && (
                                                <span className="material-symbols-outlined text-primary ml-3">add</span>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="p-6 text-center text-white/40 text-sm">
                                    <p>Nenhuma música encontrada hoje.</p>
                                    <p className="text-xs mt-1">Preencha o código abaixo para enviar como sugestão.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                <div className="flex gap-4">
                    <div className="w-40">
                        <input 
                            type="number" 
                            className={`w-full bg-black/30 border rounded-2xl py-4 px-2 text-xl text-white placeholder:text-white/20 focus:outline-none text-center font-mono tracking-widest ${isCodeError ? 'border-red-500 animate-shake' : 'border-white/10 focus:border-primary'}`}
                            placeholder="CÓDIGO"
                            value={customerCode}
                            onChange={(e) => setCustomerCode(e.target.value)}
                        />
                    </div>
                    <button 
                        onClick={handleSubmit}
                        disabled={!customerCode || isValidating}
                        className={`flex-1 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95 ${selectedTrack ? 'bg-gradient-to-r from-primary to-orange-600 text-white hover:shadow-primary/40' : 'bg-white/10 text-white hover:bg-white/20 border border-white/5'} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {isValidating ? (
                            <span className="material-symbols-outlined animate-spin text-2xl">refresh</span>
                        ) : selectedTrack ? 'CONFIRMAR PEDIDO' : 'ENVIAR SUGESTÃO'}
                    </button>
                </div>
            </div>

            <div className="liquid-glass p-0 rounded-3xl flex-1 flex min-h-0 bg-[#0e0e0e] border border-white/5 overflow-hidden relative">
                <div className="absolute top-0 right-0 h-full aspect-square z-0">
                    <img 
                        src={playlistDoDia?.capa_url || 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=2070&auto=format&fit=crop'} 
                        alt="Capa da Playlist" 
                        className="w-full h-full object-cover"
                        style={{ maskImage: 'linear-gradient(to right, transparent 0%, black 100%)', WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 100%)' }}
                    />
                </div>
                <div className="relative z-20 flex-1 p-8 flex flex-col justify-center max-w-[70%]">
                    <span className="inline-block px-3 py-1 rounded bg-primary/20 text-primary text-xs font-bold uppercase tracking-widest self-start mb-3 border border-primary/20">
                        {currentDayName}
                    </span>
                    <h2 className="text-3xl font-bold text-white leading-tight mb-3 drop-shadow-lg">
                        {playlistDoDia ? playlistDoDia.nome : 'Seleção Especial'}
                    </h2>
                    <p className="text-white/80 text-sm leading-relaxed line-clamp-2 mb-4 drop-shadow-md">
                        {playlistDoDia ? playlistDoDia.descricao : 'Uma curadoria exclusiva de músicas selecionadas para criar a atmosfera perfeita para sua noite.'}
                    </p>
                    {topArtistasPlaylist.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {topArtistasPlaylist.map((artista, i) => (
                                <span key={i} className="px-2 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-white/90 text-[10px] font-bold uppercase tracking-wide shadow-sm">
                                    {artista}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      <style>{`
        .animate-spin-slow { animation: spin 8s linear infinite; }
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.3s ease-in-out; }
      `}</style>
    </div>
  );
}