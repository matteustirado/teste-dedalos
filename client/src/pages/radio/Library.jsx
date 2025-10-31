import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify';

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

export default function Library() {
  const navigate = useNavigate()
  const [playlists, setPlaylists] = useState([])
  const [allTracks, setAllTracks] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState(null);


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
        console.error("Erro ao buscar dados da biblioteca", err);
        toast.error("Não foi possível carregar os dados da biblioteca.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);


  const getPlaylistDetails = (playlist) => {
     if (!allTracks || allTracks.length === 0) {
      return { count: 0, duration: '0m' };
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
      toast.success(`Playlist "${playlistToDelete.nome}" excluída com sucesso!`);
      closeDeletePlaylistModal();
    } catch (err) {
      console.error("Erro ao excluir playlist", err);
      toast.error(`Falha ao excluir a playlist "${playlistToDelete.nome}".`);
      closeDeletePlaylistModal();
    }
  };


  return (
    <div className="min-h-screen bg-gradient-warm flex">
      <aside className="fixed left-0 top-0 h-screen w-64 bg-bg-dark-primary/50 backdrop-blur-sm border-r border-white/10 p-4 flex flex-col justify-between z-10">
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-red-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-2xl">library_music</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-white text-lg font-bold leading-tight">Biblioteca</h1>
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
            <button className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/20 text-primary border border-primary/50">
              <span className="material-symbols-outlined">library_music</span>
              <p className="text-base font-semibold">Biblioteca</p>
            </button>
            <button onClick={() => navigate('/radio/schedule')} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined">calendar_month</span>
              <p className="text-base font-medium">Agendamento</p>
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
              <h1 className="text-3xl font-bold text-white mb-1">Biblioteca de Playlists</h1>
              <p className="text-text-muted text-sm">Todas as playlists criadas</p>
            </div>
            <div className="flex gap-4">
                 <button
                   onClick={() => navigate('/radio/schedule')}
                   className="flex items-center gap-2 bg-white/10 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/20 transition-colors"
                 >
                   <span className="material-symbols-outlined">calendar_add_on</span>
                   Agendamentos
                 </button>
                <button
                  onClick={() => navigate('/radio/playlist-creator')}
                  className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/80 transition-all shadow-lg hover:scale-105"
                >
                  <span className="material-symbols-outlined">add</span>
                  Nova Playlist
                </button>
            </div>
          </div>

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
            <div className="text-center text-text-muted p-6 liquid-glass rounded-xl">
              Nenhuma playlist encontrada. Crie sua primeira playlist em "Nova Playlist".
            </div>
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
        </div>
      </main>

      
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="liquid-glass rounded-xl p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Confirmar Exclusão</h3>
            <p className="text-text-muted mb-6">Tem certeza que deseja excluir permanentemente a playlist "{playlistToDelete?.nome}"?</p>
            <div className="flex justify-end gap-4">
              <button onClick={closeDeleteModal} className="bg-white/10 text-white px-6 py-2 rounded-lg font-semibold hover:bg-white/20 transition-colors">
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