import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function Sidebar({ 
  activePage, 
  headerTitle, 
  headerIcon, 
  headerExtra,
  isEditMode = false,
  group = 'radio' // Nova prop para definir qual grupo de menus mostrar (padrão: radio)
}) {
  const navigate = useNavigate()
  
  const handleOpenPlayer = () => {
    window.open('/radio/watch', '_blank');
  }

  // Definição dos menus por grupo (preparado para o futuro)
  const menus = {
    radio: [
      { id: 'home', label: 'Home', icon: 'home', path: '/' },
      // Ícone alterado para 'album' (CD/Vinil)
      { id: 'dj', label: 'Painel do DJ', icon: 'album', path: '/radio/dj' },
      { id: 'collection', label: 'Acervo de Músicas', icon: 'music_video', path: '/radio/collection' },
      { id: 'playlist-creator', label: 'Criar Playlist', icon: 'playlist_add', path: '/radio/playlist-creator' },
      { id: 'library', label: 'Biblioteca', icon: 'library_music', path: '/radio/library' },
      { id: 'schedule', label: 'Agendamento', icon: 'calendar_month', path: '/radio/schedule' },
    ],
    // Futuros grupos (Manutenção e CX) entrarão aqui
    maintenance: [],
    cx: []
  }

  // Seleciona o menu baseado no grupo atual
  const currentMenu = menus[group] || menus.radio;

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-bg-dark-primary/50 backdrop-blur-sm border-r border-white/10 p-4 flex flex-col justify-between z-10">
      <div className="flex flex-col gap-8">
        {/* Cabeçalho do Sidebar */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-red-600 flex items-center justify-center">
              {/* O ícone aqui vem via props do componente Pai (ex: DJController) */}
              <span className="material-symbols-outlined text-white text-2xl">{headerIcon}</span>
            </div>
            {headerExtra}
          </div>
          <div className="flex flex-col">
            <h1 className="text-white text-lg font-bold leading-tight">{headerTitle}</h1>
            <p className="text-text-muted text-sm">Rádio Dedalos</p>
          </div>
        </div>

        {/* Navegação */}
        <nav className="flex flex-col gap-2">
          {currentMenu.map((item) => {
            // Lógica especial para modo de edição (Playlist Creator)
            if (item.id === 'playlist-creator' && isEditMode) {
                return (
                   <div key={item.id} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/20 border border-primary/50 relative">
                     <button
                       onClick={() => navigate('/radio/playlist-creator')}
                       className="p-2 rounded-md hover:bg-white/10 text-primary"
                       title="Voltar para Criação"
                     >
                       <span className="material-symbols-outlined text-lg">arrow_back_ios_new</span>
                     </button>
                     <div className="flex items-center gap-3 px-2 py-1 text-primary flex-1 justify-center">
                       <span className="material-symbols-outlined">playlist_add</span>
                        <p className="text-sm font-semibold">Editando</p>
                     </div>
                   </div>
                );
            }

            const isActive = activePage === item.id;
            return (
              <button 
                key={item.id}
                onClick={() => navigate(item.path)} 
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive 
                    ? 'bg-primary/20 text-primary border border-primary/50' 
                    : 'hover:bg-white/10 text-white'
                }`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <p className={`text-base ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.label}</p>
              </button>
            )
          })}
        </nav>
      </div>

      <div className="flex flex-col gap-3">
        <button 
            onClick={handleOpenPlayer}
            className="flex w-full items-center justify-center gap-2 rounded-lg h-12 px-4 text-white text-base font-bold bg-red-600 hover:bg-red-700 transition-colors shadow-lg hover:shadow-red-900/20"
        >
          <span className="material-symbols-outlined">sensors</span>
          <span className="truncate">Ao Vivo</span>
        </button>
        <div className="text-center text-xs text-text-muted pb-2">
          <p>© Developed by: <span className="text-primary font-semibold">Matteus Tirado</span></p>
        </div>
      </div>
    </aside>
  )
}