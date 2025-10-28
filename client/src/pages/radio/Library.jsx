import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { toast } from 'react-toastify';


const HourlyScheduleList = ({ scheduleData, onDropPlaylist, onRemovePlaylist, loadingSchedule }) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const [dragOverHour, setDragOverHour] = useState(null);

  const MINUTE_TO_PIXEL_SCALE = 1;
  const HOUR_HEIGHT = 60 * MINUTE_TO_PIXEL_SCALE;

  const handleDragOver = (e, hour) => {
    e.preventDefault();
    setDragOverHour(hour);
  };

  const handleDragLeave = () => {
    setDragOverHour(null);
  };

  const handleDrop = (e, hour) => {
    e.preventDefault();
    setDragOverHour(null);
    onDropPlaylist(hour, e.dataTransfer.getData("playlistData"));
  };

  const formatHourDuration = (totalSeconds) => {
      if (typeof totalSeconds !== 'number' || totalSeconds <= 0) return '';
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      let result = '';
      if (hours > 0) result += `${hours}h `;
      if (minutes > 0) result += `${minutes}m `;
      return result.trim();
  }


  if (loadingSchedule) {
     return (
         <div className="flex justify-center items-center h-64">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
             <span className="ml-3 text-text-muted">Carregando grade...</span>
         </div>
     );
  }

  return (
    <div className="relative space-y-0">
      {hours.map(hour => {
        const scheduledItem = scheduleData ? scheduleData[hour] : null;
        const hourString = `${String(hour).padStart(2, '0')}:00`;
        const isDragOver = dragOverHour === hour;

        const playlistHeight = scheduledItem
            ? Math.max(scheduledItem.duration_seconds / 60 * MINUTE_TO_PIXEL_SCALE, 15)
            : 0;
        const durationString = scheduledItem ? formatHourDuration(scheduledItem.duration_seconds) : '';

        return (
          <div
            key={hour}
            onDragOver={(e) => handleDragOver(e, hour)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, hour)}
            className={`flex items-start border-t border-white/10 relative ${
              isDragOver ? 'bg-primary/10' : ''
            }`}
            style={{ height: `${HOUR_HEIGHT}px` }}
          >
            <span className="text-xs font-mono text-text-muted w-10 text-right flex-shrink-0 pt-1 pr-1">
              {hourString}
            </span>

            {!scheduledItem && (
                 <div className={`flex-1 text-center text-[10px] mt-1 mr-1 h-[calc(100%-4px)] border-dashed border-white/10 rounded flex items-center justify-center transition-colors ${
                   isDragOver ? 'border-primary/50 text-primary border-solid' : 'border-white/10 text-text-muted/50'
                 }`}>

                 </div>
            )}

            {scheduledItem && (
              <div
                className="absolute left-[44px] right-0 top-0 z-10 p-1 pl-2 bg-primary/30 border border-primary/50 rounded text-sm group overflow-hidden shadow-md"
                style={{
                    height: `${playlistHeight}px`,
                    minHeight: '20px'
                }}
                title={`${scheduledItem.playlist_nome} (${durationString})`}
              >
                <div className="flex justify-between items-start h-full">
                    <div className='min-w-0 flex-1 pt-0.5'>
                        <p className="text-white font-medium text-xs truncate leading-tight">
                          {scheduledItem.playlist_nome || 'Playlist Deletada'}
                        </p>
                        {durationString && <p className='text-[10px] text-primary/80 truncate leading-tight'>{durationString}</p>}
                    </div>
                    <button
                        onClick={() => onRemovePlaylist(hour)}
                        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/30 transition-opacity flex-shrink-0"
                        title="Remover playlist deste horário"
                    >
                         <span className="material-symbols-outlined text-red-400 text-sm leading-none">close</span>
                    </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <div className="border-t border-white/10" style={{ height: '0px' }}></div>
    </div>
  );
};


const API_URL = 'http://localhost:4000'

const formatTotalDuration = (totalSeconds) => {
  if (typeof totalSeconds !== 'number' || totalSeconds <= 0) return '0s';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  let result = '';
  if (hours > 0) result += `${hours}h `;
  if (minutes > 0) result += `${minutes}m `;
  if (seconds >= 0 && (hours === 0 && minutes === 0)) result += `${seconds}s`;
  else if (seconds > 0) result += `${seconds}s`;
  return result.trim() || '0s';
}

const formatDateToYYYYMMDD = (date) => {
    if (!date) return null;
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}


export default function Library() {
  const navigate = useNavigate()
  const [playlists, setPlaylists] = useState([])
  const [allTracks, setAllTracks] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState(null);

  const [isSchedulingMode, setIsSchedulingMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentSchedule, setCurrentSchedule] = useState({});
  const [repeatRule, setRepeatRule] = useState('NENHUMA');
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [activeStartDate, setActiveStartDate] = useState(new Date());
  const [scheduledDatesInMonth, setScheduledDatesInMonth] = useState([]);
  const [loadingMonthSummary, setLoadingMonthSummary] = useState(false);



  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        const [playlistsRes, tracksRes] = await Promise.all([
          axios.get(`${API_URL}/api/playlists`),
          axios.get(`${API_URL}/api/tracks`)
        ]);
        setPlaylists(playlistsRes.data || []);
        setAllTracks(tracksRes.data || []);
      } catch (err) {
        console.error("Erro ao buscar dados", err);
        toast.error("Não foi possível carregar os dados iniciais da biblioteca.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);


  useEffect(() => {
    const fetchSchedule = async () => {
        const dateString = formatDateToYYYYMMDD(selectedDate);
        if (!dateString || !isSchedulingMode) {
            setCurrentSchedule({});
            return;
        }
        setLoadingSchedule(true);

        try {
            const response = await axios.get(`${API_URL}/api/agendamentos/${dateString}`);
            setCurrentSchedule(response.data || {});
        } catch (err) {
            console.error(`Erro ao buscar agendamento para ${dateString}:`, err);
            toast.error(`Não foi possível carregar o agendamento para ${selectedDate?.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}.`);
            setCurrentSchedule({});
        } finally {
            setLoadingSchedule(false);
        }
    };
    fetchSchedule();
  }, [selectedDate, isSchedulingMode]);


  useEffect(() => {
    const fetchMonthSummary = async () => {
        if (!isSchedulingMode) {
            setScheduledDatesInMonth([]);
            return;
        }
        setLoadingMonthSummary(true);
        const year = activeStartDate.getUTCFullYear();
        const month = activeStartDate.getUTCMonth() + 1;
        try {
            const response = await axios.get(`${API_URL}/api/agendamentos/summary/${year}/${month}`);
            setScheduledDatesInMonth(response.data || []);
        } catch (err) {
            console.error(`Erro ao buscar resumo para ${year}-${month}:`, err);
             toast.error("Erro ao buscar resumo do calendário.");
        } finally {
            setLoadingMonthSummary(false);
        }
    };
    const timer = setTimeout(fetchMonthSummary, 100);
    return () => clearTimeout(timer);
  }, [activeStartDate, isSchedulingMode]);



  const getPlaylistDetails = (playlist) => {
     if (!allTracks || allTracks.length === 0) {
      return { count: 0, duration: '0s' };
    }
    const trackIds = Array.isArray(playlist.tracks_ids) ? playlist.tracks_ids : [];
    const trackCount = trackIds.length;
    let totalDurationSeconds = 0;
    trackIds.forEach(id => {
      const track = allTracks.find(t => t.id === Number(id));
      if (track) {
        const end = track.end_segundos ?? track.duracao_segundos;
        const start = track.start_segundos ?? 0;
        const duration = (end > start) ? (end - start) : 0;
        totalDurationSeconds += duration;
      }
    });
    return {
      count: trackCount,
      duration: formatTotalDuration(totalDurationSeconds)
    };
  };

  const filteredPlaylists = useMemo(() => {
    if (!searchTerm) return playlists;
    const lowerQuery = searchTerm.toLowerCase();
    return playlists.filter(p => p.nome.toLowerCase().includes(lowerQuery));
  }, [playlists, searchTerm]);

  const handleEditPlaylist = (playlistId) => {
    navigate(`/radio/playlist-creator/${playlistId}`);
  };

  const openDeletePlaylistModal = (playlist) => {
    setPlaylistToDelete(playlist);
    setShowDeleteModal(true);
  };

  const closeDeletePlaylistModal = () => {
    setPlaylistToDelete(null);
    setShowDeleteModal(false);
  };

  const confirmDeletePlaylist = async () => {
    if (!playlistToDelete) return;
    try {
      await axios.delete(`${API_URL}/api/playlists/${playlistToDelete.id}`);
      setPlaylists(prev => prev.filter(p => p.id !== playlistToDelete.id));
       setCurrentSchedule(prevSchedule => {
           const newSchedule = { ...prevSchedule };
           let changed = false;
           Object.keys(newSchedule).forEach(hour => {
               if (newSchedule[hour]?.playlist_id === playlistToDelete.id) {
                   newSchedule[hour] = null;
                   changed = true;
               }
           });
           return changed ? newSchedule : prevSchedule;
       });
       toast.success(`Playlist "${playlistToDelete.nome}" excluída com sucesso!`);
      closeDeletePlaylistModal();
    } catch (err) {
      console.error("Erro ao excluir playlist", err);
      toast.error(`Falha ao excluir a playlist "${playlistToDelete.nome}".`);
      closeDeletePlaylistModal();
    }
  };

   const handleDateSelect = (date) => {
       console.log("Data selecionada (Date obj):", date);
       setSelectedDate(date);
   };

   const handleToggleSchedulingMode = () => {
       const nextMode = !isSchedulingMode;
       setIsSchedulingMode(nextMode);
       if (!nextMode) {
           setSelectedDate(null);
           setCurrentSchedule({});

           setSearchTerm('');
           setRepeatRule('NENHUMA');
           setActiveStartDate(new Date());
           setScheduledDatesInMonth([]);
       } else {
           const today = new Date();
           today.setUTCHours(0, 0, 0, 0);
           setSelectedDate(today);
           setActiveStartDate(today);
       }
   };

   const handlePlaylistDragStart = (e, playlist) => {
       const details = getPlaylistDetails(playlist);
       const data = JSON.stringify({
           playlist_id: playlist.id,
           playlist_nome: playlist.nome,
       });
       e.dataTransfer.setData("playlistData", data);
   };

    const handleDropPlaylistToHour = (targetHour, playlistDataString) => {

        if (!selectedDate) return;
        try {
            const playlistData = JSON.parse(playlistDataString);
            if (!playlistData || !playlistData.playlist_id) {
                 throw new Error("Dados da playlist inválidos.");
            }

            const droppedPlaylist = playlists.find(p => p.id === playlistData.playlist_id);
            if (!droppedPlaylist) {
                 throw new Error("Playlist arrastada não encontrada nos dados carregados.");
            }

            const details = getPlaylistDetails(droppedPlaylist);
            const durationSeconds = calculateDurationStringToSeconds(details.duration);
            if (durationSeconds <= 0) {
                 toast.warn("Playlist selecionada tem duração zero ou inválida.");
                 return;
            }

            let isOverlapping = false;

            for (let h = targetHour - 1; h >= 0; h--) {
                const existingItem = currentSchedule[h];
                if (existingItem) {
                    const existingDurationMinutes = (existingItem.duration_seconds || 0) / 60;
                    const existingEndTime = h + Math.ceil(existingDurationMinutes / 60);
                    if (existingEndTime > targetHour) {
                        isOverlapping = true;
                        toast.warn(`Conflito: O horário ${targetHour}:00 está ocupado pela playlist "${existingItem.playlist_nome}" iniciada às ${h}:00.`);
                        break;
                    }
                    break;
                }
            }
             if (isOverlapping) return;

            const hoursNeeded = Math.ceil(durationSeconds / 3600);
            const endTime = targetHour + hoursNeeded;

            for (let h = targetHour; h < endTime; h++) {
                 const itemAtCurrentHour = currentSchedule[h];
                 if (itemAtCurrentHour && itemAtCurrentHour.playlist_id !== playlistData.playlist_id) {
                     isOverlapping = true;
                     toast.warn(`Conflito: A playlist ${playlistData.playlist_nome} (${details.duration}) sobreporia "${itemAtCurrentHour.playlist_nome}" às ${h}:00.`);
                     break;
                 }
                if (h >= 24) {
                    isOverlapping = true;
                    toast.warn(`A playlist ${playlistData.playlist_nome} (${details.duration}) ultrapassaria o fim do dia.`);
                    break;
                }
            }
             if (isOverlapping) return;

             const previousHour = Object.keys(currentSchedule).find(hourKey => currentSchedule[hourKey]?.playlist_id === playlistData.playlist_id);

            setCurrentSchedule(prev => {
                const newSchedule = { ...prev };
                 if (previousHour !== undefined && Number(previousHour) !== targetHour) {
                     newSchedule[Number(previousHour)] = null;
                 }
                newSchedule[targetHour] = {
                    playlist_id: playlistData.playlist_id,
                    playlist_nome: playlistData.playlist_nome,
                    duration_seconds: durationSeconds
                };
                return newSchedule;
            });

        } catch (e) {
            console.error("Erro ao processar dados da playlist no drop:", e);
             toast.error(`Erro ao adicionar playlist à grade: ${e.message}`);
        }
    };

     const calculateDurationStringToSeconds = (durationString) => {
        if (!durationString || typeof durationString !== 'string') return 0;
        let totalSeconds = 0;
        const hourMatch = durationString.match(/(\d+)\s*h/);
        const minMatch = durationString.match(/(\d+)\s*m/);
        const secMatch = durationString.match(/(\d+)\s*s/);
        if (hourMatch) totalSeconds += parseInt(hourMatch[1], 10) * 3600;
        if (minMatch) totalSeconds += parseInt(minMatch[1], 10) * 60;
        if (secMatch) totalSeconds += parseInt(secMatch[1], 10);
        return totalSeconds;
     };


     const handleRemovePlaylistFromHour = (hour) => {
        setCurrentSchedule(prev => ({
            ...prev,
            [hour]: null
        }));
     };

   const handleSaveSchedule = async () => {
       const dateString = formatDateToYYYYMMDD(selectedDate);
       if (!dateString) {
           toast.warn("Selecione uma data para salvar o agendamento.");
           return;
       }

       setSavingSchedule(true);

       try {
           const scheduleToSend = {};
            Object.keys(currentSchedule).forEach(hour => {
                if(currentSchedule[hour]) {
                    scheduleToSend[hour] = { playlist_id: currentSchedule[hour].playlist_id };
                } else {
                     scheduleToSend[hour] = null;
                }
            });

           await axios.post(`${API_URL}/api/agendamentos`, {
               data: dateString,
               schedule: scheduleToSend,
               regra_repeticao: repeatRule
           });
           toast.success('Agendamento salvo com sucesso!');
           const year = activeStartDate.getUTCFullYear();
           const month = activeStartDate.getUTCMonth() + 1;
           const summaryResponse = await axios.get(`${API_URL}/api/agendamentos/summary/${year}/${month}`);
           setScheduledDatesInMonth(summaryResponse.data || []);


       } catch (err) {
           console.error("Erro ao salvar agendamento:", err);
           toast.error(err.response?.data?.error || "Falha ao salvar o agendamento.");
       } finally {
           setSavingSchedule(false);
       }
   };

   const handleDownloadReport = () => {
       const dateString = formatDateToYYYYMMDD(selectedDate);
       if (!dateString) {
           toast.warn("Selecione uma data para baixar o relatório.");
           return;
       }
       const today = new Date();
       today.setUTCHours(0, 0, 0, 0);

       if (selectedDate >= today) {
            toast.warn("Só é possível baixar relatórios de datas passadas.");
            return;
       }

       window.open(`${API_URL}/api/agendamentos/relatorio/${dateString}`, '_blank');
   };


   const handleClearSchedule = () => {
       if (window.confirm("Tem certeza que deseja limpar toda a grade horária para este dia?")) {
           setCurrentSchedule({});
       }
   };

   const handleActiveStartDateChange = ({ activeStartDate }) => {
       setActiveStartDate(activeStartDate);
   };

   const tileClassName = ({ date, view }) => {
       if (view === 'month') {

           const dateString = formatDateToYYYYMMDD(date);
           if (scheduledDatesInMonth.includes(dateString)) {
               return 'scheduled-day';
           }
       }
       return null;
   };


  return (
    <div className="min-h-screen bg-gradient-warm flex">
      <aside className="fixed left-0 top-0 h-screen w-64 bg-bg-dark-primary/50 backdrop-blur-sm border-r border-white/10 p-4 flex flex-col justify-between z-10">
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-red-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-2xl">{isSchedulingMode ? 'calendar_month' : 'library_music'}</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-white text-lg font-bold leading-tight">{isSchedulingMode ? 'Agendamento' : 'Biblioteca'}</h1>
              <p className="text-text-muted text-sm">Rádio Dedalos</p>
            </div>
          </div>
          <nav className="flex flex-col gap-2">
            <button onClick={() => navigate('/')} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined">home</span>
              <p className="text-base font-medium">Home</p>
            </button>
            <button onClick={() => navigate('/radio/dj')} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined">radio</span>
              <p className="text-base font-medium">Painel do DJ</p>
            </button>
            <button onClick={() => navigate('/radio/collection')} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined">music_video</span>
              <p className="text-base font-medium">Acervo de Músicas</p>
            </button>
            <button onClick={() => navigate('/radio/playlist-creator')} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined">playlist_add</span>
              <p className="text-base font-medium">Criar Playlist</p>
            </button>
            <button onClick={() => { if (isSchedulingMode) handleToggleSchedulingMode(); }} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${!isSchedulingMode ? 'bg-primary/20 text-primary border border-primary/50' : 'hover:bg-white/10'}`}>
              <span className="material-symbols-outlined">library_music</span>
              <p className={`text-base font-${!isSchedulingMode ? 'semibold' : 'medium'}`}>Biblioteca</p>
            </button>
          </nav>
        </div>
        <div className="flex flex-col gap-3">
          <button disabled className="flex w-full items-center justify-center rounded-lg h-12 px-4 text-white text-base font-bold bg-gray-600 cursor-not-allowed opacity-50">
            <span className="truncate">Ao Vivo</span>
          </button>
          <div className="text-center text-xs text-text-muted pb-2">
            <p>© Developed by: <span className="text-primary font-semibold">Matteus Tirado</span></p>
          </div>
        </div>
      </aside>

      <main className="ml-64 flex-1 p-8">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">
                {isSchedulingMode ? `Agendamento para ${selectedDate ? selectedDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '...'}` : 'Biblioteca de Playlists'}
              </h1>
              <p className="text-text-muted text-sm">
                {isSchedulingMode ? 'Selecione uma data e arraste playlists' : 'Todas as playlists criadas'}
              </p>
            </div>
            <button
              onClick={handleToggleSchedulingMode}
              className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/80 transition-all shadow-lg hover:scale-105"
            >
              <span className="material-symbols-outlined">{isSchedulingMode ? 'arrow_back' : 'calendar_add_on'}</span>
              {isSchedulingMode ? 'Voltar para Biblioteca' : 'Novo Agendamento'}
            </button>
          </div>




          {!isSchedulingMode ? (
            <>
              <div className="liquid-glass rounded-xl p-6 mb-6">
                 <div className="flex gap-4 items-center">
                   <div className="flex-1 relative">
                     <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">search</span>
                     <input type="text" placeholder="Buscar playlists..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-lg pl-12 pr-4 py-2 text-white placeholder:text-text-muted focus:ring-2 focus:ring-primary focus:border-transparent" />
                   </div>
                   <div className="relative">
                     <select className="appearance-none bg-white/10 border border-white/20 rounded-lg pl-4 pr-10 py-2 text-white focus:ring-2 focus:ring-primary cursor-pointer">
                       <option className="bg-bg-dark-primary text-white">Todas as categorias</option>
                     </select>
                     <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">expand_more</span>
                   </div>
                 </div>
              </div>

              {loading && (
                <div className="text-center text-text-muted p-6">Carregando playlists...</div>
              )}

              {!loading && filteredPlaylists.length === 0 && (
                <div className="text-center text-text-muted p-6 liquid-glass rounded-xl">Nenhuma playlist encontrada.</div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPlaylists.map((playlist) => {
                  const details = getPlaylistDetails(playlist);
                  const imageUrl = playlist.imagem ? `${API_URL}${playlist.imagem}` : null;
                  return (
                    <div key={playlist.id} className="liquid-glass rounded-xl overflow-hidden hover:shadow-2xl transition-shadow duration-300 group">
                      <div
                        className="h-48 bg-gradient-to-br from-primary/70 to-red-600/70 flex items-center justify-center relative bg-cover bg-center"
                        style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : {}}
                      >
                        {!imageUrl && <span className="material-symbols-outlined text-white text-6xl opacity-50">queue_music</span>}
                        <div className={`absolute inset-0 transition-opacity duration-300 ${imageUrl ? 'bg-black/40 group-hover:bg-black/60' : 'bg-black/20'}`}></div>
                      </div>
                      <div className="p-5">
                        <h3 className="text-lg font-bold text-white mb-1 truncate">{playlist.nome}</h3>
                        <p className="text-sm text-text-muted mb-3 h-10 overflow-hidden line-clamp-2">{playlist.descricao || 'Sem descrição'}</p>
                        <div className="flex items-center justify-between text-xs mb-4 text-text-muted font-medium">
                          <span>{details.count} MÚSICAS</span>
                          <span>{details.duration}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditPlaylist(playlist.id)}
                            className="flex-1 bg-primary/20 text-primary px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/30 transition-colors"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => openDeletePlaylistModal(playlist)}
                            className="flex-1 bg-red-500/20 text-red-500 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-500/30 transition-colors"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-3 gap-6 items-start">
              <div className="col-span-1 liquid-glass rounded-xl p-4 flex flex-col max-h-[calc(100vh-200px)]">
                 <h2 className="text-lg font-bold text-white mb-3">Playlists Disponíveis</h2>
                 <input
                     type="text"
                     placeholder="Buscar playlist..."
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm mb-3 placeholder:text-text-muted focus:ring-1 focus:ring-primary"
                 />
                 <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-2 scrollbar-thin scrollbar-thumb-primary/60 scrollbar-track-white/5">
                   {loading && <p className="text-xs text-text-muted text-center">Carregando...</p>}
                   {!loading && filteredPlaylists.length === 0 && <p className="text-xs text-text-muted text-center">Nenhuma playlist encontrada.</p>}
                   {filteredPlaylists.map((playlist) => {
                       const details = getPlaylistDetails(playlist);
                       return (
                           <div
                               key={playlist.id}
                               draggable
                               onDragStart={(e) => handlePlaylistDragStart(e, playlist)}
                               className="flex items-center gap-2 p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-grab group"
                           >
                               <div className="flex-1 min-w-0">
                                   <p className="text-white font-medium text-sm truncate">{playlist.nome}</p>
                                   <p className="text-text-muted text-xs">{details.count} músicas • {details.duration}</p>
                               </div>
                               <span className="material-symbols-outlined text-text-muted/50 text-lg mr-1 group-hover:text-primary transition-colors">drag_indicator</span>
                           </div>
                       );
                   })}
                 </div>
              </div>

              <div className="col-span-2 liquid-glass rounded-xl p-6 flex flex-col max-h-[calc(100vh-200px)]">
                 <div className='mb-4 flex-shrink-0'>
                   <div className="mb-4 calendar-container">
                       <label className="block text-sm font-medium text-text-muted mb-1">Selecionar Data</label>
                       <Calendar
                           onChange={handleDateSelect}
                           value={selectedDate}
                           onActiveStartDateChange={handleActiveStartDateChange}
                           activeStartDate={activeStartDate}
                           tileClassName={tileClassName}
                           locale="pt-BR"
                           className="bg-white/5 border border-white/10 rounded-lg p-2 text-text"
                       />
                        {loadingMonthSummary && <div className="text-xs text-text-muted text-center mt-1">Carregando info do mês...</div>}
                   </div>

                   <div className="flex items-center justify-between mt-4 flex-wrap gap-y-2">
                         <div className="flex items-center gap-4 flex-wrap">
                             <div className="flex items-center gap-2">
                                 <input
                                     type="checkbox"
                                     id="repeat-schedule"
                                     checked={repeatRule === 'DIA_SEMANA_MES'}
                                     onChange={(e) => setRepeatRule(e.target.checked ? 'DIA_SEMANA_MES' : 'NENHUMA')}
                                     className="w-4 h-4 rounded bg-white/20 border-white/30 text-primary focus:ring-primary"
                                 />
                                 <label htmlFor="repeat-schedule" className="text-sm font-medium text-white whitespace-nowrap">
                                      Repetir dia da semana no mês
                                 </label>
                             </div>
                             <button
                                 onClick={handleDownloadReport}
                                 disabled={!selectedDate || selectedDate >= new Date(new Date().setUTCHours(0,0,0,0))}
                                 className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                 title="Baixar relatório (apenas datas passadas)"
                             >
                                 <span className="material-symbols-outlined text-base">download</span>
                                 Baixar Relatório
                             </button>
                         </div>

                         <div className="flex gap-2">
                             <button
                                 onClick={handleClearSchedule}
                                 disabled={loadingSchedule || savingSchedule || Object.keys(currentSchedule).length === 0 || Object.values(currentSchedule).every(v => v === null)}
                                 className="bg-white/10 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                             >
                                 Limpar Grade
                             </button>
                             <button
                                 onClick={handleSaveSchedule}
                                 disabled={!selectedDate || loadingSchedule || savingSchedule}
                                 className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-4"
                             >
                                 {savingSchedule ? (
                                     <div className="flex items-center justify-center">
                                         <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                         Salvando...
                                     </div>
                                 ) : 'Salvar Agendamento'}
                             </button>
                         </div>
                   </div>
                 </div>

                 <h2 className="text-lg font-bold text-white mb-3 mt-2 border-t border-white/10 pt-4 flex-shrink-0">
                   Grade Horária para {selectedDate ? selectedDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '...'}
                 </h2>
                 <div className="flex-1 overflow-y-auto pr-2 -mr-2 scrollbar-thin scrollbar-thumb-primary/60 scrollbar-track-white/5">
                   <HourlyScheduleList
                       scheduleData={currentSchedule}
                       onDropPlaylist={handleDropPlaylistToHour}
                       onRemovePlaylist={handleRemovePlaylistFromHour}
                       loadingSchedule={loadingSchedule}
                   />
                 </div>
              </div>
            </div>
          )}


        </div>
      </main>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="liquid-glass rounded-xl p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Confirmar Exclusão</h3>
            <p className="text-text-muted mb-6">Tem certeza que deseja excluir permanentemente a playlist "{playlistToDelete?.nome}"?</p>
            <div className="flex justify-end gap-4">
              <button onClick={closeDeletePlaylistModal} className="bg-white/10 text-white px-6 py-2 rounded-lg font-semibold hover:bg-white/20 transition-colors">
                Cancelar
              </button>
              <button onClick={confirmDeletePlaylist} className="bg-red-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}