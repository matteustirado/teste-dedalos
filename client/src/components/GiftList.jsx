import React, { useState } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
// Certifique-se que o caminho do SVG está correto
import LogoDedalos from '../assets/SVG/logoDedalos'; 

// Configurações de API
const API_CONFIG = {
    sp: {
        baseUrl: "https://dedalosadm2-3dab78314381.herokuapp.com/",
        couponsUrl: "https://dedalosadm2-3dab78314381.herokuapp.com/api/cupons/",
        token: "7a9e64071564f6fee8d96cd209ed3a4e86801552",
        local: "SP"
    },
    bh: {
        baseUrl: "https://dedalosadm2bh-09d55dca461e.herokuapp.com/",
        couponsUrl: "https://dedalosadm2bh-09d55dca461e.herokuapp.com/api/cupons/",
        token: "919d97d7df39ecbd0036631caba657221acab99d",
        local: "BH"
    }
};

const PRIZE_CATEGORIES = [
    { id: 'rodada_dupla', label: 'Rodada Dupla', icon: 'local_bar' },
    { id: 'uma_vida', label: 'Uma Vida', icon: 'confirmation_number' },
    { id: 'drink_especial', label: 'Drink Especial', icon: 'wine_bar' },
    { id: 'premio_surpresa', label: 'Prêmio Surpresa', icon: 'redeem' },
    { id: 'consumo', label: 'R$ Consumo', icon: 'attach_money' },
];

const SURPRISE_OPTIONS = ['Halls', 'RedBull', 'Salgadinho', 'Caipinossa', 'Double Tequila'];

const SORTEADOR_QUINTA_PREMIADA = 11;

export default function GiftList({ lockerNumber, onCancel, onConfirm, unit = 'sp' }) {
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [umaVidaTab, setUmaVidaTab] = useState('sem_cadastro');
    const [loadingName, setLoadingName] = useState(false);
    const [generatingCoupon, setGeneratingCoupon] = useState(false);
    
    // Estado para guardar os dados do cupom gerado
    const [generatedCouponData, setGeneratedCouponData] = useState(null);

    const [formData, setFormData] = useState({
        pulseira: '',
        nomeCliente: '',
        bebida: '',
        recusado: false,
        diaPreferencia: '',
        email: '',
        surpresaEscolhida: '',
        cupomGeradoLink: ''
    });

    const currentConfig = API_CONFIG[unit.toLowerCase()] || API_CONFIG.sp;

    // --- 1. BUSCAR NOME PELA PULSEIRA ---
    const fetchNomeCliente = async (pulseira) => {
        if (!pulseira) return;
        
        setLoadingName(true);
        setFormData(prev => ({ ...prev, nomeCliente: "Buscando..." }));

        try {
            const endpoint = `${currentConfig.baseUrl}api/entradasOne/${pulseira}/`;
            const response = await axios.get(endpoint, {
                headers: { 
                    "Authorization": `Token ${currentConfig.token}`,
                    "Content-Type": "application/json"
                }
            });

            const data = response.data;
            const nomeEncontrado = data.nome || data.name || data.nome_cliente || data.cliente || "Nome não identificado";
            setFormData(prev => ({ ...prev, nomeCliente: nomeEncontrado }));

        } catch (error) {
            console.error("Erro ao buscar cliente:", error);
            if (error.response && error.response.status === 404) {
                setFormData(prev => ({ ...prev, nomeCliente: "Não encontrado" }));
                toast.warning("Pulseira não encontrada.");
            } else {
                setFormData(prev => ({ ...prev, nomeCliente: "Erro na busca" }));
            }
        } finally {
            setLoadingName(false);
        }
    };

    // --- 2. GERAR CUPOM "CAMALEÃO" ---
    const handleGerarCupom = async () => {
        if (!formData.diaPreferencia) return toast.warning("Selecione a Data de Preferência.");
        if (!formData.nomeCliente || formData.nomeCliente === "Buscando..." || formData.nomeCliente === "Não encontrado") {
            return toast.warning("É necessário identificar o cliente pela pulseira primeiro.");
        }

        setGeneratingCoupon(true);
        const dataFormatada = `${formData.diaPreferencia}T00:00:00`;

        const payload = {
            "tipoCupom": SORTEADOR_QUINTA_PREMIADA, 
            "nome": formData.nomeCliente, 
            "idUser": 1, 
            "local": currentConfig.local, 
            "tipo": "Quinta Premiada", 
            "descontos": "Cupom Premiado", 
            "regra1": "Uso único", "desconto1": "0.00", 
            "regra2": "das 00:00 às 23:59 do dia escolhido", "desconto2": "",
            "regra3": "Cupom intransferível", "desconto3": "",
            "regra4": "", "desconto4": "",
            "regra5": "", "desconto5": "",
            "regra6": null, "desconto6": null,
            "agendado": dataFormatada,
            "dia": [1, 2, 3, 4, 5, 6, 7], 
            "ativo": true, "novo": true, 
            "codigo": "", "nome_amigo": "", "nome_amigo2": "",
            "valor": 0, "homenageado": false, "quarta_top": false, 
            "mao_amiga": false, "signo": false
        };

        try {
            const response = await axios.post(currentConfig.couponsUrl, payload, {
                headers: { 
                    "Authorization": `Token ${currentConfig.token}`,
                    "Content-Type": "application/json"
                }
            });

            if (response.status === 201 || response.status === 200) {
                const link = `https://dedalosbar.com.br/vips/${response.data.id}`;
                setFormData(prev => ({ ...prev, cupomGeradoLink: link }));
                
                setGeneratedCouponData({
                    id: response.data.id,
                    nome: formData.nomeCliente,
                    data: formData.diaPreferencia,
                    link: link
                });

                toast.success("Cupom Quinta Premiada gerado!");
            }
        } catch (error) {
            console.error("Erro ao gerar cupom:", error);
            const msgErro = error.response?.data?.detail || "Falha ao gerar cupom.";
            toast.error(msgErro);
        } finally {
            setGeneratingCoupon(false);
        }
    };

    const handleSave = () => {
        if (!selectedCategory) return;
        let prizeLabel = PRIZE_CATEGORIES.find(c => c.id === selectedCategory).label;
        let detailsString = '';

        switch (selectedCategory) {
            case 'rodada_dupla':
                if (formData.recusado) {
                    detailsString = `Recusado pelo cliente ${formData.nomeCliente || '(Sem Nome)'} (Pulseira: ${formData.pulseira})`;
                } else {
                    if (!formData.bebida) return toast.warning("Informe a bebida escolhida.");
                    detailsString = `Bebida: ${formData.bebida} | Cliente: ${formData.nomeCliente} (Pulseira: ${formData.pulseira})`;
                }
                break;
            case 'uma_vida':
                if (!formData.diaPreferencia) return toast.warning("Selecione a Data de Preferência.");
                const dataPtBr = new Date(formData.diaPreferencia).toLocaleDateString('pt-BR', {timeZone: 'UTC'});

                if (umaVidaTab === 'sem_cadastro') {
                    if (!formData.nomeCliente) return toast.warning("Preencha o nome.");
                    detailsString = `Uma Vida (Sem Cadastro) | Nome: ${formData.nomeCliente} | Data: ${dataPtBr} | Email: ${formData.email}`;
                } else {
                    if (!generatedCouponData) {
                        if(!window.confirm("O cupom ainda não foi gerado. Deseja salvar mesmo assim?")) return;
                        detailsString = `Uma Vida (Gerar Cupom) | Cliente: ${formData.nomeCliente} | Data: ${dataPtBr} | (Cupom não gerado)`;
                    } else {
                        detailsString = `Uma Vida (Cupom Gerado) | Cliente: ${formData.nomeCliente} | Data: ${dataPtBr} | Link: ${generatedCouponData.link}`;
                    }
                }
                break;
            case 'drink_especial':
                if (!formData.bebida) return toast.warning("Informe o drink.");
                detailsString = `Drink: ${formData.bebida} | Cliente: ${formData.nomeCliente} (Pulseira: ${formData.pulseira})`;
                break;
            case 'premio_surpresa':
                if (!formData.surpresaEscolhida) return toast.warning("Selecione o prêmio.");
                prizeLabel = `Surpresa: ${formData.surpresaEscolhida}`;
                detailsString = `Ganhou: ${formData.surpresaEscolhida} | Cliente: ${formData.nomeCliente} (Pulseira: ${formData.pulseira})`;
                break;
            case 'consumo':
                detailsString = `R$50 Consumo | Cliente: ${formData.nomeCliente} (Pulseira: ${formData.pulseira})`;
                break;
            default: return;
        }

        onConfirm(prizeLabel, detailsString);
    };

    const resetForm = () => {
        setSelectedCategory(null);
        setGeneratedCouponData(null);
        setFormData({ pulseira: '', nomeCliente: '', bebida: '', recusado: false, diaPreferencia: '', email: '', surpresaEscolhida: '', cupomGeradoLink: '' });
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
                    <p className="text-text-muted text-sm mt-1">Selecione o prêmio para liberar o resgate.</p>
                </div>
                {selectedCategory && (
                    <button onClick={resetForm} className="text-sm text-blue-400 hover:text-blue-300 font-bold">
                        ALTERAR CATEGORIA
                    </button>
                )}
            </div>

            {/* SELEÇÃO DE CATEGORIA */}
            {!selectedCategory ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {PRIZE_CATEGORIES.map(cat => (
                        <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className="bg-white/5 hover:bg-blue-600 hover:scale-105 transition-all p-6 rounded-2xl border border-white/10 flex flex-col items-center gap-3 group">
                            <span className="material-symbols-outlined text-4xl text-white/70 group-hover:text-white">{cat.icon}</span>
                            <span className="text-white font-bold uppercase tracking-wide text-sm">{cat.label}</span>
                        </button>
                    ))}
                </div>
            ) : (
                /* FORMULÁRIOS */
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    
                    {/* INPUTS DE PULSEIRA (Comuns) */}
                    {(selectedCategory === 'rodada_dupla' || selectedCategory === 'drink_especial' || selectedCategory === 'premio_surpresa' || selectedCategory === 'consumo') && (
                        <div className="space-y-4 mb-4">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Pulseira</label>
                                    <input 
                                        type="number" 
                                        className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                                        value={formData.pulseira}
                                        onChange={(e) => setFormData({...formData, pulseira: e.target.value})}
                                        onBlur={(e) => fetchNomeCliente(e.target.value)}
                                        placeholder="Nº"
                                        disabled={formData.recusado || loadingName}
                                    />
                                </div>
                                <div className="flex-[2]">
                                    <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Nome do Cliente</label>
                                    <input type="text" className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white/50 cursor-not-allowed" value={loadingName ? "Buscando..." : formData.nomeCliente} readOnly />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 1. RODADA DUPLA */}
                    {selectedCategory === 'rodada_dupla' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 py-2">
                                <input type="checkbox" id="recusado" className="w-5 h-5 rounded border-white/20 bg-black/30 text-red-600 focus:ring-0" checked={formData.recusado} onChange={(e) => setFormData({...formData, recusado: e.target.checked})} />
                                <label htmlFor="recusado" className="text-white font-bold cursor-pointer select-none">PRÊMIO RECUSADO PELO CLIENTE</label>
                            </div>
                            {!formData.recusado && (
                                <div>
                                    <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Bebida Escolhida</label>
                                    <input type="text" className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white focus:border-blue-500 outline-none" placeholder="Ex: Gin Tônica" value={formData.bebida} onChange={(e) => setFormData({...formData, bebida: e.target.value})} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* 2. UMA VIDA */}
                    {selectedCategory === 'uma_vida' && (
                        <div>
                            <div className="flex bg-black/30 p-1 rounded-lg mb-4">
                                <button onClick={() => setUmaVidaTab('sem_cadastro')} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${umaVidaTab === 'sem_cadastro' ? 'bg-blue-600 text-white shadow' : 'text-text-muted hover:text-white'}`}>SEM CADASTRO</button>
                                <button onClick={() => setUmaVidaTab('com_cadastro')} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${umaVidaTab === 'com_cadastro' ? 'bg-blue-600 text-white shadow' : 'text-text-muted hover:text-white'}`}>GERAR CUPOM</button>
                            </div>

                            {umaVidaTab === 'sem_cadastro' ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Nome Completo</label>
                                        <input type="text" className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white focus:border-blue-500 outline-none" value={formData.nomeCliente} onChange={(e) => setFormData({...formData, nomeCliente: e.target.value})} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Data de Preferência</label>
                                            <input type="date" className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white focus:border-blue-500 outline-none" value={formData.diaPreferencia} onChange={(e) => setFormData({...formData, diaPreferencia: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Email</label>
                                            <input type="email" className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white focus:border-blue-500 outline-none" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {generatedCouponData ? (
                                        <div className="relative overflow-hidden bg-gradient-to-br from-[#1a1a1a] to-black border border-yellow-600/50 rounded-2xl p-6 shadow-[0_0_30px_rgba(234,179,8,0.1)] group">
                                            
                                            {/* MARCA D'ÁGUA REPETIDA EM DIAGONAL */}
                                            <div className="absolute inset-0 overflow-hidden opacity-[0.03] pointer-events-none">
                                                <div className="flex flex-wrap w-[200%] h-[200%] -ml-20 -mt-20 rotate-12">
                                                    {Array.from({ length: 30 }).map((_, index) => (
                                                        <div key={index} className="m-6">
                                                            <LogoDedalos className="w-24 h-24 text-yellow-600" />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="relative z-10 flex flex-col items-center text-center space-y-3">
                                                <div className="w-12 h-1 bg-yellow-600 rounded-full mb-2"></div>
                                                <h3 className="text-yellow-500 font-bold tracking-[0.2em] text-sm uppercase">Quinta Premiada</h3>
                                                
                                                <div className="py-2">
                                                    <h2 className="text-4xl font-black text-white tracking-wider font-mono">
                                                        #{generatedCouponData.id}
                                                    </h2>
                                                    <p className="text-xs text-yellow-600/70 mt-1 uppercase font-bold">Código VIP</p>
                                                </div>

                                                <div className="w-full border-t border-white/10 my-2"></div>

                                                <div className="w-full grid grid-cols-2 gap-4 text-left">
                                                    <div>
                                                        <p className="text-[10px] text-text-muted uppercase font-bold">Beneficiário</p>
                                                        <p className="text-white font-bold truncate text-sm">{generatedCouponData.nome}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] text-text-muted uppercase font-bold">Data Agendada</p>
                                                        <p className="text-white font-bold text-sm">
                                                            {new Date(generatedCouponData.data).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                                                        </p>
                                                    </div>
                                                </div>

                                                <a 
                                                    href={generatedCouponData.link} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="mt-4 w-full bg-yellow-600 hover:bg-yellow-500 text-black font-black py-3 rounded-lg uppercase tracking-wider text-xs transition-colors shadow-lg shadow-yellow-900/20"
                                                >
                                                    Abrir Cupom Digital
                                                </a>
                                            </div>
                                        </div>
                                    ) : (
                                        /* FORMULÁRIO DE GERAÇÃO */
                                        <>
                                            <div className="flex gap-4">
                                                <div className="flex-1">
                                                    <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Pulseira (Atual)</label>
                                                    <input 
                                                        type="number" 
                                                        className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                                                        value={formData.pulseira}
                                                        onChange={(e) => setFormData({...formData, pulseira: e.target.value})}
                                                        onBlur={(e) => fetchNomeCliente(e.target.value)}
                                                        placeholder="Nº"
                                                    />
                                                </div>
                                                <div className="flex-[2]">
                                                    <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Nome Identificado</label>
                                                    <input 
                                                        type="text" 
                                                        className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white/50 cursor-not-allowed"
                                                        value={formData.nomeCliente || "Digite a pulseira..."}
                                                        readOnly
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Data do Cupom</label>
                                                <input 
                                                    type="date" 
                                                    className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white focus:border-blue-500 outline-none" 
                                                    value={formData.diaPreferencia} 
                                                    onChange={(e) => setFormData({...formData, diaPreferencia: e.target.value})} 
                                                />
                                            </div>
                                            
                                            <button 
                                                onClick={handleGerarCupom}
                                                disabled={generatingCoupon || !formData.diaPreferencia}
                                                className="w-full bg-blue-600/20 border border-blue-500/50 hover:bg-blue-600 text-blue-100 py-3 rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {generatingCoupon ? <span className="material-symbols-outlined animate-spin">refresh</span> : <span className="material-symbols-outlined">confirmation_number</span>}
                                                GERAR CUPOM QUINTA PREMIADA
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 3. DRINK ESPECIAL */}
                    {selectedCategory === 'drink_especial' && (
                        <div>
                            <label className="block text-xs text-text-muted mb-1 uppercase font-bold">Drink Escolhido</label>
                            <input type="text" className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white focus:border-blue-500 outline-none" value={formData.bebida} onChange={(e) => setFormData({...formData, bebida: e.target.value})} />
                        </div>
                    )}

                    {/* 4. PRÊMIO SURPRESA */}
                    {selectedCategory === 'premio_surpresa' && (
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
                    )}

                    {/* 5. CONSUMO */}
                    {selectedCategory === 'consumo' && (
                        <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-6 text-center">
                            <h3 className="text-2xl font-bold text-green-400">R$ 50,00</h3>
                            <p className="text-white text-sm mt-1">Crédito em consumo liberado</p>
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