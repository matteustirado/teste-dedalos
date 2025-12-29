import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Sidebar from '../../components/Sidebar';

const API_URL = 'http://localhost:4000';

export default function RequestHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTerm, setFilterTerm] = useState('');
  
  // NOVOS FILTROS SOLICITADOS
  const [filterStatus, setFilterStatus] = useState('TODOS'); 

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/jukebox/history`);
        setHistory(res.data);
      } catch (error) {
        console.error("Erro ao carregar histórico", error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      // Filtro de Texto
      const matchesTerm = 
        (item.titulo && item.titulo.toLowerCase().includes(filterTerm.toLowerCase())) ||
        (item.artista && item.artista.toLowerCase().includes(filterTerm.toLowerCase())) ||
        (item.termo_busca && item.termo_busca.toLowerCase().includes(filterTerm.toLowerCase())) || // Para sugestões
        item.pulseira_id?.toLowerCase().includes(filterTerm.toLowerCase());
      
      // Filtro de Categoria (Abas)
      let matchesStatus = true;
      if (filterStatus === 'TOCADAS') {
          matchesStatus = item.status === 'TOCADO';
      } else if (filterStatus === 'VETADOS') {
          matchesStatus = item.status === 'VETADO';
      } else if (filterStatus === 'SUGERIDAS') {
          matchesStatus = item.status === 'SUGERIDA';
      }
      // 'TODOS' mostra tudo (Pendente, Tocado, Vetado, Sugerida)

      return matchesTerm && matchesStatus;
    });
  }, [history, filterTerm, filterStatus]);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' - ' + date.toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status) => {
      switch (status) {
          case 'PENDENTE': return <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30">NA FILA</span>;
          case 'TOCADO': return <span className="px-2 py-1 rounded bg-green-500/20 text-green-400 text-xs font-bold border border-green-500/30">TOCADA</span>;
          case 'VETADO': return <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/30">VETADA</span>;
          case 'SUGERIDA': return <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 text-xs font-bold border border-yellow-500/30">SUGESTÃO</span>;
          default: return <span className="px-2 py-1 rounded bg-gray-500/20 text-gray-400 text-xs font-bold">{status}</span>;
      }
  };

  return (
    <div className="min-h-screen bg-gradient-warm flex">
      <Sidebar 
        activePage="collection" 
        headerTitle="Histórico de Pedidos" 
        headerIcon="history" 
      />

      <main className="ml-64 flex-1 p-8">
        <div className="max-w-7xl mx-auto w-full">
          
          {/* CABEÇALHO E FILTROS */}
          <div className="flex flex-col gap-6 mb-8">
              <div className="flex justify-between items-end">
                  <div>
                    <button 
                        onClick={() => navigate('/radio/collection')}
                        className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 mb-2 transition-colors"
                    >
                        <span className="material-symbols-outlined text-lg">arrow_back_ios_new</span>
                        Voltar para Acervo
                    </button>
                    <h1 className="text-3xl font-bold text-white">Histórico de Solicitações</h1>
                    <p className="text-white/50 text-sm mt-1">Monitore o que foi tocado, vetado e as sugestões dos clientes.</p>
                  </div>
              </div>

              <div className="liquid-glass p-4 rounded-xl flex gap-4 items-center">
                  <div className="relative flex-1">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/40">search</span>
                      <input 
                          type="text" 
                          placeholder="Filtrar por música, artista ou nº pulseira..." 
                          className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-white/30 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                          value={filterTerm}
                          onChange={e => setFilterTerm(e.target.value)}
                      />
                  </div>
                  
                  {/* NOVAS ABAS DE FILTRO */}
                  <div className="flex bg-black/40 rounded-lg p-1 border border-white/10">
                      {['TODOS', 'TOCADAS', 'VETADOS', 'SUGERIDAS'].map(status => (
                          <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${filterStatus === status ? 'bg-primary text-white shadow-lg' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
                          >
                              {status}
                          </button>
                      ))}
                  </div>
              </div>
          </div>

          {/* TABELA DE HISTÓRICO */}
          <div className="liquid-glass rounded-xl overflow-hidden border border-white/5">
              <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                      <thead>
                          <tr className="bg-white/5 border-b border-white/10 text-white/40 text-xs uppercase tracking-wider">
                              <th className="p-4 font-semibold">Música / Sugestão</th>
                              <th className="p-4 font-semibold">Solicitante</th>
                              <th className="p-4 font-semibold text-center">Unidade</th>
                              <th className="p-4 font-semibold text-center">Status</th>
                              <th className="p-4 font-semibold text-right">Data / Hora</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                          {loading ? (
                              <tr><td colSpan="5" className="p-8 text-center text-white/30">Carregando histórico...</td></tr>
                          ) : filteredHistory.length === 0 ? (
                              <tr><td colSpan="5" className="p-8 text-center text-white/30">Nenhum registro encontrado nesta categoria.</td></tr>
                          ) : (
                              filteredHistory.map((item) => (
                                  <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                                      <td className="p-4">
                                          <div className="flex items-center gap-3">
                                              {/* LÓGICA VISUAL: Se tem track_id mostra a capa, se é sugestão mostra ícone */}
                                              {item.titulo ? (
                                                  <>
                                                      <div className="w-10 h-10 rounded bg-black/50 overflow-hidden flex-shrink-0 border border-white/10">
                                                          <img src={item.thumbnail_url || 'https://placehold.co/40'} alt="" className="w-full h-full object-cover" />
                                                      </div>
                                                      <div className="min-w-0">
                                                          <p className="text-white font-medium text-sm truncate max-w-[200px]">{item.titulo}</p>
                                                          <p className="text-white/40 text-xs truncate max-w-[200px]">{item.artista}</p>
                                                      </div>
                                                  </>
                                              ) : (
                                                  <>
                                                      <div className="w-10 h-10 rounded bg-yellow-500/10 flex items-center justify-center flex-shrink-0 border border-yellow-500/20">
                                                          <span className="material-symbols-outlined text-yellow-500 text-lg">lightbulb</span>
                                                      </div>
                                                      <div className="min-w-0">
                                                          <p className="text-white font-medium text-sm truncate max-w-[250px] italic">"{item.termo_busca}"</p>
                                                          <p className="text-yellow-500/60 text-[10px] font-bold uppercase">Sugestão Manual</p>
                                                      </div>
                                                  </>
                                              )}
                                          </div>
                                      </td>
                                      <td className="p-4">
                                          <div className="flex items-center gap-2">
                                              <span className="material-symbols-outlined text-white/30 text-lg">
                                                  {item.unidade === 'DJ' ? 'headphones' : 'confirmation_number'}
                                              </span>
                                              <span className="text-white/80 font-mono text-sm">{item.pulseira_id || 'N/A'}</span>
                                          </div>
                                      </td>
                                      <td className="p-4 text-center">
                                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                              item.unidade === 'SP' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                              item.unidade === 'BH' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                              'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                          }`}>
                                              {item.unidade}
                                          </span>
                                      </td>
                                      <td className="p-4 text-center">
                                          {getStatusBadge(item.status)}
                                      </td>
                                      <td className="p-4 text-right">
                                          <div className="flex flex-col items-end">
                                              <span className="text-white/70 text-xs">{formatDate(item.created_at)}</span>
                                              {item.tocado_em && item.status === 'TOCADO' && (
                                                  <span className="text-green-400/60 text-[10px] flex items-center gap-1 mt-0.5">
                                                      <span className="material-symbols-outlined text-[10px]">play_circle</span>
                                                      Tocou às {new Date(item.tocado_em).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}
                                                  </span>
                                              )}
                                              {item.status === 'VETADO' && item.tocado_em && (
                                                  <span className="text-red-400/60 text-[10px] flex items-center gap-1 mt-0.5">
                                                      <span className="material-symbols-outlined text-[10px]">block</span>
                                                      Vetado às {new Date(item.tocado_em).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}
                                                  </span>
                                              )}
                                          </div>
                                      </td>
                                  </tr>
                              ))
                          )}
                      </tbody>
                  </table>
              </div>
          </div>

        </div>
      </main>
    </div>
  );
}