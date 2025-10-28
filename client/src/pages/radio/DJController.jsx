import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function DJController() {
  const navigate = useNavigate()
  const [isPlaying, setIsPlaying] = useState(true)
  const [currentTrack, setCurrentTrack] = useState({
    name: 'Cybernetic Dreams',
    artist: 'Synthwave Rider',
    duration: '4:12',
    currentTime: '2:45',
    progress: 65,
    cover: null,
    watermark: null
  })
  const [queue, setQueue] = useState([
    { id: 1, name: 'Midnight Cruiser', artist: 'Night Runner', duration: '3:56' },
    { id: 2, name: 'Digital Love', artist: 'Daft Punk', duration: '5:01' },
    { id: 3, name: 'Neon Drive', artist: 'Kavinsky', duration: '4:22' },
    { id: 4, name: 'Galactic Funk', artist: 'Cosmic Voyager', duration: '6:15' }
  ])
  const [playlists, setPlaylists] = useState([
    { id: 1, name: '80s Hits', tracks: 45 },
    { id: 2, name: 'Techno Vibes', tracks: 120 },
    { id: 3, name: 'Opening Set', tracks: 25 }
  ])
  const [commercials, setCommercials] = useState([
    { id: 1, name: 'Dedalos Bar Ad', duration: '30s' },
    { id: 2, name: 'Sponsor Spot', duration: '15s' }
  ])
  const [isLive, setIsLive] = useState(false)

  const handleWatermarkUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setCurrentTrack({ ...currentTrack, watermark: e.target.result })
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-warm flex">
      <aside className="fixed left-0 top-0 h-screen w-64 bg-bg-dark-primary/50 backdrop-blur-sm border-r border-white/10 p-4 flex flex-col justify-between z-10">
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-red-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-2xl">radio</span>
              </div>
              <span className={`absolute bottom-0 right-0 block h-3.5 w-3.5 rounded-full border-2 border-bg-dark-primary ${isLive ? 'bg-green-500' : 'bg-gray-500'}`}></span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-white text-lg font-bold leading-tight">Painel do DJ</h1>
              <p className="text-text-muted text-sm">Rádio Dedalos</p>
            </div>
          </div>
          <nav className="flex flex-col gap-2">
            <button onClick={() => navigate('/')} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined">home</span>
              <p className="text-base font-medium">Home</p>
            </button>
            <button className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/20 text-primary border border-primary/50">
              <span className="material-symbols-outlined">radio</span>
              <p className="text-base font-semibold">Painel do DJ</p>
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

      <main className="ml-64 flex-1 p-8 overflow-y-auto">
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 flex flex-col gap-6">
            <div className="liquid-glass rounded-xl p-6" style={{ height: '280px' }}>
              <h1 className="text-2xl font-bold text-white mb-4">Tocando Agora</h1>
              <div className="flex gap-6 items-start">
                <div className="w-40 h-40 rounded-lg bg-gradient-to-br from-primary to-red-600 flex items-center justify-center flex-shrink-0 relative">
                  {currentTrack.cover ? (
                    <img src={currentTrack.cover} alt="Album" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <span className="material-symbols-outlined text-white text-5xl">album</span>
                  )}
                  {currentTrack.watermark && (
                    <img src={currentTrack.watermark} alt="Watermark" className="absolute bottom-2 right-2 w-10 h-10 opacity-80" />
                  )}
                </div>
                <div className="flex flex-col gap-3 w-full">
                  <div className="text-left">
                    <p className="text-white text-xl font-bold leading-tight truncate">{currentTrack.name}</p>
                    <p className="text-text-muted text-base font-medium">{currentTrack.artist}</p>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <label className="cursor-pointer flex shrink-0 items-center justify-center rounded-full w-10 h-10 text-white hover:text-primary transition-colors">
                      <input type="file" accept="image/*" onChange={handleWatermarkUpload} className="hidden" />
                      <span className="material-symbols-outlined text-2xl">add_photo_alternate</span>
                    </label>
                    <button onClick={() => setIsPlaying(!isPlaying)} className="flex shrink-0 items-center justify-center rounded-full w-14 h-14 bg-primary text-white hover:bg-primary/80 transition-all duration-300">
                      <span className="material-symbols-outlined text-3xl">{isPlaying ? 'pause' : 'play_arrow'}</span>
                    </button>
                    <button className="flex shrink-0 items-center justify-center rounded-full w-10 h-10 text-white hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-2xl">skip_next</span>
                    </button>
                  </div>
                  <div>
                    <div className="flex h-2 items-center group">
                      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${currentTrack.progress}%` }}></div>
                      <div className="relative">
                        <div className="absolute -left-2 -top-1.5 w-4 h-4 rounded-full bg-primary transition-transform group-hover:scale-110"></div>
                      </div>
                      <div className="h-1.5 flex-1 rounded-full bg-white/20"></div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-text-muted text-xs font-medium">{currentTrack.currentTime}</p>
                      <p className="text-text-muted text-xs font-medium">{currentTrack.duration}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="liquid-glass rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">Próximas Músicas</h2>
                <div className="flex items-center gap-2">
                  <input className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white text-sm placeholder:text-text-muted focus:ring-2 focus:ring-primary" placeholder="Buscar música..." type="text"/>
                  <button className="flex items-center justify-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/80 transition-colors">
                    <span className="material-symbols-outlined">add</span>
                    Adicionar
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {queue.map((track) => (
                  <div key={track.id} className="flex items-center p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                    <div className="w-10 h-10 rounded bg-gradient-to-br from-primary to-red-600 flex items-center justify-center mr-4 flex-shrink-0">
                      <span className="material-symbols-outlined text-white text-xl">music_note</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-white text-sm">{track.name}</p>
                      <p className="text-xs text-text-muted">{track.artist}</p>
                    </div>
                    <p className="text-xs text-text-muted mr-3">{track.duration}</p>
                    <button className="text-text-muted hover:text-red-500 transition-colors">
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-1 flex flex-col gap-6">
            <div className="liquid-glass rounded-xl p-6" style={{ height: '280px' }}>
              <h2 className="text-xl font-bold text-white mb-4">Playlists</h2>
              <div className="space-y-3 mb-3">
                {playlists.slice(0, 2).map((playlist) => (
                  <div key={playlist.id} className="bg-white/5 p-4 rounded-lg flex items-center justify-between hover:bg-white/10 transition-colors">
                    <div>
                      <p className="font-semibold text-white text-sm">{playlist.name}</p>
                      <p className="text-xs text-text-muted">{playlist.tracks} músicas</p>
                    </div>
                    <button className="bg-primary/20 text-primary px-3 py-1 rounded-md text-xs font-semibold hover:bg-primary/30 transition-colors">Carregar</button>
                  </div>
                ))}
              </div>
              <button onClick={() => navigate('/radio/library')} className="w-full bg-white/10 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white/20 transition-colors">Ver Mais</button>
            </div>

            <div className="liquid-glass rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Comerciais</h2>
              <div className="space-y-3 mb-3">
                {commercials.map((commercial) => (
                  <div key={commercial.id} className="bg-white/5 p-3 rounded-lg flex items-center justify-between hover:bg-white/10 transition-colors">
                    <div className="flex-1">
                      <p className="font-medium text-white text-sm">{commercial.name}</p>
                      <p className="text-xs text-text-muted">{commercial.duration}</p>
                    </div>
                    <button className="text-primary hover:text-primary/80 transition-colors">
                      <span className="material-symbols-outlined">play_circle</span>
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => navigate('/radio/commercials')} className="w-full bg-white/10 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white/20 transition-colors">Ver Mais</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}