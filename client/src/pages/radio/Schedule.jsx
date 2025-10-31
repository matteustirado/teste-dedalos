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
  let result = '';
  if (hours > 0) result += `${hours}h `;
  if (minutes > 0) result += `${minutes}m `;
  if (result === '') result = '0m';
  return result.trim();
}

const formatDateToYYYYMMDD = (date) => {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

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

const getTodayAtMidnightLocal = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
};

const getDatesForDayOfWeekInMonth = (year, month, dayOfWeek) => {
    const dates = [];
    const date = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    while (date.getDay() !== dayOfWeek) {
        date.setDate(date.getDate() + 1);
        if (date.getMonth() !== month) break;
    }

    while (date.getMonth() === month && date.getDate() <= daysInMonth) {
        dates.push(new Date(date.getTime()));
        date.setDate(date.getDate() + 7);
    }
    return dates;
};


export default function Schedule() {
  const navigate = useNavigate()
  const [playlists, setPlaylists] = useState([])
  const [allTracks, setAllTracks] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);

  const [viewMode, setViewMode] = useState('selectingDays');
  const [selectedDates, setSelectedDates] = useState([getTodayAtMidnightLocal()]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentSchedule, setCurrentSchedule] = useState({});
  const [repeatRule, setRepeatRule] = useState('NENHUMA');
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [activeStartDate, setActiveStartDate] = useState(new Date());
  const [scheduledDatesInMonth, setScheduledDatesInMonth] = useState([]);
  const [loadingMonthSummary, setLoadingMonthSummary] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoadingPlaylists(true);
      try {
        const [playlistsRes, tracksRes] = await Promise.all([
          axios.get(`${API_URL}/api/playlists`),
          axios.get(`${API_URL}/api/tracks`)
        ]);
        setPlaylists(playlistsRes.data || []);
        setAllTracks(tracksRes.data || []);
      } catch (err) {
        console.error("Erro ao buscar dados para agendamento", err);
        toast.error("Não foi possível carregar dados de playlists/músicas.");
      } finally {
        setLoadingPlaylists(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
  }, [selectedDate]);

  useEffect(() => {
    const fetchMonthSummary = async () => {
        setLoadingMonthSummary(true);
        const year = activeStartDate.getFullYear();
        const month = activeStartDate.getMonth() + 1;
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
  }, [activeStartDate]);

  const getPlaylistDetails = (playlist) => {
     if (!allTracks || allTracks.length === 0) { return { count: 0, duration: '0m' }; }
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

   const handleDateSelect = (value) => {
       const dates = Array.isArray(value) ? value : [value];
       const newDates = dates.map(date => {
           const newDate = new Date(date);
           newDate.setHours(0, 0, 0, 0);
           return newDate;
       });

       setSelectedDates(newDates);
       
       if (newDates.length > 0) {
           const earliestDate = new Date(Math.min.apply(null, newDates));
           setOriginalClickedDate(earliestDate);
       } else {
           setOriginalClickedDate(null);
       }
       
       setRepeatRule('NENHUMA');
   };

   const handleRepeatToggle = (e) => {
        const isChecking = e.target.checked;
        
        if (isChecking && originalClickedDate) {
            setRepeatRule('DIA_SEMANA_MES');
            
            const firstDate = originalClickedDate;
            const dates = getDatesForDayOfWeekInMonth(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDay());
            
            const futureDates = dates.filter(d => d.getDate() >= firstDate.getDate());
            
            setSelectedDates(futureDates);
        } else {
            setRepeatRule('NENHUMA');
            if (originalClickedDate) {
                 setSelectedDates([originalClickedDate]);
            }
        }
   };

  const handleConfirmSelection = async () => {
      if (selectedDates.length === 0) {
          toast.warn("Por favor, selecione pelo menos um dia.");
          return;
      }
      
      if (selectedDates.length === 1 && repeatRule === 'NENHUMA') {
          setLoadingSchedule(true);
          const dateString = formatDateToYYYYMMDD(selectedDates[0]);
          try {
              const response = await axios.get(`${API_URL}/api/agendamentos/${dateString}`);
              setCurrentSchedule(response.data || {});
          } catch (err) {
              console.error(`Erro ao buscar agendamento para ${dateString}:`, err);
              toast.error(`Não foi possível carregar o agendamento.`);
              setCurrentSchedule({});
          } finally {
              setLoadingSchedule(false);
          }
      } else {
          setCurrentSchedule({});
      }
      
      setViewMode('editingGrade');
  };

   const handlePlaylistDragStart = (e, playlist) => {
       const data = JSON.stringify({ playlist_id: playlist.id, playlist_nome: playlist.nome });
       e.dataTransfer.setData("playlistData", data);
   };

    const handleDropPlaylistToHour = (targetHour, playlistDataString) => {
        if (selectedDates.length === 0) return;
        try {
            const playlistData = JSON.parse(playlistDataString);
            if (!playlistData?.playlist_id) throw new Error("Dados inválidos.");
            const droppedPlaylist = playlists.find(p => p.id === playlistData.playlist_id);
            if (!droppedPlaylist) throw new Error("Playlist não encontrada.");
            const details = getPlaylistDetails(droppedPlaylist);
            const durationSeconds = calculateDurationStringToSeconds(details.duration);
            if (durationSeconds <= 0) { toast.warn("Duração inválida."); return; }

            let isOverlapping = false;
            for (let h = targetHour - 1; h >= 0; h--) {
                const existingItem = currentSchedule[h];
                if (existingItem) {
                    const existingEndTime = h + Math.ceil((existingItem.duration_seconds || 0) / 3600);
                    if (existingEndTime > targetHour) { isOverlapping = true; toast.warn(`Conflito com "${existingItem.playlist_nome}" às ${h}:00.`); break; }
                    break;
                }
            }
            if (isOverlapping) return;

            const hoursNeeded = Math.ceil(durationSeconds / 3600);
            const endTime = targetHour + hoursNeeded;
            for (let h = targetHour; h < endTime; h++) {
                 const itemAtCurrentHour = currentSchedule[h];
                 if (itemAtCurrentHour && itemAtCurrentHour.playlist_id !== playlistData.playlist_id) { isOverlapping = true; toast.warn(`Conflito com "${itemAtCurrentHour.playlist_nome}" às ${h}:00.`); break; }
                 if (h >= 24) { isOverlapping = true; toast.warn(`Playlist ultrapassa o fim do dia.`); break; }
            }
            if (isOverlapping) return;

            const previousHourKey = Object.keys(currentSchedule).find(hourKey => currentSchedule[hourKey]?.playlist_id === playlistData.playlist_id);
            const previousHour = previousHourKey !== undefined ? Number(previousHourKey) : null;

            setCurrentSchedule(prev => {
                const newSchedule = { ...prev };
                 if (previousHour !== null && previousHour !== targetHour) { newSchedule[previousHour] = null; }
                newSchedule[targetHour] = {
                    playlist_id: playlistData.playlist_id,
                    playlist_nome: playlistData.playlist_nome,
                    duration_seconds: durationSeconds
                };
                return newSchedule;
            });
        } catch (e) {
            console.error("Erro no drop:", e);
             toast.error(`Erro: ${e.message}`);
        }
    };
   const handleRemovePlaylistFromHour = (hour) => { setCurrentSchedule(prev => ({ ...prev, [hour]: null })); };
   
   const handleSaveSchedule = async (exitOnSave = true) => {
       if (selectedDates.length === 0) {
           toast.warn("Erro: Nenhum dia selecionado.");
           return;
       }

       setSavingSchedule(true);
       try {
           const scheduleToSend = {};
            Object.keys(currentSchedule).forEach(hour => {
                if(currentSchedule[hour]?.playlist_id) {
                    scheduleToSend[hour] = { playlist_id: currentSchedule[hour].playlist_id };
                }
            });

           const formattedDates = selectedDates.map(date => formatDateToYYYYMMDD(date));
           
           const finalRepeatRule = (repeatRule === 'DIA_SEMANA_MES')
             ? 'DIA_SEMANA_MES'
             : 'NENHUMA';

           await axios.post(`${API_URL}/api/agendamentos`, {
               dates: formattedDates,
               schedule: scheduleToSend,
               regra_repeticao: finalRepeatRule
           });
           
           toast.success('Agendamento salvo com sucesso!');
           
           const year = activeStartDate.getFullYear();
           const month = activeStartDate.getMonth() + 1;
           const summaryResponse = await axios.get(`${API_URL}/api/agendamentos/summary/${year}/${month}`);
           setScheduledDatesInMonth(summaryResponse.data || []);
           
           if (exitOnSave) {
               setViewMode('selectingDays');
               setSelectedDates([getTodayAtMidnightLocal()]);
               setOriginalClickedDate(getTodayAtMidnightLocal());
               setCurrentSchedule({});
               setRepeatRule('NENHUMA');
           }
       } catch (err) {
           console.error("Erro ao salvar:", err);
           toast.error(err.response?.data?.error || "Falha ao salvar.");
       } finally {
           setSavingSchedule(false);
       }
   };

   const handleDownloadReport = () => {
       if (selectedDates.length !== 1) return;
       const dateString = formatDateToYYYYMMDD(selectedDates[0]);
       window.open(`${API_URL}/api/agendamentos/relatorio/${dateString}`, '_blank');
   };
 
   const handleClearSchedule = () => { if (window.confirm("Limpar grade?")) { setCurrentSchedule({}); } };
   const handleActiveStartDateChange = ({ activeStartDate }) => { setActiveStartDate(activeStartDate); };

   
   const tileClassName = ({ date, view }) => {
       if (view === 'month') { 
           const dateString = formatDateToYYYYMMDD(date);
           if (scheduledDatesInMonth.includes(dateString)) {
               return 'scheduled-day';
           }
       }
       return null;
   };

 
   const showRepeatCheckbox = viewMode === 'selectingDays' && selectedDates.length === 1;
   const showScheduleButton = viewMode === 'selectingDays' && selectedDates.length > 0;
   const isSingleDateSelected = selectedDates.length === 1;
   const isPastDateSelected = isSingleDateSelected && selectedDates[0] < getTodayAtMidnightLocal(); 

   const repeatLabel = useMemo(() => {
        if (!showRepeatCheckbox) {
            return "";
        }
        try {
            const date = originalClickedDate; 
            if (!date) return "Repetir dia da semana no mês";
            
            const diaSemana = date.toLocaleDateString('pt-BR', { weekday: 'long' });
            const mes = date.toLocaleDateString('pt-BR', { month: 'long' });
            
            const diaSemanaCapitalized = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
            
            return `Repetir nas próximas ${diaSemanaCapitalized}s do mês de ${mes}`;
        } catch (e) {
            console.error("Erro ao formatar data para label:", e);
            return "Repetir dia da semana no mês";
        }
    }, [originalClickedDate, showRepeatCheckbox]);


  return (
    <div className="min-h-screen bg-gradient-warm flex">
      <aside className="fixed left-0 top-0 h-screen w-64 bg-bg-dark-primary/50 backdrop-blur-sm border-r border-white/10 p-4 flex flex-col justify-between z-10">
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-red-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-2xl">calendar_month</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-white text-lg font-bold leading-tight">Agendamento</h1>
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
            <button onClick={() => navigate('/radio/library')} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined">library_music</span>
              <p className="text-base font-medium">Biblioteca</p>
            </button>
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/20 border border-primary/50 relative">
               <button
                   onClick={() => navigate('/radio/library')}
                   className="p-2 rounded-md hover:bg-white/10 text-primary"
                   title="Voltar para Biblioteca"
               >
                   <span className="material-symbols-outlined text-lg">arrow_back_ios_new</span>
               </button>
               <div className="flex items-center gap-3 px-2 py-1 text-primary flex-1 justify-center">
                   <span className="material-symbols-outlined">calendar_month</span>
                   <p className="text-sm font-semibold">Agendamento</p>
               </div>
            </div>
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
           <button
               onClick={() => navigate('/radio/library')}
               className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 mb-4"
           >
               <span className="material-symbols-outlined text-lg">arrow_back_ios_new</span>
               Voltar para Biblioteca
           </button>

          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">Agendamento</h1>
              <p className="text-text-muted text-sm">
                {viewMode === 'selectingDays' ? 'Selecione os dias para agendar' : 'Arraste playlists para os horários'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 items-start">
            <div className="col-span-1 liquid-glass rounded-xl p-4 flex flex-col max-h-[calc(100vh-240px)]">
               <h2 className="text-lg font-bold text-white mb-3">Playlists Disponíveis</h2>
               <input
                   type="text"
                   placeholder="Buscar playlist..."
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm mb-3 placeholder:text-text-muted focus:ring-1 focus:ring-primary flex-shrink-0"
               />
               <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-2 scrollbar-thin scrollbar-thumb-primary/60 scrollbar-track-white/5">
                 {loadingPlaylists ? (
                     <p className="text-xs text-text-muted text-center py-4">Carregando playlists...</p>
                 ) : filteredPlaylists.length === 0 ? (
                     <p className="text-xs text-text-muted text-center py-4">Nenhuma playlist encontrada.</p>
                 ) : (
                     filteredPlaylists.map((playlist) => {
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
                     })
                 )}
               </div>
            </div>

            <div className="col-span-2 space-y-6">
            
              {viewMode === 'selectingDays' && (
                   <div className="liquid-glass rounded-xl p-6">
                       <div className="mb-4 calendar-container max-w-md mx-auto">
                           <label className="block text-sm font-medium text-text-muted mb-1">Selecione um ou mais dias</label>
                           <Calendar
                               onChange={handleDateSelect}
                               value={selectedDates}
                               onActiveStartDateChange={handleActiveStartDateChange}
                               activeStartDate={activeStartDate}
                               tileClassName={tileClassName}
                               locale="pt-BR"
                               selectMultiple={true}
                               className="bg-white/5 border border-white/10 rounded-lg p-2 text-text"
                           />
                            {loadingMonthSummary && <div className="text-xs text-text-muted text-center mt-1">Carregando info...</div>}
                       </div>
                       
                       <div className="mt-4 flex flex-col items-center gap-4">
                           {showRepeatCheckbox && (
                               <div className="flex items-center gap-2">
                                   <input
                                       type="checkbox"
                                       id="repeat-schedule"
                                       checked={repeatRule === 'DIA_SEMANA_MES'}
                                       onChange={handleRepeatToggle}
                                       className="w-4 h-4 rounded bg-white/20 border-white/30 text-primary focus:ring-primary"
                                   />
                                   <label htmlFor="repeat-schedule" className="text-sm font-medium text-white">
                                        {repeatLabel}
                                   </label>
                               </div>
                           )}
                           {isPastDateSelected && (
                                <button
                                   onClick={handleDownloadReport}
                                   className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
                                >
                                   <span className="material-symbols-outlined text-base">download</span>
                                   Baixar Relatório do dia {selectedDates[0].toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                </button>
                           )}
                           {showScheduleButton && (
                               <button
                                   onClick={handleConfirmSelection}
                                   className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/80 transition-colors"
                               >
                                   Gerenciar Agendamento
                               </button>
                           )}
                       </div>
                   </div>
              )}
              
              {viewMode === 'editingGrade' && (
                   <div className="liquid-glass rounded-xl p-6">
                         <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-4">
                             <div>
                                 <h3 className="text-lg font-bold text-white">Editando Grade para:</h3>
                                 <p className="text-sm text-text-muted">
                                     {selectedDates.length === 1
                                       ? selectedDates[0].toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                                       : `${selectedDates.length} dias selecionados`}
                                     {repeatRule === 'DIA_SEMANA_MES' && " (Repetindo no mês)"}
                                 </p>
                             </div>
                             <button
                                onClick={() => { 
                                    setViewMode('selectingDays'); 
                                    setCurrentSchedule({}); 
                                    setRepeatRule('NENHUMA');
                                    setSelectedDates([originalClickedDate || getTodayAtMidnightLocal()]);
                                 }}
                                className="bg-white/10 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white/20 transition-colors"
                             >
                                 Mudar Seleção
                             </button>
                         </div>
                         
                         <div className="flex justify-end gap-4 mb-4">
                             <button
                                 onClick={handleClearSchedule}
                                 disabled={loadingSchedule || savingSchedule || Object.keys(currentSchedule).length === 0 || Object.values(currentSchedule).every(v => v === null)}
                                 className="bg-white/10 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-white/20 transition-colors disabled:opacity-50"
                             >
                                 Limpar Grade
                             </button>
                             <button
                                 onClick={() => handleSaveSchedule(false)}
                                 disabled={savingSchedule || loadingSchedule}
                                 className="bg-primary/70 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-primary/80 transition-colors disabled:opacity-50"
                             >
                                 {savingSchedule ? 'Salvando...' : 'Salvar'}
                             </button>
                             <button
                                 onClick={() => handleSaveSchedule(true)}
                                 disabled={savingSchedule || loadingSchedule}
                                 className="bg-primary text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-primary/80 transition-colors disabled:opacity-50"
                             >
                                 {savingSchedule ? 'Salvando...' : 'Salvar e Voltar'}
                             </button>
                         </div>
                         
                         <div className="pr-2 -mr-2 max-h-[calc(100vh-500px)] overflow-y-auto scrollbar-thin scrollbar-thumb-primary/60 scrollbar-track-white/5">
                             <HourlyScheduleList
                                 scheduleData={currentSchedule}
                                 onDropPlaylist={handleDropPlaylistToHour}
                                 onRemovePlaylist={handleRemovePlaylistFromHour}
                                 loadingSchedule={loadingSchedule}
                             />
                         </div>
                   </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}