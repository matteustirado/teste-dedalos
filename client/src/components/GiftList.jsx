import React, { useState } from 'react';
import { toast } from 'react-toastify';

const PRIZE_CATEGORIES = [
    { id: 'rodada_dupla', label: 'Rodada Dupla', icon: 'local_bar' },
    { id: 'uma_vida', label: 'Uma Vida', icon: 'confirmation_number' },
    { id: 'drink_especial', label: 'Drink Especial', icon: 'wine_bar' },
    { id: 'premio_surpresa', label: 'Prêmio Surpresa', icon: 'redeem' },
    { id: 'consumo', label: 'R$ Consumo', icon: 'attach_money' },
];

const SURPRISE_OPTIONS = ['Halls', 'RedBull', 'Salgadinho', 'Caipinossa', 'Double Tequila'];

export default function GiftList({ lockerNumber, onCancel, onConfirm }) {
    // Estados Internos do Formulário
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [umaVidaTab, setUmaVidaTab] = useState('sem_cadastro');
    const [loadingName, setLoadingName] = useState(false);
    
    const [formData, setFormData] = useState({
        pulseira: '',
        nomeCliente: '',
        bebida: '',
        recusado: false,
        diaPreferencia: '',
        email: '',
        customerCode: '',
        surpresaEscolhida: ''
    });

    // Simulação de busca de nome (Pode ser movida para um hook ou service depois)
    const fetchNomeCliente = (pulseira) => {
        if (!pulseira) return;
        setLoadingName(true);
        // Simulação de delay de API
        setTimeout(() => {
            setFormData(prev => ({ ...prev, nomeCliente: `Cliente Pulseira ${pulseira}` }));
            setLoadingName(false);
        }, 500);
    };

    const handleSave = () => {
        let prizeLabel = PRIZE_CATEGORIES.find(c => c.id === selectedCategory).label;
        let detailsString = '';

        // Validação e Formatação
        switch (selectedCategory) {
            case 'rodada_dupla':
                if (formData.recusado) {
                    detailsString = `Recusado pelo cliente ${formData.nomeCliente || '(Sem Nome)'}`;
                } else {
                    if (!formData.bebida) return toast.warning("Informe a bebida escolhida.");
                    detailsString = `Bebida: ${formData.bebida} | Cliente: ${formData.nomeCliente} (Pulseira: ${formData.pulseira})`;
                }
                break;
            case 'uma_vida':
                if (umaVidaTab === 'sem_cadastro') {
                    if (!formData.nomeCliente || !formData.diaPreferencia) return toast.warning("Preencha nome e dia.");
                    detailsString = `Uma Vida (Sem Cadastro) | Nome: ${formData.nomeCliente} | Dia: ${formData.diaPreferencia} | Email: ${formData.email}`;
                } else {
                    if (!formData.customerCode) return toast.warning("Informe o código do cliente.");
                    detailsString = `Uma Vida (Com Cadastro) | Code: ${formData.customerCode} | Data: ${formData.diaPreferencia}`;
                }
                break;
            case 'drink_especial':
                if (!formData.bebida) return toast.warning("Informe o drink.");
                detailsString = `Drink: ${formData.bebida} | Cliente: ${formData.nomeCliente}`;
                break;
            case 'premio_surpresa':
                if (!formData.surpresaEscolhida) return toast.warning("Selecione o prêmio.");
                prizeLabel = `Surpresa: ${formData.surpresaEscolhida}`;
                detailsString = `Ganhou: ${formData.surpresaEscolhida} | Cliente: ${formData.nomeCliente}`;
                break;
            case 'consumo':
                detailsString = `R$50 Consumo | Cliente: ${formData.nomeCliente}`;
                break;
            default: return;
        }

        // Envia para o pai apenas o necessário
        onConfirm(prizeLabel, detailsString);
    };

    return (
        <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-6 max-w-2xl w-full shadow-2xl relative flex flex-col max-h-[90vh] animate-fade-in">
            
            {/* CABEÇALHO */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <span className="bg-green-600 text-white text-sm px-3 py-1 rounded-full">Ocupado</span>
                        Armário {lockerNumber}
                    </h2>
                    <p className="text-text-muted text-sm mt-1">Selecione a categoria do prêmio para liberar o resgate.</p>
                </div>
                {selectedCategory && (
                    <button onClick={() => { setSelectedCategory(null); setFormData({}); }} className="text-sm text-blue-400 hover:text-blue-300 font-bold">
                        ALTERAR CATEGORIA
                    </button>
                )}
            </div>

            {/* SELEÇÃO DE CATEGORIA */}
            {!selectedCategory ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {PRIZE_CATEGORIES.map(cat => (
                        <button 
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className="bg-white/5 hover:bg-blue-600 hover:scale-105 transition-all p-6 rounded-2xl border border-white/10 flex flex-col items-center gap-3 group"
                        >
                            <span className="material-symbols-outlined text-4xl text-white/70 group-hover:text-white">{cat.icon}</span>
                            <span className="text-white font-bold uppercase tracking-wide text-sm">{cat.label}</span>
                        </button>
                    ))}
                </div>
            ) : (
                /* FORMULÁRIOS */
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    
                    {/* 1. RODADA DUPLA */}
                    {selectedCategory === 'rodada_dupla' && (
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Pulseira</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                                        value={formData.pulseira}
                                        onChange={(e) => setFormData({...formData, pulseira: e.target.value})}
                                        onBlur={(e) => fetchNomeCliente(e.target.value)}
                                        placeholder="Nº"
                                        disabled={formData.recusado}
                                    />
                                </div>
                                <div className="flex-[2]">
                                    <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Nome do Cliente</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white/50 cursor-not-allowed"
                                        value={loadingName ? "Buscando..." : formData.nomeCliente}
                                        readOnly
                                        disabled={formData.recusado}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-3 py-2">
                                <input 
                                    type="checkbox" 
                                    id="recusado" 
                                    className="w-5 h-5 rounded border-white/20 bg-black/30 text-red-600 focus:ring-0"
                                    checked={formData.recusado}
                                    onChange={(e) => setFormData({...formData, recusado: e.target.checked})}
                                />
                                <label htmlFor="recusado" className="text-white font-bold cursor-pointer select-none">PRÊMIO RECUSADO PELO CLIENTE</label>
                            </div>

                            {!formData.recusado && (
                                <div>
                                    <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Bebida Escolhida</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                                        placeholder="Ex: Gin Tônica, Cerveja..."
                                        value={formData.bebida}
                                        onChange={(e) => setFormData({...formData, bebida: e.target.value})}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* 2. UMA VIDA */}
                    {selectedCategory === 'uma_vida' && (
                        <div>
                            <div className="flex bg-black/30 p-1 rounded-lg mb-4">
                                <button onClick={() => setUmaVidaTab('sem_cadastro')} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${umaVidaTab === 'sem_cadastro' ? 'bg-blue-600 text-white shadow' : 'text-text-muted hover:text-white'}`}>SEM CADASTRO</button>
                                <button onClick={() => setUmaVidaTab('com_cadastro')} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${umaVidaTab === 'com_cadastro' ? 'bg-blue-600 text-white shadow' : 'text-text-muted hover:text-white'}`}>JÁ POSSUI CADASTRO</button>
                            </div>

                            {umaVidaTab === 'sem_cadastro' ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Nome Completo</label>
                                        <input type="text" className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white focus:border-blue-500 outline-none" value={formData.nomeCliente} onChange={(e) => setFormData({...formData, nomeCliente: e.target.value})} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Dia de Preferência</label>
                                            <input type="text" className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white focus:border-blue-500 outline-none" placeholder="Ex: Sábado" value={formData.diaPreferencia} onChange={(e) => setFormData({...formData, diaPreferencia: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Email</label>
                                            <input type="email" className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white focus:border-blue-500 outline-none" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Código do Cliente (Code)</label>
                                            <input type="text" className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white focus:border-blue-500 outline-none font-mono tracking-widest text-center" value={formData.customerCode} onChange={(e) => setFormData({...formData, customerCode: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Data Preferência</label>
                                            <input type="date" className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white focus:border-blue-500 outline-none" value={formData.diaPreferencia} onChange={(e) => setFormData({...formData, diaPreferencia: e.target.value})} />
                                        </div>
                                    </div>
                                    <button disabled className="w-full bg-white/5 border border-white/10 text-white/30 py-3 rounded-lg font-bold cursor-not-allowed">GERAR CUPOM DE DESCONTO (EM BREVE)</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 3. DRINK ESPECIAL */}
                    {selectedCategory === 'drink_especial' && (
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Pulseira</label>
                                    <input type="text" className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white focus:border-blue-500 outline-none" value={formData.pulseira} onChange={(e) => setFormData({...formData, pulseira: e.target.value})} onBlur={(e) => fetchNomeCliente(e.target.value)} placeholder="Nº" />
                                </div>
                                <div className="flex-[2]">
                                    <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Nome do Cliente</label>
                                    <input type="text" className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white/50 cursor-not-allowed" value={loadingName ? "Buscando..." : formData.nomeCliente} readOnly />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Drink Escolhido</label>
                                <input type="text" className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white focus:border-blue-500 outline-none" value={formData.bebida} onChange={(e) => setFormData({...formData, bebida: e.target.value})} />
                            </div>
                        </div>
                    )}

                    {/* 4. PRÊMIO SURPRESA */}
                    {selectedCategory === 'premio_surpresa' && (
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Pulseira</label>
                                    <input type="text" className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white focus:border-blue-500 outline-none" value={formData.pulseira} onChange={(e) => setFormData({...formData, pulseira: e.target.value})} onBlur={(e) => fetchNomeCliente(e.target.value)} placeholder="Nº" />
                                </div>
                                <div className="flex-[2]">
                                    <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Nome do Cliente</label>
                                    <input type="text" className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white/50 cursor-not-allowed" value={loadingName ? "Buscando..." : formData.nomeCliente} readOnly />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Prêmio Sorteado/Escolhido</label>
                                <select 
                                    className="w-full bg-black border border-white/30 rounded-xl p-3 text-white focus:border-blue-500 outline-none cursor-pointer"
                                    value={formData.surpresaEscolhida}
                                    onChange={(e) => setFormData({...formData, surpresaEscolhida: e.target.value})}
                                >
                                    <option value="" className="bg-black text-gray-400">Selecione...</option>
                                    {SURPRISE_OPTIONS.map(opt => (
                                        <option key={opt} value={opt} className="bg-black text-white">{opt}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* 5. CONSUMO */}
                    {selectedCategory === 'consumo' && (
                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Pulseira</label>
                                    <input type="text" className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white focus:border-blue-500 outline-none" value={formData.pulseira} onChange={(e) => setFormData({...formData, pulseira: e.target.value})} onBlur={(e) => fetchNomeCliente(e.target.value)} placeholder="Nº" />
                                </div>
                                <div className="flex-[2]">
                                    <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Nome do Cliente</label>
                                    <input type="text" className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white/50 cursor-not-allowed" value={loadingName ? "Buscando..." : formData.nomeCliente} readOnly />
                                </div>
                            </div>
                            <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-6 text-center">
                                <h3 className="text-2xl font-bold text-green-400">R$ 50,00</h3>
                                <p className="text-white text-sm mt-1">Crédito em consumo liberado</p>
                            </div>
                        </div>
                    )}

                </div>
            )}

            {/* AÇÕES DO RODAPÉ */}
            <div className="mt-6 pt-4 border-t border-white/10 flex gap-4">
                <button onClick={onCancel} className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-bold transition-colors">CANCELAR</button>
                {selectedCategory && (
                    <button onClick={handleSave} className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-blue-900/30">
                        SALVAR RESGATE
                    </button>
                )}
            </div>
        </div>
    );
}