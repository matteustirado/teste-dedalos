import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { toast } from 'react-toastify';
import axios from 'axios';
import { EMOJI_DATA, COLOR_PALETTE } from '../../assets/emojis/KeyboardEmojis';

const API_URL = 'http://localhost:4000';

// --- SUB-COMPONENTE: SELETOR DE EMOJIS ---
const EmojiPickerInline = ({ onSelect, onClose, recentEmojis }) => {
    const [activeTab, setActiveTab] = useState('recents');

    const categories = [
        { id: 'recents', icon: '🕒', label: 'Recentes', emojis: recentEmojis },
        ...EMOJI_DATA
    ];

    const currentEmojis = categories.find(c => c.id === activeTab)?.emojis || [];

    return (
        <div className="absolute inset-0 z-50 bg-[#121212] flex flex-col animate-fade-in overflow-hidden rounded-xl">
            <div className="flex items-center justify-between bg-black/60 p-2 border-b border-white/10 backdrop-blur-md">
                <div className="flex gap-1 overflow-x-auto custom-scrollbar no-scrollbar flex-1 mr-2">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveTab(cat.id)}
                            className={`p-1.5 rounded-lg text-sm transition-all min-w-[32px] flex items-center justify-center ${
                                activeTab === cat.id 
                                ? 'bg-blue-600 text-white shadow-md' 
                                : 'text-white/40 hover:bg-white/10 hover:text-white'
                            }`}
                            title={cat.label}
                        >
                            {cat.icon}
                        </button>
                    ))}
                </div>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-red-500/10 text-red-400 hover:bg-red-600 hover:text-white rounded-lg transition-colors flex-shrink-0 border border-red-500/20">
                    <span className="material-symbols-outlined text-base">close</span>
                </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-[#181818]">
                {currentEmojis.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-white/20">
                        <span className="material-symbols-outlined text-3xl mb-2">sentiment_dissatisfied</span>
                        <p className="text-xs">Nenhum emoji recente</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-6 gap-1">
                        {currentEmojis.map((emoji, idx) => (
                            <button key={idx} onClick={() => onSelect(emoji)} className="aspect-square hover:bg-white/10 rounded-lg flex items-center justify-center text-2xl transition-transform hover:scale-110 active:scale-95">
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- SUB-COMPONENTE: SELETOR DE CORES ---
const ColorPicker = ({ onSelect, onClose }) => {
    return (
        <div className="absolute top-9 right-0 z-50 bg-[#1a1a1a] border border-white/20 rounded-xl p-3 shadow-2xl w-48 animate-fade-in origin-top-right">
            <div className="grid grid-cols-5 gap-2">
                {COLOR_PALETTE.map((colorHex, idx) => (
                    <button 
                        key={idx}
                        onClick={() => { onSelect(colorHex); onClose(); }}
                        className="w-7 h-7 rounded-full border border-white/10 hover:scale-110 transition-transform shadow-sm relative group"
                        style={{ backgroundColor: colorHex }}
                        title={`Cor ${idx + 1}`}
                    >
                        {/* Indicador de número ao passar o mouse */}
                        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-black/50 opacity-0 group-hover:opacity-100">
                            {idx + 1}
                        </span>
                    </button>
                ))}
            </div>
            <div className="mt-2 pt-2 border-t border-white/10 text-center">
                <button onClick={onClose} className="text-[10px] text-white/40 hover:text-white uppercase font-bold tracking-wider">Fechar</button>
            </div>
        </div>
    );
};

export default function ScoreboardEdit() {
    const { unidade } = useParams();
    const currentUnit = unidade ? unidade.toLowerCase() : 'sp';
    
    // --- ESTADOS ---
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState({ titulo: '', layout: 'landscape', opcoes: [] });
    const [optionCount, setOptionCount] = useState(2);
    
    // Controles de UI
    const [activeEmojiPickerIndex, setActiveEmojiPickerIndex] = useState(null);
    const [activeColorPickerIndex, setActiveColorPickerIndex] = useState(null);
    const [recentEmojis, setRecentEmojis] = useState(() => {
        try { return JSON.parse(localStorage.getItem('dedalos_recent_emojis')) || []; } 
        catch { return []; }
    });

    // Controle de Modais
    const [showPresetsModal, setShowPresetsModal] = useState(false);
    const [presets, setPresets] = useState([]);
    const [presetName, setPresetName] = useState('');
    
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, isDanger: false });

    // --- CARREGAR DADOS ---
    useEffect(() => { loadActiveConfig(); }, [currentUnit]);

    const loadActiveConfig = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/scoreboard/active/${currentUnit}`);
            setConfig({
                titulo: res.data.titulo || '',
                layout: res.data.layout || 'landscape',
                opcoes: res.data.opcoes || []
            });
            setOptionCount(res.data.opcoes ? res.data.opcoes.length : 2);
        } catch (error) { toast.error("Erro ao carregar configuração."); } 
        finally { setLoading(false); }
    };

    // --- AUXILIARES ---
    const openConfirm = (title, message, action, isDanger = false) => {
        setConfirmModal({
            isOpen: true,
            title,
            message,
            onConfirm: () => { action(); setConfirmModal(prev => ({...prev, isOpen: false})); },
            isDanger
        });
    };

    const handleEmojiSelect = (index, emoji) => {
        handleOptionChange(index, 'valor', emoji);
        setRecentEmojis(prev => {
            const newRecents = [emoji, ...prev.filter(e => e !== emoji)].slice(0, 24);
            localStorage.setItem('dedalos_recent_emojis', JSON.stringify(newRecents));
            return newRecents;
        });
        setActiveEmojiPickerIndex(null);
    };

    // --- FORMULÁRIO ---
    const handleCountChange = (e) => {
        let count = parseInt(e.target.value);
        if (count < 1) count = 1; if (count > 10) count = 10;
        
        setOptionCount(count);
        
        setConfig(prev => {
            const newOpcoes = [...prev.opcoes];
            
            // Adiciona novas opções com cor padrão sequencial da COLOR_PALETTE
            while (newOpcoes.length < count) {
                const colorIndex = newOpcoes.length % COLOR_PALETTE.length;
                newOpcoes.push({ 
                    nome: '', 
                    tipo: 'none', 
                    valor: '', 
                    cor: COLOR_PALETTE[colorIndex] // Atribuição Automática
                });
            }
            
            // Remove opções se diminuiu
            if (newOpcoes.length > count) {
                newOpcoes.length = count;
            }
            
            return { ...prev, opcoes: newOpcoes };
        });
    };

    const handleOptionChange = (index, field, value) => {
        setConfig(prev => {
            const newOpcoes = [...prev.opcoes];
            newOpcoes[index] = { ...newOpcoes[index], [field]: value };
            if (field === 'tipo') newOpcoes[index].valor = ''; 
            return { ...prev, opcoes: newOpcoes };
        });
    };

    const handleImageUpload = async (index, file) => {
        if (!file) return;
        const formData = new FormData();
        formData.append('scoreboardImage', file);
        const toastId = toast.loading("Enviando...");
        try {
            const res = await axios.post(`${API_URL}/api/scoreboard/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
            handleOptionChange(index, 'valor', res.data.url);
            toast.update(toastId, { render: "Sucesso!", type: "success", isLoading: false, autoClose: 2000 });
        } catch (error) {
            toast.update(toastId, { render: "Erro no upload.", type: "error", isLoading: false, autoClose: 3000 });
        }
    };

    // --- AÇÕES ---
    const handleSaveActive = async () => {
        try {
            await axios.post(`${API_URL}/api/scoreboard/active`, { unidade: currentUnit, ...config, status: 'ATIVO' });
            toast.success("Placar atualizado!");
        } catch (error) { toast.error("Erro ao salvar."); }
    };

    const handleTestVote = async () => {
        try {
            const randomIndex = Math.floor(Math.random() * config.opcoes.length);
            await axios.post(`${API_URL}/api/scoreboard/vote`, { unidade: currentUnit, optionIndex: randomIndex });
            toast.info(`Voto teste: Opção ${randomIndex + 1}`);
        } catch (error) { toast.error("Erro no voto teste."); }
    };

    const requestResetVotes = () => {
        openConfirm("Zerar Votos?", "Isso apagará a contagem atual de todas as opções. O placar voltará a zero.", async () => {
            try {
                await axios.post(`${API_URL}/api/scoreboard/reset-votes`, { unidade: currentUnit });
                toast.success("Zerado!");
            } catch (error) { toast.error("Erro ao zerar."); }
        }, true);
    };

    // --- PRESETS ---
    const loadPresets = async () => {
        try { const res = await axios.get(`${API_URL}/api/scoreboard/presets`); setPresets(res.data); } catch (e) {}
    };

    const handleSavePreset = async () => {
        if (!presetName) return toast.warning("Dê um nome.");
        try {
            await axios.post(`${API_URL}/api/scoreboard/presets`, { titulo_preset: presetName, titulo_placar: config.titulo, layout: config.layout, opcoes: config.opcoes });
            toast.success("Salvo!"); setPresetName(''); loadPresets();
        } catch (e) { toast.error("Erro ao salvar preset."); }
    };

    const requestApplyPreset = (preset) => {
        openConfirm("Carregar Predefinição?", `Deseja carregar "${preset.titulo_preset}"? A configuração atual será perdida.`, () => {
            setConfig({ titulo: preset.titulo_placar, layout: preset.layout, opcoes: preset.opcoes });
            setOptionCount(preset.opcoes.length);
            setShowPresetsModal(false);
            toast.success("Predefinição carregada! Clique em 'ATIVAR' para enviar.");
        });
    };

    const requestDeletePreset = (id) => {
        openConfirm("Excluir Predefinição?", "Essa ação não pode ser desfeita.", async () => {
            try {
                await axios.delete(`${API_URL}/api/scoreboard/presets/${id}`);
                loadPresets(); toast.success("Excluído.");
            } catch (e) { toast.error("Erro ao excluir."); }
        }, true);
    };

    return (
        <div className="min-h-screen bg-gradient-warm flex">
            <Sidebar activePage="scoreboard-maintenance" headerTitle="Manutenção Placar" headerIcon="settings_remote" group="maintenance" unit={currentUnit} />

            <main className="ml-64 flex-1 p-8 h-screen overflow-hidden flex flex-col">
                {/* TOPO */}
                <div className="flex justify-between items-center mb-6 flex-shrink-0">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-1">Manutenção de Placar</h1>
                        <p className="text-white/50 text-sm">Configure o jogo de votação em tempo real</p>
                    </div>
                    <button onClick={() => { setShowPresetsModal(true); loadPresets(); }} className="bg-white/10 hover:bg-white/20 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors border border-white/10">
                        <span className="material-symbols-outlined">bookmarks</span> PREDEFINIÇÕES
                    </button>
                </div>

                {/* FORMULÁRIO */}
                <div className="liquid-glass p-6 rounded-2xl mb-6 flex-shrink-0">
                    <div className="flex flex-col md:flex-row gap-6 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-xs text-white/50 uppercase font-bold mb-1 ml-1">Título do Placar</label>
                            <input type="text" className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-blue-500 outline-none font-bold text-lg h-[50px]" placeholder="Ex: Quem é o melhor DJ?" value={config.titulo} onChange={(e) => setConfig({...config, titulo: e.target.value})} />
                        </div>
                        <div className="w-full md:w-auto">
                            <label className="block text-xs text-white/50 uppercase font-bold mb-1 ml-1">Layout</label>
                            <div className="flex bg-black/30 p-1 rounded-lg border border-white/10 h-[50px] items-center">
                                <button onClick={() => setConfig({...config, layout: 'landscape'})} className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${config.layout === 'landscape' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}><span className="material-symbols-outlined text-lg">view_column</span> PAISAGEM</button>
                                <button onClick={() => setConfig({...config, layout: 'portrait'})} className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${config.layout === 'portrait' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}><span className="material-symbols-outlined text-lg">view_stream</span> RETRATO</button>
                            </div>
                        </div>
                        <div className="w-full md:w-32">
                            <label className="block text-xs text-white/50 uppercase font-bold mb-1 ml-1">Opções</label>
                            <input type="number" min="1" max="10" className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-blue-500 outline-none font-bold text-lg text-center h-[50px]" value={optionCount} onChange={handleCountChange} />
                        </div>
                    </div>
                </div>

                {/* GRID OPÇÕES */}
                <div className="flex-1 overflow-y-auto custom-scrollbar mb-6 pr-2">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-4">
                        {config.opcoes.map((opt, idx) => (
                            <div key={idx} className="bg-white/5 p-3 rounded-xl border border-white/5 hover:border-white/20 transition-all relative group flex flex-col gap-2 min-h-[200px]">
                                
                                {/* CABEÇALHO DO CARD */}
                                <div className="absolute top-2 right-3 text-xs font-black text-white/10 text-[2rem] pointer-events-none">#{idx + 1}</div>
                                
                                {/* INPUT NOME + COR */}
                                <div>
                                    <label className="text-[10px] text-white/40 uppercase font-bold">Nome</label>
                                    <div className="relative flex items-center">
                                        <input 
                                            type="text" 
                                            className="w-full bg-transparent border-b border-white/10 focus:border-blue-500 text-white p-1 pr-8 outline-none font-medium text-sm" 
                                            value={opt.nome} 
                                            onChange={(e) => handleOptionChange(idx, 'nome', e.target.value)} 
                                            placeholder={`Opção ${idx + 1}`} 
                                        />
                                        
                                        {/* BOLINHA DE COR */}
                                        <button 
                                            className="w-5 h-5 rounded-full absolute right-1 top-1/2 -translate-y-1/2 border border-white/30 shadow-sm hover:scale-110 transition-transform"
                                            style={{ backgroundColor: opt.cor || COLOR_PALETTE[idx % COLOR_PALETTE.length] }}
                                            onClick={() => setActiveColorPickerIndex(activeColorPickerIndex === idx ? null : idx)}
                                            title="Alterar cor da barra"
                                        ></button>

                                        {/* COLOR PICKER FLUTUANTE */}
                                        {activeColorPickerIndex === idx && (
                                            <ColorPicker 
                                                onSelect={(color) => {
                                                    handleOptionChange(idx, 'cor', color);
                                                    setActiveColorPickerIndex(null);
                                                }} 
                                                onClose={() => setActiveColorPickerIndex(null)}
                                            />
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] text-white/40 uppercase font-bold">Tipo</label>
                                    <div className="flex gap-1 mt-1">
                                        {['none', 'emoji', 'image'].map(type => (
                                            <button key={type} onClick={() => handleOptionChange(idx, 'tipo', type)} className={`flex-1 py-1 rounded text-[10px] font-bold uppercase border ${opt.tipo === type ? 'bg-blue-600/80 border-blue-500 text-white' : 'bg-black/20 border-white/10 text-white/40 hover:text-white'}`}>
                                                {type === 'none' ? 'Nada' : type === 'emoji' ? 'Emoji' : 'Img'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* ÁREA VISUAL */}
                                <div className="flex-1 min-h-[90px] bg-black/30 rounded-lg flex items-center justify-center border border-dashed border-white/10 relative overflow-hidden">
                                    {opt.tipo === 'none' && <span className="text-white/20 text-xs">Sem visual</span>}
                                    
                                    {opt.tipo === 'emoji' && (
                                        <button onClick={() => setActiveEmojiPickerIndex(idx)} className="text-5xl hover:scale-110 transition-transform cursor-pointer w-full h-full flex items-center justify-center">
                                            {opt.valor || <span className="text-white/20 text-xs uppercase font-bold border border-white/20 px-2 py-1 rounded hover:bg-white/10 hover:text-white">Escolher</span>}
                                        </button>
                                    )}

                                    {opt.tipo === 'image' && (
                                        opt.valor ? (
                                            <div className="relative w-full h-full group/img">
                                                <img src={`${API_URL}${opt.valor}`} alt="Preview" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                                                    <label className="cursor-pointer bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded text-xs backdrop-blur-md">Trocar <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(idx, e.target.files[0])} /></label>
                                                </div>
                                            </div>
                                        ) : (
                                            <label className="cursor-pointer flex flex-col items-center text-white/30 hover:text-white transition-colors">
                                                <span className="material-symbols-outlined text-2xl mb-1">add_photo_alternate</span>
                                                <span className="text-[10px] uppercase font-bold">Upload</span>
                                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(idx, e.target.files[0])} />
                                            </label>
                                        )
                                    )}
                                </div>

                                {/* EMOJI PICKER (FULL CARD) */}
                                {activeEmojiPickerIndex === idx && (
                                    <EmojiPickerInline 
                                        onSelect={(emoji) => handleEmojiSelect(idx, emoji)} 
                                        onClose={() => setActiveEmojiPickerIndex(null)}
                                        recentEmojis={recentEmojis}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* RODAPÉ DE AÇÕES */}
                <div className="grid grid-cols-12 gap-6 pt-4 border-t border-white/10 mt-auto flex-shrink-0">
                    <div className="col-span-6 flex gap-4">
                        <div className="flex gap-2">
                            <button onClick={handleTestVote} className="bg-white/5 hover:bg-white/10 text-white px-4 py-3 rounded-xl text-sm font-bold border border-white/10 flex items-center gap-2"><span className="material-symbols-outlined text-yellow-400">science</span> TESTAR</button>
                            <button onClick={requestResetVotes} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm font-bold border border-red-500/20 flex items-center gap-2"><span className="material-symbols-outlined">restart_alt</span></button>
                        </div>
                        <div className="flex-1 flex gap-2 bg-black/30 p-1 rounded-xl border border-white/5">
                            <input type="text" placeholder="Nome para salvar preset..." className="flex-1 bg-transparent border-none px-3 text-white text-sm outline-none placeholder-white/30" value={presetName} onChange={(e) => setPresetName(e.target.value)} />
                            <button onClick={handleSavePreset} className="bg-white/10 hover:bg-white/20 text-white px-4 rounded-lg flex items-center justify-center transition-colors"><span className="material-symbols-outlined">save</span></button>
                        </div>
                    </div>
                    <div className="col-span-6 flex justify-end">
                        <button onClick={handleSaveActive} className="w-full bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-blue-900/30 transition-all hover:scale-[1.02]"><span className="material-symbols-outlined">rocket_launch</span> ATIVAR PLACAR NAS TELAS</button>
                    </div>
                </div>
            </main>

            {/* MODAL DE PRESETS */}
            {showPresetsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
                    <div className="bg-[#121212] border border-white/10 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col h-[80vh]">
                        <div className="flex justify-between items-center p-6 border-b border-white/10 bg-[#1a1a1a] rounded-t-3xl">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-3"><span className="material-symbols-outlined text-blue-500">bookmarks</span> Predefinições</h2>
                            <button onClick={() => setShowPresetsModal(false)} className="text-white/50 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-black/20">
                            <div className="space-y-3">
                                {presets.map(preset => (
                                    <div key={preset.id} className="bg-[#1a1a1a] p-4 rounded-xl border border-white/5 hover:border-blue-500/50 transition-colors flex items-center gap-6 group">
                                        <div className="w-1/4">
                                            <h3 className="text-white font-bold text-lg truncate">{preset.titulo_preset}</h3>
                                            <p className="text-white/40 text-xs uppercase tracking-wider font-bold mt-1">{new Date(preset.created_at).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                        <div className="w-1/6 border-l border-white/5 pl-6">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2 text-xs text-white/60"><span className="material-symbols-outlined text-sm">monitor</span> {preset.titulo_placar}</div>
                                                <div className="flex items-center gap-2 text-xs text-white/60"><span className="material-symbols-outlined text-sm">{preset.layout === 'landscape' ? 'view_column' : 'view_stream'}</span> {preset.layout === 'landscape' ? 'Paisagem' : 'Retrato'}</div>
                                            </div>
                                        </div>
                                        <div className="flex-1 flex gap-2 overflow-x-auto custom-scrollbar pb-2 items-center">
                                            <span className="text-xs font-bold text-white/30 mr-2">{preset.opcoes.length} Opções:</span>
                                            {preset.opcoes.map((opt, i) => (
                                                <div key={i} className="w-10 h-10 flex-shrink-0 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-lg relative" style={{borderColor: opt.cor}}>
                                                    {opt.tipo === 'emoji' ? opt.valor : opt.tipo === 'image' ? <span className="material-symbols-outlined text-sm text-blue-400">image</span> : <span className="text-white/10">-</span>}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-2 pl-4 border-l border-white/5">
                                            <button onClick={() => requestApplyPreset(preset)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-lg"><span className="material-symbols-outlined text-sm">upload</span> CARREGAR</button>
                                            <button onClick={() => requestDeletePreset(preset.id)} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-lg border border-red-500/20"><span className="material-symbols-outlined text-sm">delete</span></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE CONFIRMAÇÃO */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
                    <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl relative text-center">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmModal.isDanger ? 'bg-red-600/20' : 'bg-blue-600/20'}`}>
                            <span className={`material-symbols-outlined text-4xl ${confirmModal.isDanger ? 'text-red-500' : 'text-blue-500'}`}>
                                {confirmModal.isDanger ? 'warning' : 'info'}
                            </span>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">{confirmModal.title}</h2>
                        <p className="text-white/60 mb-8">{confirmModal.message}</p>
                        <div className="flex gap-4">
                            <button onClick={() => setConfirmModal(prev => ({...prev, isOpen: false}))} className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-bold transition-colors">CANCELAR</button>
                            <button onClick={confirmModal.onConfirm} className={`flex-1 py-3 rounded-xl font-bold transition-colors shadow-lg flex items-center justify-center gap-2 ${confirmModal.isDanger ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-900/30' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-900/30'}`}>CONFIRMAR</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}