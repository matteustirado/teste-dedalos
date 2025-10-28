import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'

const API_URL = 'http://localhost:4000'
const WEEK_DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const ALL_DAYS_CODE = -1

export default function PlaylistCreator() {
  const navigate = useNavigate()
  const { playlistId } = useParams();
  const isEditMode = Boolean(playlistId);

  const [searchTerm, setSearchTerm] = useState('')
  const [newPlaylist, setNewPlaylist] = useState({
    name: '',
    description: '',
    cover: null, 
    coverFile: null 
  })
  
  const [acervoTracks, setAcervoTracks] = useState([])
  const [playlistTracks, setPlaylistTracks] = useState([])
  const [allTracksForLookup, setAllTracksForLookup] = useState([])
  const [draggedTrack, setDraggedTrack] = useState(null)
  const [isLive, setIsLive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedDayFilter, setSelectedDayFilter] = useState(ALL_DAYS_CODE)

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);
      try {
        const tracksResponse = await axios.get(`${API_URL}/api/tracks`);
        const processedTracks = tracksResponse.data.filter(t => t.status_processamento === 'PROCESSADO');
        setAcervoTracks(processedTracks);
        setAllTracksForLookup(processedTracks);

        if (isEditMode) {
          const playlistResponse = await axios.get(`${API_URL}/api/playlists/${playlistId}`);
          const playlistData = playlistResponse.data;

          setNewPlaylist({
            name: playlistData.nome || '',
            description: playlistData.descricao || '',
            cover: playlistData.imagem || null, 
            coverFile: null 
          });

          const trackIdsInPlaylist = playlistData.tracks_ids || [];

          const tracksForPlaylist = trackIdsInPlaylist
            .map(id => processedTracks.find(track => track.id === Number(id)))
            .filter(Boolean);
          setPlaylistTracks(tracksForPlaylist);
        }

      } catch (err) {
        console.error("Erro ao buscar dados iniciais:", err);
        setError(isEditMode ? "Não foi possível carregar a playlist para edição." : "Não foi possível carregar as músicas do acervo.");
        if (isEditMode && err.response?.status === 404) {
             setError("Playlist não encontrada.");
        } else if (isEditMode) {
           // Outros erros
        }
      } finally {
        setLoading(false);
      }
    }
    fetchInitialData()
  }, [playlistId, isEditMode, navigate])

  const handleCoverUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError("A imagem da capa não pode exceder 2MB.");
        return;
      }
      
      const previewUrl = URL.createObjectURL(file);
      setNewPlaylist(prev => ({
        ...prev,
        cover: previewUrl, 
        coverFile: file     
      }));
      setError(null);
      
      e.target.value = null;
    }
  }

  const addTrack = (track) => {
    setPlaylistTracks([...playlistTracks, track])
  }

  const removeTrack = (indexToRemove) => {
    setPlaylistTracks(playlistTracks.filter((_, index) => index !== indexToRemove))
  }

  const handleDragStart = (track, index) => {
    setDraggedTrack({ ...track, originalIndex: index })
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = (targetIndex) => {
    if (!draggedTrack || draggedTrack.originalIndex === targetIndex) {
       setDraggedTrack(null);
       return;
    }

    const newTracks = [...playlistTracks]
    const itemToMove = newTracks.splice(draggedTrack.originalIndex, 1)[0]
    newTracks.splice(targetIndex, 0, itemToMove)
    
    setPlaylistTracks(newTracks)
    setDraggedTrack(null)
  }

  const formatDuration = (totalSeconds) => {
    if (typeof totalSeconds !== 'number' || totalSeconds < 0) return '0:00';
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = Math.floor(totalSeconds % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

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

  const getTotalDurationSeconds = useMemo(() => {
    return playlistTracks.reduce((acc, track) => {
      const fullTrackData = allTracksForLookup.find(t => t.id === track.id);
      if (!fullTrackData) return acc;
      
      const end = fullTrackData.end_segundos ?? fullTrackData.duracao_segundos;
      const start = fullTrackData.start_segundos ?? 0;
      const duration = (end > start) ? (end - start) : 0;
      return acc + duration;
    }, 0)
  }, [playlistTracks, allTracksForLookup])

 const savePlaylist = async () => {
    if (!newPlaylist.name || playlistTracks.length === 0) {
      setError("A playlist precisa de um nome e pelo menos uma música.")
      return
    }
    setError(null)
    setLoading(true);

    const formData = new FormData();
    formData.append('name', newPlaylist.name);
    formData.append('description', newPlaylist.description);
    
    formData.append('tracks_ids', JSON.stringify(playlistTracks.map(t => t.id)));

    
    if (newPlaylist.coverFile) {
        formData.append('cover', newPlaylist.coverFile); 
    }

     if (isEditMode) {
       if (typeof newPlaylist.cover === 'string' && !newPlaylist.cover.startsWith('blob:') && !newPlaylist.coverFile) {
          formData.append('existingImagePath', newPlaylist.cover);
       } else if (!newPlaylist.coverFile) {
           formData.append('existingImagePath', ''); 
       }
    }


    try {
      const config = {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      };

      if (isEditMode) {
        await axios.put(`${API_URL}/api/playlists/${playlistId}`, formData, config);
      } else {
        await axios.post(`${API_URL}/api/playlists`, formData, config);
      }
      navigate('/radio/library');
    } catch (err) {
      console.error("Erro ao salvar/atualizar playlist", err);
       const errorMsg = err.response?.data?.error || (isEditMode ? "Falha ao atualizar a playlist." : "Falha ao salvar a playlist.");
      setError(errorMsg);
    } finally {
       setLoading(false);
    }
  }


  const clearPlaylistTracks = () => {
    setPlaylistTracks([])
    setError(null)
  }
  
  const checkProximity = (index) => {
     if (playlistTracks.length < 2) return false;
     const currentId = playlistTracks[index].id;
     const prevId = index > 0 ? playlistTracks[index - 1].id : null;
     const nextId = index < playlistTracks.length - 1 ? playlistTracks[index + 1].id : null;
     
     return currentId === prevId || currentId === nextId;
  }

  const filteredAcervo = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    const dayFilterValue = selectedDayFilter === ALL_DAYS_CODE ? null : selectedDayFilter;

    return allTracksForLookup.filter(track => {
      let dayMatch = false;
      if (dayFilterValue === null) {
        dayMatch = true;
      } else {
        const trackDaysNumbers = Array.isArray(track.dias_semana) ? track.dias_semana : [];
        dayMatch = trackDaysNumbers.includes(dayFilterValue);
      }

      if (!dayMatch) {
        return false;
      }

      if (!searchTerm) {
        return true;
      }
      const titleMatch = track.titulo.toLowerCase().includes(lowerSearchTerm);
      const artistMatch = track.artista && track.artista.toLowerCase().includes(lowerSearchTerm);

      return titleMatch || artistMatch;
    });
  }, [allTracksForLookup, selectedDayFilter, searchTerm]);

   
   const getCoverImageUrl = () => {
     if (newPlaylist.coverFile && newPlaylist.cover && newPlaylist.cover.startsWith('blob:')) {
       return newPlaylist.cover;
     }
     if (!newPlaylist.coverFile && typeof newPlaylist.cover === 'string' && newPlaylist.cover) {
       return `${API_URL}${newPlaylist.cover}`;
     }
     return null;
   };
   const coverImageUrl = getCoverImageUrl();


  return (
    <div className="min-h-screen bg-gradient-warm">
      <aside className="fixed left-0 top-0 h-screen w-64 bg-bg-dark-primary/50 backdrop-blur-sm border-r border-white/10 p-4 flex flex-col justify-between z-10">
          <div className="flex flex-col gap-8">
           <div className="flex items-center gap-3">
             <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-red-600 flex items-center justify-center">
               <span className="material-symbols-outlined text-white text-2xl">playlist_add</span>
             </div>
             <div className="flex flex-col">
               <h1 className="text-white text-lg font-bold leading-tight">{isEditMode ? 'Editar Playlist' : 'Criar Playlist'}</h1>
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
             <button onClick={() => isEditMode ? {} : navigate('/radio/playlist-creator')} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isEditMode ? 'bg-primary/20 text-primary border border-primary/50' : 'bg-primary/20 text-primary border border-primary/50'}`}>
                <span className="material-symbols-outlined">playlist_add</span>
                 <p className={`text-base font-semibold`}>{isEditMode ? 'Editando Playlist' : 'Criar Playlist'}</p>
             </button>
             <button onClick={() => navigate('/radio/library')} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
               <span className="material-symbols-outlined">library_music</span>
               <p className="text-base font-medium">Biblioteca</p>
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

      <main className="ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-1">{isEditMode ? 'Editar Playlist' : 'Nova Playlist'}</h1>
            <p className="text-text-muted text-sm">{isEditMode ? 'Modifique os detalhes da sua playlist' : 'Crie sua playlist personalizada'}</p>
          </div>

          {error && (
            <div className="bg-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm flex justify-between items-center">
              <span>{error}</span>
               <button onClick={() => setError(null)} className="material-symbols-outlined text-lg">close</button>
            </div>
          )}

          <div className="liquid-glass rounded-xl p-6 mb-6">
             <h2 className="text-xl font-bold text-white mb-4">Informações da Playlist</h2>
            <div className="flex gap-6">
              <div className="flex-1 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Nome da Playlist</label>
                  <input type="text" value={newPlaylist.name} onChange={(e) => setNewPlaylist({ ...newPlaylist, name: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder:text-text-muted focus:ring-2 focus:ring-primary" placeholder="Ex: Summer Hits 2025" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Descrição</label>
                  <textarea rows="2" value={newPlaylist.description} onChange={(e) => setNewPlaylist({ ...newPlaylist, description: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder:text-text-muted focus:ring-2 focus:ring-primary resize-none" placeholder="Descreva sua playlist..."></textarea>
                </div>
              </div>
              <div className="flex flex-col items-center gap-3">
                <label className="block text-xs font-medium text-text-muted">Capa</label>
                <div className="w-32 h-32 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden border-2 border-dashed border-white/20">
                  {coverImageUrl ? (
                    <img src={coverImageUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-5xl text-text-muted">add_photo_alternate</span>
                  )}
                </div>
                <label className="cursor-pointer bg-primary/20 text-primary px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/30 transition-colors w-full text-center">
                  <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
                  {coverImageUrl ? 'Alterar' : 'Carregar'}
                </label>
              </div>
            </div>
          </div>

          {!loading && !error && (
            <>
               <div className="grid grid-cols-2 gap-6 mb-6 items-start"> {/* items-start adicionado aqui */}
                 <div className="liquid-glass rounded-xl p-6 flex flex-col">
                     <h2 className="text-xl font-bold text-white mb-4">Todas as Músicas</h2>
                     <div className="flex gap-2 items-center mb-4 flex-wrap"> 
                       <button
                         onClick={() => setSelectedDayFilter(ALL_DAYS_CODE)}
                         className={`px-3 h-8 rounded font-semibold text-xs transition-all ${selectedDayFilter === ALL_DAYS_CODE ? 'bg-primary text-white' : 'bg-white/10 text-text-muted hover:bg-white/20'}`}
                       >
                         TODOS
                       </button>
                       <div className="h-5 w-px bg-white/20 hidden sm:block"></div> 
                       {WEEK_DAYS.map((day, index) => (
                         <button
                           key={index}
                           onClick={() => setSelectedDayFilter(index)}
                           className={`w-8 h-8 rounded font-semibold text-xs transition-all ${selectedDayFilter === index ? 'bg-primary text-white' : 'bg-white/10 text-text-muted hover:bg-white/20'}`}
                         >
                           {day}
                         </button>
                       ))}
                     </div>
                    <div className="relative mb-4">
                       <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-lg">search</span>
                       <input
                         type="text"
                         placeholder="Buscar no acervo..."
                         value={searchTerm}
                         onChange={(e) => setSearchTerm(e.target.value)}
                         className="w-full bg-white/10 border border-white/20 rounded-lg pl-9 pr-4 py-2 text-white text-sm placeholder:text-text-muted focus:ring-2 focus:ring-primary"
                         disabled={loading}
                       />
                    </div>
                   <div className="flex-1 overflow-y-auto space-y-2 pr-2 -mr-2 max-h-[500px]">
                      {loading && <p className="text-text-muted text-center text-sm">Carregando...</p>}
                      {!loading && filteredAcervo.length === 0 && <p className="text-text-muted text-center text-sm">Nenhuma música encontrada com o filtro atual.</p>}
                      {filteredAcervo.map((track) => (
                         <div
                           key={track.id}
                           onClick={() => addTrack(track)}
                           className="flex items-center gap-3 p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer group"
                         >
                           <div className="w-8 h-8 rounded bg-gradient-to-br from-primary/50 to-red-600/50 flex items-center justify-center flex-shrink-0">
                               <span className="material-symbols-outlined text-white text-base">
                                 {track.is_commercial ? 'campaign' : 'music_note'}
                               </span>
                           </div>
                           <div className="flex-1 min-w-0">
                               <p className="text-white font-medium text-sm truncate">{track.titulo}</p>
                               <p className="text-text-muted text-xs truncate">{track.artista}</p>
                           </div>
                           <span className="text-text-muted text-xs flex-shrink-0 ml-2">
                               {formatDuration(track.end_segundos ? track.end_segundos - track.start_segundos : track.duracao_segundos - track.start_segundos)}
                           </span>
                            <span className="material-symbols-outlined text-primary opacity-0 group-hover:opacity-100 transition-opacity text-lg">add_circle</span>
                         </div>
                       ))}
                    </div>
                 </div>

                 <div className="liquid-glass rounded-xl p-6 flex flex-col">
                   <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white">Músicas da Playlist</h2>
                    <div className="text-text-muted text-sm text-right"> 
                       <span className="font-semibold">{playlistTracks.length}</span> músicas<br/> 
                       <span className="font-semibold">{formatTotalDuration(getTotalDurationSeconds)}</span>
                    </div>
                   </div>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2 -mr-2 max-h-[500px]">
                    {playlistTracks.length === 0 && <p className="text-text-muted text-center text-sm">Arraste ou clique nas músicas à esquerda para adicionar.</p>}
                    {playlistTracks.map((track, index) => {
                       const isClose = checkProximity(index);
                       return (
                           <div
                             key={`${track.id}-${index}`}
                             draggable
                             onDragStart={() => handleDragStart(track, index)}
                             onDragOver={handleDragOver}
                             onDrop={() => handleDrop(index)}
                             className={`flex items-center gap-3 p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-move group relative ${draggedTrack?.originalIndex === index ? 'opacity-30' : ''}`}
                           >
                             {isClose && (
                               <span className="material-symbols-outlined text-yellow-400 text-base absolute -left-1 -top-1" title="Música repetida muito próxima">warning</span>
                             )}
                             <span className="material-symbols-outlined text-text-muted text-lg cursor-grab flex-shrink-0">drag_indicator</span>
                             <span className="text-text-muted font-mono text-sm w-6 text-right flex-shrink-0">{index + 1}</span>
                             <div className="flex-1 min-w-0">
                               <p className="text-white font-semibold text-sm truncate">{track.titulo}</p>
                               <p className="text-text-muted text-xs truncate">{track.artista}</p>
                             </div>
                             <span className="text-text-muted text-xs flex-shrink-0 ml-2">
                               {formatDuration(track.end_segundos ? track.end_segundos - track.start_segundos : track.duracao_segundos - track.start_segundos)}
                             </span>
                             <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                               <button onClick={() => removeTrack(index)} className="p-1 hover:bg-red-500/20 rounded-lg">
                                 <span className="material-symbols-outlined text-red-500 text-base">delete</span>
                               </button>
                             </div>
                           </div>
                         )
                       })}
                   </div>
                   {playlistTracks.length > 0 && (
                       <button onClick={clearPlaylistTracks} disabled={loading} className="mt-4 w-full bg-white/10 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white/20 transition-colors disabled:opacity-50">
                         Limpar Lista
                       </button>
                   )}
                 </div>
               </div>

               <div className="flex justify-end gap-4">
                 <button onClick={() => navigate('/radio/library')} disabled={loading} className=" bg-white/10 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/20 transition-colors disabled:opacity-50">Cancelar</button>
                 <button onClick={savePlaylist} disabled={loading || playlistTracks.length === 0} className=" bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                   {isEditMode ? 'Atualizar Playlist' : 'Salvar Playlist'}
                 </button>
               </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}