import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// Aceita a prop 'unit' para definir se é SP ou BH (Padrão SP)
export default function Home({ unit = 'sp' }) {
  const navigate = useNavigate()
  
  // Salva a unidade escolhida no navegador para que a Rádio saiba onde estamos
  useEffect(() => {
    localStorage.setItem('dedalos_active_unit', unit);
  }, [unit]);
  
  const [expandedSections, setExpandedSections] = useState({ 
    radio: false, 
    maintenance: false, 
    cx: false 
  })

  // Ferramentas de Rádio
  const radioTools = [
    { id: 'dj-controller', name: 'Painel do DJ', icon: 'album', path: '/radio/dj' },
    { id: 'collection', name: 'Acervo de Músicas', icon: 'music_video', path: '/radio/collection' },
    { id: 'playlist-creator', name: 'Criar Playlists', icon: 'playlist_add', path: '/radio/playlist-creator' },
    { id: 'library', name: 'Biblioteca', icon: 'library_music', path: '/radio/library' },
    { id: 'schedule', name: 'Agendamento', icon: 'calendar_month', path: '/radio/schedule' },
    { id: 'jukebox', name: 'Jukebox', icon: 'queue_music', path: `/radio/jukebox/${unit}` }, // Link dinâmico
    { id: 'go-live', name: 'Ao Vivo', icon: 'sensors', path: 'EXTERNAL_WATCH' }
  ]

  // Ferramentas de Manutenção
  const maintenanceTools = [
    { id: 'quinta-premiada', name: 'Quinta Premiada', icon: 'stars', path: `/tools/thursday/${unit}` },
    { id: 'tabela-precos', name: 'Tabela de Preços', icon: 'price_change', path: `/tools/prices/${unit}/view` },
    { id: 'placar-dedalos', name: 'Placar Dedalos', icon: 'scoreboard', path: `/tools/scoreboard/maintenance/${unit}` }
  ]

  const cxTools = [
    { id: 'pesquisa-satisfacao', name: 'Pesquisa de Satisfação', icon: 'thumb_up', path: '/cx/pesquisa' },
    { id: 'avaliacoes', name: 'Avaliações', icon: 'reviews', path: '/cx/avaliacoes' }
  ]

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const handleToolClick = (path) => {
    if (path === 'EXTERNAL_WATCH') {
        window.open('/radio/watch', '_blank');
    } else if (path) {
      navigate(path)
    }
  }

  // Definição de cores baseados na unidade
  const isBH = unit === 'bh';
  const unitLabel = isBH ? 'BELO HORIZONTE' : 'SÃO PAULO';
  const unitTextColor = isBH ? 'text-yellow-400' : 'text-green-500';

  return (
    <div className="min-h-screen bg-gradient-warm">
      <div className="container mx-auto px-4 py-16">
        
        {/* HEADER LIMPO (Sem o badge no topo) */}
        <div className="text-center mb-16">
          <div className="flex justify-center mb-8">
            <svg className="w-24 h-24" viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M276 41.3c-12.4 19.9-79.5 127.5-149.2 239.1C57 392 0 483.7 0 484.2s8.4.7 18.7.6l18.6-.3L168.2 275C240.1 159.8 299.5 65.5 300 65.5c.6 0 59.9 94.3 131.9 209.5l130.8 209.5 18.8.3c15.1.2 18.6 0 18.3-1.1-.2-.7-67.3-108.7-149.3-240C359.6 98.2 300.9 5.1 300 5.1c-.9 0-10.6 14.7-24 36.2z" fill="url(#gradient1)"/>
              <path d="M175.2 284.4C107.5 393 51.7 482.6 51.4 483.4c-.6 1.5 22.5 1.6 248.5 1.6 137 0 249.1-.2 249.1-.5 0-1.1-6.1-11.4-7.4-12.4-.8-.7-10.1-1.2-25.1-1.3l-23.8-.3-13.2-21c-7.2-11.6-50.1-80.3-95.4-152.8C324.5 201.4 301.3 165 300 165c-1.3 0-26.8 40-92.4 145.1-49.8 79.7-90.6 145.7-90.6 146.5 0 1.2 2 1.4 12.3 1.2l12.2-.3 78.7-126c43.3-69.3 79.1-126.1 79.6-126.3.7-.2 62 97.1 156 248l11.1 17.8H275l-.2-24.7-.3-24.8-12.2-.5-12.1-.5 23.1-37c12.8-20.4 24.1-38.5 25.3-40.3l2.1-3.3 23.8 38.3c13.1 21.1 24.5 39.4 25.4 40.7l1.5 2.3-7.1-.7c-10.6-1-11.3-.4-11.3 9.9 0 6.7.3 8.5 1.6 9 .9.3 11.7.6 24 .6H381v-2.4c0-1.4-15.8-27.7-39.3-65.3-29.7-47.6-39.7-62.8-41.2-62.8-1.4 0-11.4 15.2-41.2 63-21.6 34.6-39.3 64-39.3 65.2v2.3h37.9l.6 4.2c.3 2.4.5 9.2.3 15.3l-.3 11-41.3.3-41.3.2 2.3-3.8C189.3 448.8 299.6 273 300.1 273c.3 0 26.5 41.6 58.3 92.5l57.7 92.5h10c8.1 0 9.9-.3 9.9-1.5 0-.8-30.2-49.9-67.1-109.1-53.5-85.6-67.5-107.4-69-107.2-1.3.2-25.4 38-73.7 115.3l-71.9 115-32.1.3-32.1.2 39.8-63.7c22-35.1 69-110.4 104.5-167.3 35.6-56.9 65.1-103.5 65.6-103.5s46.1 72.2 101.2 160.5l100.3 160.5 14.9.3 14.8.3-.4-2.3C530.1 451.9 301.7 87 300 87c-.9 0-49.9 77.5-124.8 197.4z" fill="url(#gradient2)"/>
              <defs>
                <linearGradient id="gradient1" x1="0" y1="0" x2="600" y2="600">
                  <stop offset="0%" stopColor="#ff4d00" />
                  <stop offset="100%" stopColor="#dc2626" />
                </linearGradient>
                <linearGradient id="gradient2" x1="0" y1="0" x2="600" y2="600">
                  <stop offset="0%" stopColor="#ff4d00" />
                  <stop offset="100%" stopColor="#dc2626" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">Dedalos Tools</h1>
          <p className="text-text-muted text-xl">Central de ferramentas</p>
        </div>

        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* === SEÇÃO 1: RÁDIO DEDALOS === */}
          <div className="liquid-glass rounded-xl p-6">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('radio')}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary to-red-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl text-white">radio</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Rádio Dedalos</h2>
                  <p className="text-text-muted text-sm">Gestão completa da rádio</p>
                </div>
              </div>
              <span className={`material-symbols-outlined text-white text-3xl transition-transform ${expandedSections.radio ? 'rotate-180' : ''}`}>expand_more</span>
            </div>
            
            {expandedSections.radio && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mt-6 pt-6 border-t border-white/10 animate-fade-in-down">
                {radioTools.map((tool) => (
                  <div 
                    key={tool.id} 
                    onClick={() => handleToolClick(tool.path)} 
                    className={`liquid-glass rounded-xl p-4 transform transition-all duration-300 hover:shadow-2xl cursor-pointer hover:scale-105 group flex flex-col items-center`}
                  >
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-red-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                      <span className="material-symbols-outlined text-2xl text-white">{tool.icon}</span>
                    </div>
                    <h3 className="text-sm font-bold text-white text-center leading-tight">{tool.name}</h3>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* === SEÇÃO 2: FERRAMENTAS DE MANUTENÇÃO (UNIFICADA) === */}
          <div className="liquid-glass rounded-xl p-6">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('maintenance')}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl text-white">build_circle</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Ferramentas de Manutenção</h2>
                  <p className="text-text-muted text-sm">
                    Ferramentas de manutenção para <span className={`uppercase ${unitTextColor} font-bold`}>{unitLabel}</span>
                  </p>
                </div>
              </div>
              <span className={`material-symbols-outlined text-white text-3xl transition-transform ${expandedSections.maintenance ? 'rotate-180' : ''}`}>expand_more</span>
            </div>
            
            {expandedSections.maintenance && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-6 pt-6 border-t border-white/10 animate-fade-in-down">
                {maintenanceTools.map((tool) => (
                  <div 
                    key={tool.id} 
                    onClick={() => handleToolClick(tool.path)} 
                    className={`liquid-glass rounded-xl p-4 transform transition-all duration-300 hover:shadow-2xl cursor-pointer hover:scale-105 group flex flex-col items-center`}
                  >
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                      <span className="material-symbols-outlined text-2xl text-white">{tool.icon}</span>
                    </div>
                    <h3 className="text-sm font-bold text-white text-center leading-tight">{tool.name}</h3>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* === SEÇÃO 3: CX === */}
          <div className="liquid-glass rounded-xl p-6">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleSection('cx')}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl text-white">sentiment_satisfied</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Experiência do Cliente</h2>
                  <p className="text-text-muted text-sm">Pesquisas e avaliações</p>
                </div>
              </div>
              <span className={`material-symbols-outlined text-white text-3xl transition-transform ${expandedSections.cx ? 'rotate-180' : ''}`}>expand_more</span>
            </div>
            
            {expandedSections.cx && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-6 pt-6 border-t border-white/10 animate-fade-in-down">
                {cxTools.map((tool) => (
                  <div 
                    key={tool.id} 
                    onClick={() => handleToolClick(tool.path)} 
                    className={`liquid-glass rounded-xl p-4 transform transition-all duration-300 hover:shadow-2xl cursor-pointer hover:scale-105 group flex flex-col items-center`}
                  >
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform`}>
                      <span className="material-symbols-outlined text-2xl text-white">{tool.icon}</span>
                    </div>
                    <h3 className="text-base font-bold text-white text-center">{tool.name}</h3>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}