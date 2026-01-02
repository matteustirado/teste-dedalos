import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';

const API_URL = 'http://localhost:4000';
const INACTIVITY_TIMEOUT_MS = 20000;
const MASTER_CODE = '0108'; // Código mestre para testes/staff

const DAYS_TRANSLATION = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
const SHORT_DAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

// Configuração das APIs de Validação (Extraídas do .env)
const VALIDATION_API = {
    SP: import.meta.env.VITE_API_URL_SP || "https://dedalosadm2-3dab78314381.herokuapp.com/",
    BH: import.meta.env.VITE_API_URL_BH || "https://dedalosadm2bh-09d55dca461e.herokuapp.com/"
};

// --- HELPER DE TAGS ---
const getTagInfo = (item) => {
    if (item.tipo === 'COMERCIAL_MANUAL' || item.is_commercial) {
        return { text: 'COMERCIAL', color: 'bg-orange-500/20 text-orange-400' };
    }
    if (item.tipo === 'DJ_PEDIDO' || item.tipo === 'DJ') {
        return { text: 'DJ', color: 'bg-blue-500/20 text-blue-400' };
    }
    if (item.unidade || item.tipo === 'JUKEBOX') {
        const u = (item.unidade || '').toUpperCase();
        if (u === 'BH') return { text: 'BH', color: 'bg-yellow-500/20 text-yellow-400' };
        return { text: u || 'SP', color: 'bg-green-500/20 text-green-400' };
    }
    return { text: 'PLAYLIST', color: 'bg-purple-500/20 text-purple-400' };
};

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

  // --- FUNÇÃO DE VALIDAÇÃO INTERNA ---
  const validateCustomer = async (code) => {
      if (!code) return false;
      const cleanCode = code.toString().trim();

      // 1. Validação Mestre
      if (cleanCode === MASTER_CODE) return true;

      // 2. Validação na API Externa (SP ou BH)
      const baseUrl = VALIDATION_API[unitLabel] || VALIDATION_API.SP;
      // Garante que a URL termine com / antes de concatenar, se necessário. 
      // Mas o endpoint específico é /pesquisa/api/verificar_pulseira/
      // Assumindo que o ENV traz a raiz (ex: https://site.com/), montamos a URL:
      
      // Nota: As variáveis do ENV geralmente vêm com a barra no final ou não. 
      // Vamos garantir a formação correta.
      const rootUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
      const url = `${rootUrl}pesquisa/api/verificar_pulseira/?id=${cleanCode.toUpperCase()}`;

      try {
          const response = await fetch(url);
          // A API retorna 200 se a pulseira existe/é válida
          return response.ok;
      } catch (error) {
          console.error(`Erro ao validar código na unidade ${unitLabel}:`, error);
          return false;
      }
  };

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

    newSocket.on('jukebox:pedidoAceito', () => {
        setIsValidating(false); 
        setRequestStatus('SUCCESS_REQUEST');
        setTimeout(() => resetForm(), 5000);
    });

    newSocket.on('jukebox:sugestaoAceita', () => {
        setIsValidating(false); 
        setRequestStatus('SUCCESS_SUGGESTION');
        setTimeout(() => resetForm(), 5000);
    });

    newSocket.on('jukebox:pedidoRecusado', ({ motivo }) => {
        setIsValidating(false);
        setRefusalReason(motivo || 'Pedido não pôde ser processado.');
        setRequestStatus('ERROR_REFUSED');
        setTimeout(() => resetForm(), 6000);
    });

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
    setIsValidating(true);

    try {
        // Validação usando a função interna consolidada
        const isValid = await validateCustomer(customerCode);
        
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
            }
        }
    } catch (error) {
        console.error(error);
        setIsValidating(false);
    }
  };

  const playlistCoverUrl = useMemo(() => {
      if (!playlistDoDia?.imagem) return 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=2070&auto=format&fit=crop';
      return playlistDoDia.imagem.startsWith('http') 
          ? playlistDoDia.imagem 
          : `${API_URL}${playlistDoDia.imagem}`;
  }, [playlistDoDia]);

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
              <div className={`w-28 h-28 rounded-full flex items-center justify-center mb-4 shadow-2xl bg-white/10 backdrop-blur-lg border border-white/10`}>
                  <span className={`material-symbols-outlined text-6xl ${colorClass} drop-shadow-lg`}>{icon}</span>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2 tracking-wide">
                  {title}
              </h1>
              <p className="text-lg text-white/80 max-w-2xl leading-relaxed">
                  {message}
              </p>
              <button onClick={resetForm} className="mt-6 bg-white/10 text-white px-8 py-2 rounded-xl hover:bg-white/20 transition-colors font-bold uppercase tracking-wider text-sm border border-white/10">
                  {buttonText}
              </button>
          </div>
      );
  }

  return (
    <div className="h-screen w-screen bg-gradient-warm p-8 flex flex-col overflow-hidden select-none text-white">
      
      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        
        <div className="col-span-5 flex flex-col gap-6 h-full min-h-0">
            
            <div className="liquid-glass p-4 rounded-3xl relative overflow-hidden group flex-shrink-0">
                 <div className="flex justify-between items-start mb-2">
                     <div className="flex items-center gap-2 bg-black/30 rounded-lg p-1">
                         <div className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${unitLabel === 'SP' ? 'bg-primary text-white shadow-lg' : 'text-white/30'}`}>SP</div>
                         <div className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${unitLabel === 'BH' ? 'bg-primary text-white shadow-lg' : 'text-white/30'}`}>BH</div>
                     </div>
                     <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold text-green-400 tracking-wider uppercase opacity-80">No Ar</span>
                        <div className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500 shadow-[0_0_8px_#4ade80]"></span>
                        </div>
                     </div>
                 </div>
                 
                 <div className="flex gap-3 items-center">
                     <div className="w-14 h-14 rounded-full border-2 border-white/10 shadow-xl overflow-hidden flex-shrink-0 bg-black relative flex items-center justify-center">
                        <div className="w-full h-full animate-spin-slow flex items-center justify-center">
                            <img src={musicaAtual?.thumbnail_url || 'https://placehold.co/150/111/333'} className="w-full h-full object-cover scale-[1.7]" alt="Vinil" />
                        </div>
                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/10 to-transparent pointer-events-none z-10"></div>
                        <div className="absolute w-1.5 h-1.5 bg-black rounded-full z-20 border border-white/20"></div>
                     </div>
                     <div className="min-w-0 pr-1">
                         <p className="text-white text-base font-bold leading-tight line-clamp-2 drop-shadow-md">{musicaAtual?.titulo || 'Rádio Dedalos'}</p>
                         <p className="text-primary text-xs font-bold mt-0.5 truncate">{musicaAtual?.artista || 'Conectado'}</p>
                     </div>
                 </div>
            </div>

            <div className="liquid-glass p-4 rounded-3xl flex-1 flex flex-col min-h-0">
                <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">queue_music</span> Próximas
                </h3>
                
                <div className="flex-1 overflow-hidden space-y-2">
                    {fila.slice(0, 5).map((item, idx) => {
                        const tag = getTagInfo(item);
                        return (
                            <div key={`${item.id}-${idx}`} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg border border-white/5 shadow-sm">
                                <span className="text-white/20 font-mono text-xs w-3 text-center">{idx + 1}</span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-white font-medium text-xs truncate">{item.titulo}</p>
                                    <div className="flex items-center justify-between mt-0.5">
                                        <p className="text-white/40 text-[9px] truncate max-w-[60%]">{item.artista || 'Desconhecido'}</p>
                                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${tag.color}`}>
                                            {tag.text}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {fila.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center opacity-30">
                            <span className="material-symbols-outlined text-3xl mb-1">playlist_add</span>
                            <p className="text-[10px] text-center">Fila vazia.<br/>Peça sua música!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        <div className="col-span-7 flex flex-col gap-6 h-full min-h-0">
            <div className="liquid-glass p-5 rounded-3xl shadow-lg flex-shrink-0 relative z-50">
                <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-2xl">search</span> Pedir Música
                </h2>
                
                <div ref={searchContainerRef} className="relative mb-3">
                    <input 
                        ref={searchInputRef}
                        type="text" 
                        className="w-full bg-black/30 border border-white/10 rounded-xl py-2 pl-4 pr-3 text-base text-white placeholder:text-white/30 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
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
                        <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden max-h-48 overflow-y-auto custom-scrollbar">
                            {availableTracks.length > 0 ? (
                                availableTracks.map(track => {
                                    const isAvailableToday = Array.isArray(track.dias_semana) && track.dias_semana.includes(currentDayIndex);
                                    
                                    return (
                                        <div 
                                            key={track.id} 
                                            onClick={() => handleSelectTrack(track)} 
                                            className={`flex items-center gap-3 p-3 border-b border-white/5 last:border-0 transition-all
                                                ${isAvailableToday ? 'hover:bg-white/10 cursor-pointer' : 'opacity-40 cursor-not-allowed grayscale-[0.5]'}
                                            `}
                                        >
                                            <div className="w-8 h-8 rounded-md bg-white/10 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                                <img src={track.thumbnail_url} className="w-full h-full object-cover scale-[1.7]" alt="" />
                                            </div>
                                            
                                            <div className="min-w-0 flex-1">
                                                <p className="text-white text-sm font-medium truncate">{track.titulo}</p>
                                                <p className="text-white/40 text-[10px] truncate">{track.artista}</p>
                                            </div>
                                            
                                            <div className="flex gap-1 ml-2 flex-shrink-0">
                                                {SHORT_DAYS.map((dayName, idx) => {
                                                    const isDayActive = Array.isArray(track.dias_semana) && track.dias_semana.includes(idx);
                                                    if (!isDayActive) return null;
                                                    const isToday = idx === currentDayIndex;
                                                    return (
                                                        <span key={idx} className={`text-[8px] font-bold px-1 py-0.5 rounded border 
                                                            ${isToday ? 'bg-green-500/20 text-green-400 border-green-500/30 shadow-[0_0_8px_rgba(74,222,128,0.2)]' : 'bg-white/5 text-white/30 border-white/10'}
                                                        `}>
                                                            {dayName}
                                                        </span>
                                                    );
                                                })}
                                            </div>

                                            {isAvailableToday && (
                                                <span className="material-symbols-outlined text-primary ml-2 text-sm">add</span>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="p-4 text-center text-white/40 text-xs">
                                    <p>Nenhuma música encontrada.</p>
                                    <p className="text-[10px] mt-1">Digite o código abaixo.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                <div className="flex gap-3">
                    <div className="w-32">
                        <input 
                            type="text" 
                            inputMode="numeric"
                            className={`w-full bg-black/30 border rounded-xl py-2 px-2 text-lg text-white placeholder:text-white/20 focus:outline-none text-center font-mono tracking-widest ${isCodeError ? 'border-red-500 animate-shake' : 'border-white/10 focus:border-primary'}`}
                            placeholder="CÓDIGO"
                            value={customerCode}
                            onChange={(e) => setCustomerCode(e.target.value.replace(/\D/g, ''))}
                        />
                    </div>
                    
                    <button 
                        onClick={handleSubmit}
                        disabled={!customerCode || isValidating}
                        className={`flex-1 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 ${selectedTrack ? 'bg-gradient-to-r from-primary to-orange-600 text-white hover:shadow-primary/40' : 'bg-white/10 text-white hover:bg-white/20 border border-white/5'} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {isValidating ? (
                            <span className="material-symbols-outlined animate-spin text-xl">refresh</span>
                        ) : selectedTrack ? 'PEDIR MÚSICA' : 'ENVIAR SUGESTÃO'}
                    </button>
                </div>
            </div>

            <div className="liquid-glass p-0 rounded-3xl flex-1 flex min-h-0 h-40 lg:h-auto bg-[#0e0e0e] border border-white/5 overflow-hidden relative">
                
                <div className="absolute top-0 right-0 h-full aspect-square z-0 max-w-[50%] lg:max-w-none">
                    <img 
                        src={playlistCoverUrl} 
                        alt="Capa da Playlist" 
                        className="w-full h-full object-cover object-center" 
                        style={{ 
                            maskImage: 'linear-gradient(to right, transparent 0%, black 100%)', 
                            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 100%)',
                            aspectRatio: '1/1'
                        }}
                    />
                </div>
                <div className="relative z-20 flex-1 p-5 flex flex-col justify-center max-w-[70%]">
                    <span className="inline-block px-2 py-0.5 rounded bg-primary/20 text-primary text-[9px] font-bold uppercase tracking-widest self-start mb-2 border border-primary/20">
                        {currentDayName}
                    </span>
                    <h2 className="text-xl font-bold text-white leading-tight mb-2 drop-shadow-lg truncate">
                        {playlistDoDia ? playlistDoDia.nome : 'Seleção Especial'}
                    </h2>
                    <p className="text-white/80 text-[10px] leading-relaxed line-clamp-2 mb-3 drop-shadow-md">
                        {playlistDoDia ? playlistDoDia.descricao : 'Curadoria exclusiva para sua noite.'}
                    </p>
                    {topArtistasPlaylist.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {topArtistasPlaylist.map((artista, i) => (
                                <span key={i} className="px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md border border-white/10 text-white/90 text-[8px] font-bold uppercase tracking-wide shadow-sm">
                                    {artista}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      <div className="mt-4 text-center text-[10px] text-text-muted pb-0">
          <p>© Developed by: <span className="text-primary font-semibold">Matteus Tirado</span></p>
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