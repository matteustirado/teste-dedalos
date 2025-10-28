import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

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
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState(initialFormData)
  const [editingTrack, setEditingTrack] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [trackToDelete, setTrackToDelete] = useState(null)

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
      setError('Falha ao buscar músicas do acervo.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const startPolling = () => {
    if (pollingRef.current) return
    pollingRef.current = setInterval(fetchTracks, 5000)
  }

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  useEffect(() => {
    fetchTracks()
    return () => stopPolling()
  }, [])

  const handleFetchData = async () => {
    if (!youtubeUrl) {
      setError('Por favor, insira uma URL do YouTube.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const response = await axios.post(`${API_URL}/api/tracks/fetch-data`, { url: youtubeUrl })
      setFormData({
        ...initialFormData,
        youtube_id: response.data.youtube_id,
        titulo: response.data.titulo,
        artista: response.data.artista,
        duracao_segundos: response.data.duracao_segundos,
        end_segundos: response.data.duracao_segundos
      })
      setShowForm(true)
      setYoutubeUrl('')
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Erro ao buscar dados do vídeo.'
      setError(errorMsg)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveTrack = async () => {
    if (!formData.titulo || !formData.artista) {
      setError('Título e Artista são obrigatórios.')
      return
    }
    
    if (formData.end_segundos <= formData.start_segundos || formData.end_segundos > formData.duracao_segundos) {
      setError('Os segundos de Início e Fim da música são inválidos.')
      return
    }
    
    setError(null)
    setLoading(true)

    try {
      if (editingTrack) {
        await axios.put(`${API_URL}/api/tracks/${editingTrack.id}`, formData)
      } else {
        await axios.post(`${API_URL}/api/tracks/import`, formData)
      }
      closeForm()
      fetchTracks()
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Erro ao salvar a música.'
      setError(errorMsg)
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
      closeDeleteModal()
    } catch (err) {
      setError("Falha ao excluir a música.")
      closeDeleteModal() 
    }
  }
  
  const handleEditTrack = (track) => {
    setFormData({
      ...track,
      artistas_participantes: Array.isArray(track.artistas_participantes) ? track.artistas_participantes : [],
      dias_semana: Array.isArray(track.dias_semana) && track.dias_semana.length > 0 ? track.dias_semana : [...ALL_DAYS_ARRAY],
      ano: track.ano || '' 
    })
    setEditingTrack(track)
    setShowForm(true)
  }
  
  const closeForm = () => {
    setShowForm(false)
    setFormData(initialFormData)
    setEditingTrack(null)
    setError(null)
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
        if (!isCurrentlyAllSelected) {
          newDays = [...ALL_DAYS_ARRAY];
        }
      } else {
        if (isCurrentlyAllSelected) {
          newDays = [index];
        } else if (newDays.includes(index)) {
          if (newDays.length > 1) {
            newDays = newDays.filter(d => d !== index);
          }
        } else {
          newDays.push(index);
        }
        
        if (newDays.length === 7) {
          newDays = [...ALL_DAYS_ARRAY];
        }
      }
      
      newDays.sort((a,b) => a - b) 
      
      return { ...prev, dias_semana: newDays }
    })
  }

  const formatDuration = (totalSeconds) => {
    if (typeof totalSeconds !== 'number' || totalSeconds < 0) {
      return '0:00'
    }
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = Math.floor(totalSeconds % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const getStatusChip = (status) => {
    switch (status) {
      case 'PROCESSADO':
        return 'bg-green-500/20 text-green-400'
      case 'PENDENTE':
        return 'bg-yellow-500/20 text-yellow-400'
      case 'ERRO':
        return 'bg-red-500/20 text-red-400'
      default:
        return 'bg-gray-500/20 text-gray-400'
    }
  }
  
  const filteredTracks = useMemo(() => {
    if (!searchQuery) return tracks
    const lowerQuery = searchQuery.toLowerCase()
    return tracks.filter(track => 
      track.titulo.toLowerCase().includes(lowerQuery) ||
      (track.artista && track.artista.toLowerCase().includes(lowerQuery))
    )
  }, [tracks, searchQuery])

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

          {error && (
            <div className="bg-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm flex justify-between items-center">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="material-symbols-outlined text-lg">close</button>
            </div>
          )}

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
                  disabled={loading}
                  className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/80 transition-all shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined">search</span>
                  Buscar
                </button>
              </div>
            </div>
          ) : (
            <div className="liquid-glass rounded-xl p-6 mb-6">
              <h2 className="text-xl font-bold text-white mb-4">{editingTrack ? 'Editar Mídia' : 'Configurar Nova Mídia'}</h2>
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
                    <button onClick={closeForm} className="bg-white/10 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/20 transition-colors">Cancelar</button>
                    <button onClick={handleSaveTrack} disabled={loading} className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/80 transition-colors disabled:opacity-50">
                      {editingTrack ? 'Atualizar Mídia' : 'Salvar no Acervo'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="liquid-glass rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Mídias no Acervo ({filteredTracks.length})</h2>
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="Buscar por nome ou artista..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder:text-text-muted focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              {loading && <p className="text-text-muted text-center">Carregando acervo...</p>}
              {!loading && filteredTracks.length === 0 && <p className="text-text-muted text-center">{tracks.length > 0 ? 'Nenhum resultado encontrado.' : 'Nenhuma música encontrada no acervo.'}</p>}

              {filteredTracks.map((track) => {
                const effectiveEnd = track.end_segundos ?? track.duracao_segundos
                const calculatedDuration = effectiveEnd - track.start_segundos
                
                return (
                  <div key={track.id} className="flex items-center p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                    <div className="w-10 h-10 rounded bg-gradient-to-br from-primary to-red-600 flex items-center justify-center mr-4 flex-shrink-0">
                      <span className="material-symbols-outlined text-white text-xl">
                        {track.is_commercial ? 'campaign' : 'music_note'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate">{track.titulo}</p>
                      <p className="text-xs text-text-muted truncate">{track.artista}</p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getStatusChip(track.status_processamento)}`}>
                        {track.status_processamento}
                      </span>
                      <p className="text-sm text-text-muted w-20 text-right font-display">
                        {formatDuration(calculatedDuration)}
                      </p>
                      <button onClick={() => handleEditTrack(track)} className="text-text-muted hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-lg">edit</span>
                      </button>
                      <button onClick={() => openDeleteModal(track)} className="text-text-muted hover:text-red-500 transition-colors">
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
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
            <p className="text-text-muted mb-6">Tem certeza que deseja excluir permanentemente a mídia "{trackToDelete?.titulo}" do acervo?</p>
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