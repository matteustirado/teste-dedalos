import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify';
import Sidebar from '../../components/Sidebar';

const API_URL = 'http://localhost:4000'
const WEEK_DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const ALL_DAYS_CODE = -1
const DURATION_WARNING_SECONDS = 24 * 3600;

export default function PlaylistCreator() {
  const navigate = useNavigate()
  const { playlistId } = useParams();
  const isEditMode = Boolean(playlistId);

  // --- ESTADOS GERAIS ---
  const [searchTerm, setSearchTerm] = useState('')
  const [newPlaylist, setNewPlaylist] = useState({
    name: '',
    description: '',
    cover: null,
    coverFile: null
  })
  const [originalCover, setOriginalCover] = useState(null);
  
  const [acervoTracks, setAcervoTracks] = useState([])
  const [playlistTracks, setPlaylistTracks] = useState([])
  const [allTracksForLookup, setAllTracksForLookup] = useState([])
  const [draggedTrack, setDraggedTrack] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedDayFilter, setSelectedDayFilter] = useState(ALL_DAYS_CODE)

  // --- ESTADO DO FILTRO DA PLAYLIST ---
  const [playlistFilter, setPlaylistFilter] = useState('');

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
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
          setOriginalCover(playlistData.imagem || null);

          const trackIdsInPlaylist = playlistData.tracks_ids || [];

          const tracksForPlaylist = trackIdsInPlaylist
            .map(id => processedTracks.find(track => track.id === Number(id)))
            .filter(Boolean);
          setPlaylistTracks(tracksForPlaylist);
        } else {
           setNewPlaylist({ name: '', description: '', cover: null, coverFile: null });
           setOriginalCover(null);
           setPlaylistTracks([]);
        }

      } catch (err) {
        console.error("Erro ao buscar dados iniciais:", err);
        const errorMsg = isEditMode ? "Não foi possível carregar a playlist para edição." : "Não foi possível carregar as músicas do acervo.";
        toast.error(errorMsg);
        if (isEditMode && err.response?.status === 404) {
           toast.error("Playlist não encontrada.");
           navigate('/radio/playlist-creator');
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
        toast.warn("A imagem da capa não pode exceder 2MB.");
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      setNewPlaylist(prev => ({ ...prev, cover: previewUrl, coverFile: file }));
       e.target.value = null;
    }
  }

  const addTrack = (track) => {
    const recentTracks = playlistTracks.slice(-5);
    const isRecentDuplicate = recentTracks.some(t => t.id === track.id);
    if (isRecentDuplicate) {
        toast.info(`"${track.titulo}" foi adicionada recentemente.`);
    }
    setPlaylistTracks([...playlistTracks, track])
  }

  const removeTrack = (indexToRemove) => {
    setPlaylistTracks(playlistTracks.filter((_, index) => index !== indexToRemove))
  }

  const handleShuffle = () => {
    if (playlistTracks.length < 2) return;
    setPlaylistTracks(prevTracks => {
        const newArr = [...prevTracks];
        for (let i = newArr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
        }
        return newArr;
    });
    toast.success("Ordem da playlist embaralhada!");
  };

  const handleDragStart = (track, index) => { setDraggedTrack({ ...track, originalIndex: index }) }
  const handleDragOver = (e) => { e.preventDefault() }
  
  const handleDrop = (targetIndex) => {
    if (playlistFilter) {
        toast.warn("Limpe o filtro para reordenar músicas.");
        return;
    }
    if (!draggedTrack || draggedTrack.originalIndex === targetIndex) { setDraggedTrack(null); return; }

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
    
    let result = '';
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}m `;
    if (result === '') result = '0m';
    return result.trim();
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

 const savePlaylist = async (exitOnSave = true) => {
    if (!newPlaylist.name || playlistTracks.length === 0) {
      toast.warn("A playlist precisa de um nome e pelo menos uma música.");
      return
    }
    setLoading(true);
    const formData = new FormData();
    formData.append('name', newPlaylist.name);
    formData.append('description', newPlaylist.description);
    formData.append('tracks_ids', JSON.stringify(playlistTracks.map(t => t.id)));
    if (newPlaylist.coverFile) { formData.append('cover', newPlaylist.coverFile); }
     if (isEditMode) {
       if ((newPlaylist.cover === null || newPlaylist.cover?.startsWith('blob:')) && originalCover) { formData.append('existingImagePath', originalCover); }
       else if (typeof newPlaylist.cover === 'string' && !newPlaylist.cover.startsWith('blob:') && newPlaylist.cover === originalCover) { formData.append('existingImagePath', newPlaylist.cover); }
       else if (newPlaylist.cover === null && !originalCover) { formData.append('existingImagePath', ''); }
     }
    try {
      const config = { headers: { 'Content-Type': 'multipart/form-data' } };
      
      let newId = playlistId;
      let newCoverUrl = null;
      if (isEditMode) {
        const response = await axios.put(`${API_URL}/api/playlists/${playlistId}`, formData, config);
        newCoverUrl = response.data.imagePath;
        toast.success("Playlist atualizada com sucesso!");
      } else {
        const response = await axios.post(`${API_URL}/api/playlists`, formData, config);
        newId = response.data.id;
        newCoverUrl = response.data.imagePath;
        toast.success("Playlist salva com sucesso!");
      }
      if (exitOnSave) { navigate('/radio/library'); }
      else if (!isEditMode && newId) {
        navigate(`/radio/playlist-creator/${newId}`, { replace: true });
        setOriginalCover(newCoverUrl || null);
        setNewPlaylist(prev => ({...prev, cover: newCoverUrl || null, coverFile: null}));
      } else if (isEditMode) {
        setOriginalCover(newCoverUrl || null);
        setNewPlaylist(prev => ({...prev, cover: newCoverUrl || null, coverFile: null}));
      }
    } catch (err) {
      console.error("Erro ao salvar/atualizar playlist", err);
       const errorMsg = err.response?.data?.error || (isEditMode ? "Falha ao atualizar a playlist." : "Falha ao salvar a playlist.");
      toast.error(errorMsg);
    } finally { setLoading(false); }
  }

  const clearPlaylistTracks = () => { setPlaylistTracks([]) }
  
  const checkProximity = (index) => {
     if (playlistTracks.length < 2) return false;
     const currentId = playlistTracks[index].id;
     const startIndex = Math.max(0, index - 5);
     for (let i = startIndex; i < index; i++) { if (playlistTracks[i].id === currentId) { return true; } }
     return false;
  }

  const filteredAcervo = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    const dayFilterValue = selectedDayFilter === ALL_DAYS_CODE ? null : selectedDayFilter;
    return allTracksForLookup.filter(track => {
      let dayMatch = dayFilterValue === null || (Array.isArray(track.dias_semana) && track.dias_semana.includes(dayFilterValue));
      if (!dayMatch) { return false; }
      if (!searchTerm) { return true; }
      const titleMatch = track.titulo.toLowerCase().includes(lowerSearchTerm);
      const artistMatch = track.artista && track.artista.toLowerCase().includes(lowerSearchTerm);
      return titleMatch || artistMatch;
    });
  }, [allTracksForLookup, selectedDayFilter, searchTerm]);

  const filteredPlaylistTracks = useMemo(() => {
      const tracksWithIndex = playlistTracks.map((t, i) => ({ ...t, _origIndex: i }));
      if (!playlistFilter) return tracksWithIndex;
      const lower = playlistFilter.toLowerCase();
      return tracksWithIndex.filter(track => 
          track.titulo.toLowerCase().includes(lower) || 
          (track.artista && track.artista.toLowerCase().includes(lower))
      );
  }, [playlistTracks, playlistFilter]);
   
   const getCoverImageUrl = () => {
     if (newPlaylist.coverFile && newPlaylist.cover?.startsWith('blob:')) { return newPlaylist.cover; }
     if (!newPlaylist.coverFile && typeof newPlaylist.cover === 'string' && newPlaylist.cover) { return `${API_URL}${newPlaylist.cover}`; }
     return null;
   };
   const coverImageUrl = getCoverImageUrl();


  return (
    <div className="min-h-screen bg-gradient-warm flex">
      <Sidebar 
        activePage="playlist-creator" 
        headerTitle={isEditMode ? 'Editar Playlist' : 'Criar Playlist'} 
        headerIcon="playlist_add" 
        isEditMode={isEditMode}
      />

      <main className="ml-64 flex-1 p-8">
        <div className="max-w-7xl mx-auto w-full">
          {isEditMode && (
             <button
               onClick={() => navigate('/radio/playlist-creator')}
               className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 mb-4"
             >
               <span className="material-symbols-outlined text-lg">arrow_back_ios_new</span>
               Voltar para Criação de Playlists
             </button>
          )}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-1">{isEditMode ? 'Editar Playlist' : 'Nova Playlist'}</h1>
            <p className="text-text-muted text-sm">{isEditMode ? 'Modifique os detalhes da sua playlist' : 'Crie sua playlist personalizada'}</p>
          </div>

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
                <div className="w-32 h-32 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden border-2 border-dashed border-white/20 relative">
                  {coverImageUrl ? (
                    <img src={coverImageUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-5xl text-text-muted">add_photo_alternate</span>
                  )}
                  {coverImageUrl && (
                       <button
                         onClick={() => setNewPlaylist(prev => ({...prev, cover: null, coverFile: null}))}
                         className="absolute top-1 right-1 z-10 p-0.5 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
                         title="Remover Imagem"
                       >
                         <span className="material-symbols-outlined text-base">close</span>
                       </button>
                  )}
                </div>
                <label className="cursor-pointer bg-primary/20 text-primary px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/30 transition-colors w-full text-center">
                  <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
                  {coverImageUrl ? 'Alterar' : 'Carregar'}
                </label>
              </div>
            </div>
          </div>

          {!loading && (
            <>
               <div className="grid grid-cols-2 gap-6 mb-6 items-start">
                 
                 {/* COLUNA ESQUERDA: ACERVO */}
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
                         className="w-full h-10 bg-white/10 border border-white/20 rounded-lg pl-9 pr-4 text-white text-sm placeholder:text-text-muted focus:ring-2 focus:ring-primary flex items-center"
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
                           {track.thumbnail_url ? (
                                <img src={track.thumbnail_url} alt="Thumbnail" className="w-8 h-8 rounded object-cover flex-shrink-0 border border-white/10" loading="lazy" />
                           ) : (
                               <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center flex-shrink-0 border border-white/10">
                                    <span className="material-symbols-outlined text-text-muted text-base">
                                      {track.is_commercial ? 'campaign' : 'music_note'}
                                    </span>
                               </div>
                           )}
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

                 {/* COLUNA DIREITA: PLAYLIST ATUAL */}
                 <div className="liquid-glass rounded-xl p-6 flex flex-col">
                   
                   {/* LINHA 1: Título e Estatísticas */}
                   <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-white">Músicas da Playlist</h2>
                        <div className={`text-sm ${getTotalDurationSeconds > DURATION_WARNING_SECONDS ? 'text-yellow-400' : 'text-text-muted'}`}>
                            <span className="font-semibold">{playlistTracks.length}</span> músicas • <span className="font-semibold">{formatTotalDuration(getTotalDurationSeconds)}</span>
                            {getTotalDurationSeconds > DURATION_WARNING_SECONDS && (
                                <span className="material-symbols-outlined text-base align-middle ml-1" title="Duração da playlist excede 24 horas!">warning</span>
                            )}
                        </div>
                   </div>

                   {/* LINHA 2: Botões de Ação (ALINHADO COM A ESQUERDA: mb-4) */}
                   <div className="flex justify-between items-center mb-4">
                        <button 
                            onClick={handleShuffle}
                            className="h-8 px-3 rounded font-semibold text-xs bg-white/5 hover:bg-primary/20 text-text-muted hover:text-primary transition-all border border-white/10 flex items-center gap-2"
                            title="Embaralhar Músicas"
                        >
                            <span className="material-symbols-outlined text-base">shuffle</span>
                            SHUFFLE
                        </button>

                        {playlistTracks.length > 0 && (
                            <button 
                                onClick={clearPlaylistTracks} 
                                disabled={loading || playlistFilter}
                                className="h-8 px-3 rounded font-semibold text-xs bg-white/5 hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-all border border-white/10 disabled:opacity-50"
                            >
                                LIMPAR
                            </button>
                        )}
                   </div>

                   {/* LINHA 3: Campo de Busca da Playlist (Padronizado h-10) */}
                   <div className="relative mb-4">
                       <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-lg">search</span>
                       <input
                           type="text"
                           placeholder="Filtrar na playlist..."
                           value={playlistFilter}
                           onChange={(e) => setPlaylistFilter(e.target.value)}
                           className="w-full h-10 bg-white/10 border border-white/20 rounded-lg pl-9 pr-8 text-white text-sm placeholder:text-text-muted focus:ring-2 focus:ring-primary flex items-center"
                       />
                       {playlistFilter && (
                           <button 
                               onClick={() => setPlaylistFilter('')}
                               className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
                           >
                               <span className="material-symbols-outlined text-sm">close</span>
                           </button>
                       )}
                   </div>

                   {/* LISTA DE MÚSICAS */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2 -mr-2 max-h-[500px]">
                    {playlistTracks.length === 0 && <p className="text-text-muted text-center text-sm">Arraste ou clique nas músicas à esquerda para adicionar.</p>}
                    
                    {playlistTracks.length > 0 && filteredPlaylistTracks.length === 0 && (
                        <p className="text-text-muted text-center text-sm py-4">Nenhuma música encontrada com este filtro.</p>
                    )}

                    {filteredPlaylistTracks.map((track, index) => {
                       const originalIndex = track._origIndex; 
                       const isClose = checkProximity(originalIndex);
                       
                       return (
                           <div
                             key={`${track.id}-${originalIndex}`}
                             draggable={!playlistFilter}
                             onDragStart={() => !playlistFilter && handleDragStart(track, originalIndex)}
                             onDragOver={handleDragOver}
                             onDrop={() => !playlistFilter && handleDrop(originalIndex)}
                             className={`flex items-center gap-3 p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group relative 
                                ${draggedTrack?.originalIndex === originalIndex ? 'opacity-30' : ''}
                                ${!playlistFilter ? 'cursor-move' : ''}
                             `}
                           >
                             {isClose && (
                               <span className="material-symbols-outlined text-yellow-400 text-base absolute -left-1 -top-1" title="Música tocada nas últimas 5 faixas">warning</span>
                             )}
                             
                             {!playlistFilter ? (
                                <span className="material-symbols-outlined text-text-muted text-lg cursor-grab flex-shrink-0">drag_indicator</span>
                             ) : (
                                <span className="text-text-muted text-xs w-4 text-center">•</span>
                             )}

                             {track.thumbnail_url ? (
                                  <img src={track.thumbnail_url} alt="Thumbnail" className="w-8 h-8 rounded object-cover flex-shrink-0 border border-white/10" loading="lazy" />
                             ) : (
                                  <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center flex-shrink-0 border border-white/10">
                                       <span className="material-symbols-outlined text-text-muted text-base">
                                         {track.is_commercial ? 'campaign' : 'music_note'}
                                       </span>
                                  </div>
                             )}
                             
                             <span className="text-text-muted font-mono text-sm w-6 text-right flex-shrink-0">
                                 {playlistFilter ? '' : originalIndex + 1}
                             </span>

                             <div className="flex-1 min-w-0">
                               <p className="text-white font-semibold text-sm truncate">{track.titulo}</p>
                               <p className="text-text-muted text-xs truncate">{track.artista}</p>
                             </div>
                             
                             <span className="text-text-muted text-xs flex-shrink-0 ml-2">
                               {formatDuration(track.end_segundos ? track.end_segundos - track.start_segundos : track.duracao_segundos - track.start_segundos)}
                             </span>
                             
                             <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                               <button 
                                    onClick={() => removeTrack(originalIndex)}
                                    className="p-1 hover:bg-red-500/20 rounded-lg"
                                    title="Remover da Playlist"
                               >
                                 <span className="material-symbols-outlined text-red-500 text-base">delete</span>
                               </button>
                             </div>
                           </div>
                         )
                       })}
                   </div>
                 </div>
               </div>

               <div className="flex justify-end gap-4">
                 <button onClick={() => navigate('/radio/library')} disabled={loading} className=" bg-white/10 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/20 transition-colors disabled:opacity-50">Cancelar</button>
                 <button onClick={() => savePlaylist(false)} disabled={loading || playlistTracks.length === 0} className=" bg-primary/70 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                   {loading ? 'Salvando...' : (isEditMode ? 'Atualizar' : 'Salvar')}
                 </button>
                 <button onClick={() => savePlaylist(true)} disabled={loading || playlistTracks.length === 0} className=" bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                   {loading ? 'Salvando...' : (isEditMode ? 'Atualizar e Sair' : 'Salvar e Sair')}
                 </button>
               </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}