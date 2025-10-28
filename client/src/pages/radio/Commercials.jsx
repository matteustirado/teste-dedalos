import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Commercials() {
  const navigate = useNavigate()
  const [commercials, setCommercials] = useState([
    { id: 1, name: 'Dedalos Bar Ad', description: 'Promoção de bebidas especiais', duration: '30s' },
    { id: 2, name: 'Sponsor Spot', description: 'Mensagem do patrocinador principal', duration: '15s' },
    { id: 3, name: 'Event Promo', description: 'Divulgação de evento especial', duration: '60s' },
    { id: 4, name: 'Partner Message', description: 'Parceria comercial', duration: '45s' }
  ])
  const [isLive, setIsLive] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [newCommercial, setNewCommercial] = useState({
    name: '',
    description: '',
    video: null
  })

  const handleVideoUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      setNewCommercial({ ...newCommercial, video: file })
    }
  }

  const saveCommercial = () => {
    const commercial = {
      id: commercials.length + 1,
      name: newCommercial.name,
      description: newCommercial.description,
      duration: '30s'
    }
    setCommercials([...commercials, commercial])
    setNewCommercial({ name: '', description: '', video: null })
    setShowForm(false)
  }

  const deleteCommercial = (id) => {
    setCommercials(commercials.filter(c => c.id !== id))
  }

  return (
    <div className="min-h-screen bg-gradient-warm flex">
      <aside className="fixed left-0 top-0 h-screen w-64 bg-bg-dark-primary/50 backdrop-blur-sm border-r border-white/10 p-4 flex flex-col justify-between z-10">
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-red-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-2xl">mic</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-white text-lg font-bold leading-tight">Comerciais</h1>
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
            <button onClick={() => navigate('/radio/playlist-creator')} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined">playlist_add</span>
              <p className="text-base font-medium">Criar Playlist</p>
            </button>
            <button onClick={() => navigate('/radio/library')} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined">library_music</span>
              <p className="text-base font-medium">Biblioteca</p>
            </button>
            <button className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/20 text-primary border border-primary/50">
              <span className="material-symbols-outlined">mic</span>
              <p className="text-base font-semibold">Comerciais</p>
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
          {!showForm ? (
            <>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-white mb-1">Comerciais</h1>
                  <p className="text-text-muted text-sm">Gerencie seus spots publicitários</p>
                </div>
                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/80 transition-all shadow-lg hover:scale-105">
                  <span className="material-symbols-outlined">add</span>
                  Novo Comercial
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {commercials.map((commercial) => (
                  <div key={commercial.id} className="liquid-glass rounded-xl p-6 hover:shadow-2xl transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary to-red-600 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-white text-2xl">campaign</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white mb-1">{commercial.name}</h3>
                          <p className="text-sm text-text-muted">{commercial.description}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                      <div className="text-sm">
                        <p className="text-text-muted">Duração</p>
                        <p className="text-white font-semibold">{commercial.duration}</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="bg-primary/20 text-primary px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/30 transition-colors flex items-center gap-1">
                          <span className="material-symbols-outlined text-lg">play_arrow</span>
                          Tocar
                        </button>
                        <button onClick={() => deleteCommercial(commercial.id)} className="bg-red-500/20 text-red-500 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-500/30 transition-colors flex items-center gap-1">
                          <span className="material-symbols-outlined text-lg">delete</span>
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div>
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-white mb-1">Novo Comercial</h1>
                <p className="text-text-muted text-sm">Adicione um novo spot publicitário</p>
              </div>

              <div className="liquid-glass rounded-xl p-6 mb-6">
                <h2 className="text-xl font-bold text-white mb-4">Informações do Comercial</h2>
                <div className="flex gap-6">
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1">Nome do Comercial</label>
                      <input type="text" value={newCommercial.name} onChange={(e) => setNewCommercial({ ...newCommercial, name: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder:text-text-muted focus:ring-2 focus:ring-primary" placeholder="Ex: Promoção de Verão" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1">Descrição</label>
                      <textarea rows="2" value={newCommercial.description} onChange={(e) => setNewCommercial({ ...newCommercial, description: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder:text-text-muted focus:ring-2 focus:ring-primary resize-none" placeholder="Descreva o comercial..."></textarea>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <label className="block text-xs font-medium text-text-muted">Arquivo de Vídeo</label>
                    <div className="w-32 h-32 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden border-2 border-dashed border-white/20">
                      {newCommercial.video ? (
                        <div className="text-center">
                          <span className="material-symbols-outlined text-4xl text-primary">check_circle</span>
                          <p className="text-xs text-white mt-2">{newCommercial.video.name}</p>
                        </div>
                      ) : (
                        <span className="material-symbols-outlined text-5xl text-text-muted">video_file</span>
                      )}
                    </div>
                    <label className="cursor-pointer bg-primary/20 text-primary px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/30 transition-colors w-full text-center">
                      <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
                      Carregar Vídeo
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={() => { setShowForm(false); setNewCommercial({ name: '', description: '', video: null }); }} className="flex-1 bg-white/10 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/20 transition-colors">Cancelar</button>
                <button onClick={saveCommercial} disabled={!newCommercial.name || !newCommercial.description || !newCommercial.video} className="flex-1 bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Salvar Comercial</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
