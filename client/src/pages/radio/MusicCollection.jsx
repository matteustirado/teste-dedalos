import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify';

const API_URL = 'http://localhost:4000'
const WEEK_DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const ALL_DAYS_ARRAY = [0, 1, 2, 3, 4, 5, 6]

const initialFormData = {
  youtube_id: '',
  titulo: '',
  artista: '',
  artistas_participantes: [],
  album: '',
  ano: '',
  gravadora: '',
  diretor: '',
  thumbnail_url: '',
  duracao_segundos: 0,
  start_segundos: 0,
  end_segundos: 0,
  is_commercial: false,
  dias_semana: [...ALL_DAYS_ARRAY]
}

export default function MusicCollection() {
  const navigate = useNavigate()
  const [isLive, setIsLive] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState(initialFormData)
  const [editingTrack, setEditingTrack] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [trackToDelete, setTrackToDelete] = useState(null)

  const [typeFilter, setTypeFilter] = useState('TODOS');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  const [selectedTrackIds, setSelectedTrackIds] = useState(new Set());


  const pollingRef = useRef(null)

  const fetchTracks = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/tracks`)
      setTracks(response.data)

      const hasPending = response.data.some(track => track.status_processamento === 'PENDENTE')
      if (hasPending && !pollingRef.current) {
        startPolling()
      } else if (!hasPending && pollingRef.current) {
        stopPolling()
      }
    } catch (err) {
      toast.error('Falha ao buscar músicas do acervo.');
      console.error(err)
    } finally {
      if (loading) setLoading(false)
    }
  }

  const startPolling = () => {
    if (pollingRef.current) return
    console.log('Iniciando polling para status PENDENTE...');
    pollingRef.current = setInterval(fetchTracks, 5000)
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      console.log('Parando polling.');
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchTracks()
    return () => stopPolling()
  }, [])

  const handleFetchData = async () => {
    if (!youtubeUrl) {
      toast.warn('Por favor, insira uma URL do YouTube.');
      return
    }
    setLoading(true)
    try {
      const response = await axios.post(`${API_URL}/api/tracks/fetch-data`, { url: youtubeUrl })
      setFormData({
        ...initialFormData,
        youtube_id: response.data.youtube_id,
        titulo: response.data.titulo,
        artista: response.data.artista,
        duracao_segundos: response.data.duracao_segundos,
        end_segundos: response.data.duracao_segundos,
        thumbnail_url: response.data.thumbnail_url || ''
      })
      setShowForm(true)
      setYoutubeUrl('')
      toast.success('Dados do vídeo carregados!');
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Erro ao buscar dados do vídeo.'
      toast.error(errorMsg);
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveTrack = async () => {
    if (!formData.titulo || !formData.artista) {
      toast.warn('Título e Artista são obrigatórios.');
      return
    }

    if (formData.end_segundos <= formData.start_segundos || formData.end_segundos > formData.duracao_segundos) {
      toast.warn('Os segundos de Início e Fim da música são inválidos.');
      return
    }

    setLoading(true)

    try {
      let responseMessage = '';
      if (editingTrack) {
        await axios.put(`${API_URL}/api/tracks/${editingTrack.id}`, formData)
        responseMessage = 'Mídia atualizada com sucesso!';
      } else {
        const response = await axios.post(`${API_URL}/api/tracks/import`, formData)
        responseMessage = response.data.message || 'Mídia adicionada com sucesso!';
      }
      toast.success(responseMessage);
      closeForm()
      fetchTracks()
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Erro ao salvar a música.'
      toast.error(errorMsg);
    } finally {
      setLoading(false)
    }
  }

  const openDeleteModal = (track) => {
    setTrackToDelete(track)
    setShowDeleteModal(true)
  }

  const closeDeleteModal = () => {
    setTrackToDelete(null)
    setShowDeleteModal(false)
  }

  const confirmDeleteTrack = async () => {
    if (!trackToDelete) return
    try {
      await axios.delete(`${API_URL}/api/tracks/${trackToDelete.id}`)
      setTracks(tracks.filter(t => t.id !== trackToDelete.id))
      toast.success(`"${trackToDelete.titulo}" excluída com sucesso!`);
      closeDeleteModal()
    } catch (err) {
      toast.error("Falha ao excluir a música.");
      closeDeleteModal()
    }
  }

  const handleEditTrack = (track) => {
    setFormData({
      ...track,
      artistas_participantes: Array.isArray(track.artistas_participantes) ? track.artistas_participantes : [],
      dias_semana: Array.isArray(track.dias_semana) && track.dias_semana.length > 0 ? track.dias_semana : [...ALL_DAYS_ARRAY],
      ano: track.ano || '',
      thumbnail_url: track.thumbnail_url || ''
    })
    setEditingTrack(track)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setFormData(initialFormData)
    setEditingTrack(null)
  }

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleDayToggle = (index) => {
    setFormData(prev => {
      let currentDays = prev.dias_semana || [];
      let newDays = [...currentDays];
      const isCurrentlyAllSelected = currentDays.length === 7;

      if (index === 'TODOS') {
        if (!isCurrentlyAllSelected) { newDays = [...ALL_DAYS_ARRAY]; }
      } else {
        if (isCurrentlyAllSelected) { newDays = [index]; }
        else if (newDays.includes(index)) { if (newDays.length > 1) { newDays = newDays.filter(d => d !== index); } }
        else { newDays.push(index); }
        if (newDays.length === 7) { newDays = [...ALL_DAYS_ARRAY]; }
      }
      newDays.sort((a,b) => a - b)
      return { ...prev, dias_semana: newDays }
    })
  }

  const formatDuration = (totalSeconds) => {
    if (typeof totalSeconds !== 'number' || totalSeconds < 0) { return '0:00' }
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = Math.floor(totalSeconds % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const getStatusChip = (status) => {
    switch (status) {
      case 'PROCESSADO': return 'bg-green-500/20 text-green-400'
      case 'PENDENTE': return 'bg-yellow-500/20 text-yellow-400'
      case 'ERRO': return 'bg-red-500/20 text-red-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  const filteredAndSortedTracks = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase()

    const filtered = tracks.filter(track => {
      const searchMatch = searchQuery === '' ||
        track.titulo.toLowerCase().includes(lowerQuery) ||
        (track.artista && track.artista.toLowerCase().includes(lowerQuery));
      if (!searchMatch) return false;

      const typeMatch = typeFilter === 'TODOS' ||
        (typeFilter === 'Música' && !track.is_commercial) ||
        (typeFilter === 'Comercial' && track.is_commercial);
      if (!typeMatch) return false;

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
        let valA = a[sortBy];
        let valB = b[sortBy];

        if (sortBy === 'duration') {
             const endA = a.end_segundos ?? a.duracao_segundos;
             const startA = a.start_segundos ?? 0;
             valA = (endA > startA) ? (endA - startA) : 0;
             const endB = b.end_segundos ?? b.duracao_segundos;
             const startB = b.start_segundos ?? 0;
             valB = (endB > startB) ? (endB - startB) : 0;
        }

        let comparison = 0;
        if (valA === null || valA === undefined) valA = '';
        if (valB === null || valB === undefined) valB = '';

        if (typeof valA === 'string' && typeof valB === 'string') {
            comparison = valA.localeCompare(valB, 'pt-BR', { sensitivity: 'base' });
        } else if (typeof valA === 'number' && typeof valB === 'number') {
            comparison = valA - valB;
        } else if (valA instanceof Date && valB instanceof Date) {
            comparison = valA - valB;
        } else {
             comparison = String(valA).localeCompare(String(valB), 'pt-BR', { sensitivity: 'base' });
        }

        return sortOrder === 'asc' ? comparison : comparison * -1;
    });

    return sorted;

  }, [tracks, searchQuery, typeFilter, sortBy, sortOrder]) 

  const handleToggleSelect = (trackId) => {
      setSelectedTrackIds(prevSelectedIds => {
          const newSet = new Set(prevSelectedIds);
          if (newSet.has(trackId)) {
              newSet.delete(trackId);
          } else {
              newSet.add(trackId);
          }
          return newSet;
      });
  };

  const areAllFilteredSelected = useMemo(() => {
      if (filteredAndSortedTracks.length === 0) return false;
      return filteredAndSortedTracks.every(track => selectedTrackIds.has(track.id));
  }, [filteredAndSortedTracks, selectedTrackIds]);


  const handleToggleSelectAll = () => {
      if (areAllFilteredSelected) {
          setSelectedTrackIds(prevSelectedIds => {
              const newSet = new Set(prevSelectedIds);
              filteredAndSortedTracks.forEach(track => newSet.delete(track.id));
              return newSet;
          });
      } else {
          setSelectedTrackIds(prevSelectedIds => {
              const newSet = new Set(prevSelectedIds);
              filteredAndSortedTracks.forEach(track => newSet.add(track.id));
              return newSet;
          });
      }
  };

  const handleDeleteSelected = async () => {
      if (selectedTrackIds.size === 0) {
          toast.warn("Nenhuma mídia selecionada.");
          return;
      }
      
      if (window.confirm(`Tem certeza que deseja excluir ${selectedTrackIds.size} mídias selecionadas? Esta ação não pode ser desfeita.`)) {
          setLoading(true);
          const idsToDelete = Array.from(selectedTrackIds);
          try {
              const response = await axios.delete(`${API_URL}/api/tracks/batch`, {
                  data: { ids: idsToDelete }
              });
              toast.success(response.data.message || `${idsToDelete.length} mídias excluídas.`);
              setSelectedTrackIds(new Set());
              fetchTracks();
          } catch (err) {
              console.error("Erro ao excluir mídias em lote:", err);
              toast.error(err.response?.data?.error || "Falha ao excluir mídias selecionadas.");
          } finally {
              setLoading(false);
          }
      }
  };

  const allDaysSelected = formData.dias_semana.length === 7;

  return (
    <div className="min-h-screen bg-gradient-warm flex">
      <aside className="fixed left-0 top-0 h-screen w-64 bg-bg-dark-primary/50 backdrop-blur-sm border-r border-white/10 p-4 flex flex-col justify-between z-10">
        <div className="flex flex-col gap-8">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-red-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-2xl">music_video</span>
                </div>
                <div className="flex flex-col">
                <h1 className="text-white text-lg font-bold leading-tight">Acervo</h1>
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
                <button onClick={() => navigate('/radio/collection')} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/20 text-primary border border-primary/50">
                <span className="material-symbols-outlined">music_video</span>
                <p className="text-base font-semibold">Acervo de Músicas</p>
                </button>
                <button onClick={() => navigate('/radio/playlist-creator')} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined">playlist_add</span>
                <p className="text-base font-medium">Criar Playlist</p>
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

      <main className="ml-64 flex-1 p-8">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">Acervo de Músicas</h1>
              <p className="text-text-muted text-sm">Gerencie todas as músicas e comerciais da rádio</p>
            </div>
          </div>

          {!showForm ? (
             <div className="liquid-glass rounded-xl p-6 mb-6">
              <h2 className="text-xl font-bold text-white mb-4">Adicionar Nova Mídia</h2>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder:text-text-muted focus:ring-2 focus:ring-primary"
                  placeholder="Cole o link do YouTube aqui..."
                />
                <button
                  onClick={handleFetchData}
                  disabled={loading && !tracks.length}
                  className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/80 transition-all shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading && !tracks.length ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                   ) : (
                        <span className="material-symbols-outlined">search</span>
                   )}
                  Buscar
                </button>
              </div>
            </div>
          ) : (
            <div className="liquid-glass rounded-xl p-6 mb-6">
              <h2 className="text-xl font-bold text-white mb-4">{editingTrack ? 'Editar Mídia' : 'Configurar Nova Mídia'}</h2>
              <div className="flex gap-6 mb-6 border-b border-white/10 pb-6">
                  {formData.thumbnail_url ? (
                      <img
                          src={formData.thumbnail_url}
                          alt="Thumbnail"
                          className="w-32 h-32 object-cover rounded-lg flex-shrink-0 border border-white/10"
                      />
                  ) : (
                       <div className="w-32 h-32 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 border border-white/10">
                            <span className="material-symbols-outlined text-5xl text-text-muted">music_video</span>
                       </div>
                  )}
                  <div className="flex-1 min-w-0">
                     <h3 className="text-lg font-semibold text-white truncate">{formData.titulo || 'Novo Título...'}</h3>
                     <p className="text-sm text-text-muted truncate">{formData.artista || 'Novo Artista...'}</p>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-text-muted mb-1">Nome da Música</label>
                  <input type="text" name="titulo" value={formData.titulo} onChange={handleFormChange} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white" />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-text-muted mb-1">Artista ou Banda</label>
                  <input type="text" name="artista" value={formData.artista} onChange={handleFormChange} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white" />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-text-muted mb-1">Artistas Participantes</label>
                  <input type="text" name="artistas_participantes" placeholder="(Opcional, separados por vírgula)" value={formData.artistas_participantes.join(', ')} onChange={(e) => setFormData(p => ({...p, artistas_participantes: e.target.value.split(',').map(s => s.trim()).filter(Boolean)}))} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder:text-text-muted/50" />
                </div>
                <div className="col-span-1 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">Álbum</label>
                    <input type="text" name="album" placeholder="(Opcional)" value={formData.album || ''} onChange={handleFormChange} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder:text-text-muted/50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">Ano</label>
                    <input type="number" name="ano" placeholder="(Opcional)" value={formData.ano || ''} onChange={handleFormChange} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder:text-text-muted/50" />
                  </div>
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-text-muted mb-1">Gravadora</label>
                  <input type="text" name="gravadora" placeholder="(Opcional)" value={formData.gravadora || ''} onChange={handleFormChange} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder:text-text-muted/50" />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-text-muted mb-1">Diretor</label>
                  <input type="text" name="diretor" placeholder="(Opcional)" value={formData.diretor || ''} onChange={handleFormChange} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder:text-text-muted/50" />
                </div>
                <div className="col-span-1 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">Início (segundos)</label>
                    <input type="number" name="start_segundos" min="0" max={formData.duracao_segundos} value={formData.start_segundos} onChange={handleFormChange} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">Fim (segundos)</label>
                    <input type="number" name="end_segundos" min="0" max={formData.duracao_segundos} value={formData.end_segundos} onChange={handleFormChange} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white" />
                  </div>
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-text-muted mb-1">Dias Disponíveis</label>
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => handleDayToggle('TODOS')}
                      className={`px-4 h-10 rounded-lg font-semibold transition-all ${allDaysSelected ? 'bg-primary text-white' : 'bg-white/10 text-text-muted hover:bg-white/20'}`}
                    >
                      TODOS
                    </button>
                    <div className="h-6 w-px bg-white/20"></div>
                    {WEEK_DAYS.map((day, index) => (
                      <button
                        key={index}
                        onClick={() => handleDayToggle(index)}
                        className={`w-10 h-10 rounded-full font-semibold transition-all ${!allDaysSelected && formData.dias_semana.includes(index) ? 'bg-primary text-white' : 'bg-white/10 text-text-muted hover:bg-white/20'}`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2 flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                   <div className="flex items-center gap-2">
                    <input type="checkbox" name="is_commercial" checked={formData.is_commercial} onChange={handleFormChange} id="is_commercial" className="w-4 h-4 rounded bg-white/20 border-white/30 text-primary focus:ring-primary" />
                    <label htmlFor="is_commercial" className="text-sm font-medium text-white">É um comercial?</label>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={closeForm} disabled={loading} className="bg-white/10 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/20 transition-colors disabled:opacity-50">Cancelar</button>
                    <button onClick={handleSaveTrack} disabled={loading} className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/80 transition-colors disabled:opacity-50">
                        {loading ? (
                            <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                {editingTrack ? 'Atualizando...' : 'Salvando...'}
                            </div>
                        ) : (
                            editingTrack ? 'Atualizar Mídia' : 'Salvar no Acervo'
                        )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="liquid-glass rounded-xl p-6">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
              <h2 className="text-xl font-bold text-white whitespace-nowrap">Mídias no Acervo ({filteredAndSortedTracks.length})</h2>
              <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
                   <div className="relative">
                      <select
                          value={typeFilter}
                          onChange={(e) => setTypeFilter(e.target.value)}
                          className="appearance-none bg-white/10 border border-white/20 rounded-lg pl-3 pr-8 py-1.5 text-white text-xs focus:ring-1 focus:ring-primary cursor-pointer"
                      >
                          <option className="bg-bg-dark-primary text-white" value="TODOS">Tipo: Todos</option>
                          <option className="bg-bg-dark-primary text-white" value="Música">Tipo: Música</option>
                          <option className="bg-bg-dark-primary text-white" value="Comercial">Tipo: Comercial</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none text-base">expand_more</span>
                  </div>
                  {/* 1. Filtro de Status Removido */}
                  {/* <div className="relative"> ... </div> */}
                   <div className="relative">
                      <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          className="appearance-none bg-white/10 border border-white/20 rounded-lg pl-3 pr-8 py-1.5 text-white text-xs focus:ring-1 focus:ring-primary cursor-pointer"
                      >
                          <option className="bg-bg-dark-primary text-white" value="created_at">Ordenar por: Data</option>
                          <option className="bg-bg-dark-primary text-white" value="titulo">Ordenar por: Título</option>
                          <option className="bg-bg-dark-primary text-white" value="artista">Ordenar por: Artista</option>
                          <option className="bg-bg-dark-primary text-white" value="duration">Ordenar por: Duração</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none text-base">expand_more</span>
                  </div>
                  <button
                      onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                      className="p-1.5 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors h-[31px] w-[31px] flex items-center justify-center" // Ajustado height/width
                      title={sortOrder === 'asc' ? "Ordem Crescente" : "Ordem Decrescente"}
                  >
                       <span className="material-symbols-outlined text-sm leading-none"> 
                          {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                       </span>
                  </button>
                   {selectedTrackIds.size > 0 && (
                      <button
                          onClick={handleDeleteSelected}
                          disabled={loading}
                          className="flex items-center gap-1.5 bg-red-600/20 text-red-400 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          <span className="material-symbols-outlined text-base leading-none">delete</span>
                          Excluir ({selectedTrackIds.size})
                      </button>
                   )}
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-48 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-xs placeholder:text-text-muted focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex items-center p-3 rounded-lg bg-white/5 mb-2">
                <div className="w-6 mr-3 flex-shrink-0">
                     <input
                        type="checkbox"
                        checked={areAllFilteredSelected}
                        onChange={handleToggleSelectAll}
                        disabled={filteredAndSortedTracks.length === 0}
                        title={areAllFilteredSelected ? "Desselecionar Todos Visíveis" : "Selecionar Todos Visíveis"}
                        className="w-4 h-4 rounded bg-white/20 border-white/30 text-primary focus:ring-primary"
                    />
                </div>
                <div className="w-10 mr-4 flex-shrink-0">
                    <span className="text-xs font-semibold text-text-muted"></span>
                </div>
                <div className="flex-1 min-w-0">
                     <span className="text-xs font-semibold text-text-muted">TÍTULO / ARTISTA</span>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                    <span className="text-xs font-semibold text-text-muted px-2 text-center">STATUS</span>
                    <span className="text-xs font-semibold text-text-muted w-20 text-right">DURAÇÃO</span>
                    <span className="text-xs font-semibold text-text-muted w-[52px] text-right">AÇÕES</span>
                </div>
            </div>


            <div className="space-y-2">
              {loading && tracks.length === 0 && (
                  <div className="text-center text-text-muted p-6">
                      <div className="flex justify-center items-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                          <span className="ml-3">Carregando acervo...</span>
                      </div>
                  </div>
              )}
              {!loading && filteredAndSortedTracks.length === 0 && (
                <p className="text-text-muted text-center py-4">{tracks.length > 0 ? 'Nenhum resultado encontrado com os filtros atuais.' : 'Nenhuma música encontrada no acervo.'}</p>
              )}

              {filteredAndSortedTracks.map((track) => {
                const effectiveEnd = track.end_segundos ?? track.duracao_segundos
                const calculatedDuration = effectiveEnd - track.start_segundos
                const isSelected = selectedTrackIds.has(track.id);

                return (
                  <div
                    key={track.id}
                    className={`flex items-center p-3 rounded-lg ${isSelected ? 'bg-primary/20' : 'bg-white/5 hover:bg-white/10'} transition-colors`}
                  >
                    <div className="w-6 mr-3 flex-shrink-0">
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(track.id)}
                            className="w-4 h-4 rounded bg-white/20 border-white/30 text-primary focus:ring-primary"
                        />
                    </div>

                    {track.thumbnail_url ? (
                        <img
                            src={track.thumbnail_url}
                            alt="Thumbnail"
                            className="w-10 h-10 object-cover rounded mr-4 flex-shrink-0 border border-white/10"
                            loading="lazy"
                        />
                    ) : (
                         <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center mr-4 flex-shrink-0 border border-white/10">
                             <span className="material-symbols-outlined text-xl text-text-muted">
                                {track.is_commercial ? 'campaign' : 'music_note'}
                             </span>
                         </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate">{track.titulo}</p>
                      <p className="text-xs text-text-muted truncate">{track.artista}</p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-center ${getStatusChip(track.status_processamento)}`}>
                        {track.status_processamento}
                      </span>
                      <p className="text-sm text-text-muted w-20 text-right font-display">{formatDuration(calculatedDuration)}</p>
                       <div className="flex justify-end gap-1 w-[52px]">
                           <button onClick={() => handleEditTrack(track)} className="text-text-muted hover:text-primary transition-colors">
                               <span className="material-symbols-outlined text-lg">edit</span>
                           </button>
                           <button onClick={() => openDeleteModal(track)} className="text-text-muted hover:text-red-500 transition-colors">
                               <span className="material-symbols-outlined text-lg">delete</span>
                           </button>
                       </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </main>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="liquid-glass rounded-xl p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Confirmar Exclusão</h3>
            <p className="text-text-muted mb-6">Tem certeza que deseja excluir permanentemente a mídia "{trackToDelete?.titulo}"?</p>
            <div className="flex justify-end gap-4">
              <button onClick={closeDeleteModal} className="bg-white/10 text-white px-6 py-2 rounded-lg font-semibold hover:bg-white/20 transition-colors">
                Cancelar
              </button>
              <button onClick={confirmDeleteTrack} className="bg-red-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}