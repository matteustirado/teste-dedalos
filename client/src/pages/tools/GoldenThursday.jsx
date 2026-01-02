import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { toast } from 'react-toastify';
import axios from 'axios';
import GiftList from '../../components/GiftList';

const API_URL = 'http://localhost:4000';

const CONFIG = {
    sp: {
        name: 'São Paulo',
        totalLockers: 210,
        couponsToDraw: 50,
        apiUrl: "https://dedalosadm2-3dab78314381.herokuapp.com/api/entradasCheckout/",
        token: "7a9e64071564f6fee8d96cd209ed3a4e86801552",
        broken: [209],
        ranges: {
            M: [1, 2, 3, 4, 5, 6, 21, 22, 23, 24, 25, 26, 41, 42, 43, 44, 45, 46, 61, 62, 63, 64, 65, 66, 81, 82, 83, 84, 85, 86, 191, 192, 193, 194, 195, 196],
            G: [19, 20, 39, 40, 59, 60, 79, 80, 99, 100, 210],
            PP: { start: 101, end: 160 } 
        }
    },
    bh: {
        name: 'Belo Horizonte',
        totalLockers: 160,
        couponsToDraw: 15,
        apiUrl: "https://dedalosadm2bh-09d55dca461e.herokuapp.com/api/entradasCheckout/",
        token: "919d97d7df39ecbd0036631caba657221acab99d",
        broken: [17, 30, 36, 61],
        ranges: {
            M: [1, 2, 3, 4, 5, 6, 21, 22, 23, 24, 25, 26],
            G: [19, 20, 39, 40],
            PP: { start: 131, end: 160 } 
        }
    }
};

export default function GoldenThursday() {
    const { unidade } = useParams();
    const currentUnit = unidade ? unidade.toLowerCase() : 'sp';
    const config = CONFIG[currentUnit] || CONFIG.sp;

    // --- ESTADOS ---
    const [history, setHistory] = useState([]);
    
    // Estado do Sorteio Atual (Persistido localmente)
    const [currentDraw, setCurrentDraw] = useState(() => {
        try {
            const saved = localStorage.getItem(`dedalos_thursday_draw_${currentUnit}`);
            return saved ? JSON.parse(saved) : null;
        } catch(e) { return null; }
    });

    const [isMonitoring, setIsMonitoring] = useState(() => {
        return localStorage.getItem(`dedalos_thursday_monitoring_${currentUnit}`) === 'true';
    });

    const [occupiedLockers, setOccupiedLockers] = useState([]); 
    
    // Controles de Modais
    const [selectedLockerForPrize, setSelectedLockerForPrize] = useState(null); 
    const [showFinalizeModal, setShowFinalizeModal] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    
    // NOVO: Controle do Modal de Resgatados
    const [showRedeemedModal, setShowRedeemedModal] = useState(false);

    // --- CARREGAR HISTÓRICO ---
    const loadHistory = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/tools/history/${currentUnit.toUpperCase()}/QUINTA_PREMIADA`);
            setHistory(res.data);
        } catch (error) {
            console.error("Erro ao carregar histórico:", error);
        }
    };

    useEffect(() => { loadHistory(); }, [currentUnit]);

    useEffect(() => {
        if (currentDraw) localStorage.setItem(`dedalos_thursday_draw_${currentUnit}`, JSON.stringify(currentDraw));
        else localStorage.removeItem(`dedalos_thursday_draw_${currentUnit}`);
    }, [currentDraw, currentUnit]);

    useEffect(() => {
        localStorage.setItem(`dedalos_thursday_monitoring_${currentUnit}`, isMonitoring);
    }, [isMonitoring, currentUnit]);

    // --- LÓGICA DO SORTEIO ---
    const getLockerSize = (num) => {
        if (config.broken.includes(num)) return 'BROKEN';
        if (num >= config.ranges.PP.start && num <= config.ranges.PP.end) return 'PP';
        if (config.ranges.M.includes(num)) return 'M';
        if (config.ranges.G.includes(num)) return 'G';
        if (num > 0 && num <= config.totalLockers) return 'P';
        return 'UNKNOWN';
    };

    const handleNewDraw = async () => {
        if (currentDraw && !window.confirm("Existe um sorteio ativo. Deseja realmente cancelar e iniciar um novo?")) return;

        setIsMonitoring(false);
        const toastId = toast.loading("Consultando sistema de armários...");

        try {
            const response = await fetch(config.apiUrl, { headers: { "Authorization": `Token ${config.token}` } });
            if (response.status !== 200) throw new Error("Falha na API");
            
            const data = await response.json();
            const realOccupied = data.map(c => parseInt(c.armario)).filter(n => !isNaN(n));
            setOccupiedLockers(realOccupied);

            const available = { M: [], P: [], G: [] };
            for (let i = 1; i <= config.totalLockers; i++) {
                if (!realOccupied.includes(i)) {
                    const size = getLockerSize(i);
                    if (['M', 'P', 'G'].includes(size)) available[size].push(i);
                }
            }

            const totalAvailableCount = available.M.length + available.P.length + available.G.length;
            if (totalAvailableCount < config.couponsToDraw) {
                toast.update(toastId, { render: `Atenção: Apenas ${totalAvailableCount} armários livres!`, type: "warning", isLoading: false, autoClose: 5000 });
            } else {
                toast.update(toastId, { render: "Sorteio realizado!", type: "success", isLoading: false, autoClose: 3000 });
            }

            let drawResult = [];
            const targetTotal = Math.min(config.couponsToDraw, totalAvailableCount);
            
            ['M', 'P', 'G'].forEach(size => {
                const countSize = available[size].length;
                if (countSize === 0) return;
                let targetForSize = Math.floor((countSize / totalAvailableCount) * targetTotal);
                const shuffled = available[size].sort(() => 0.5 - Math.random());
                shuffled.slice(0, targetForSize).forEach(locker => drawResult.push({ locker, size, status: 'pending', prize: null, details: null }));
            });

            while (drawResult.length < targetTotal) {
                const allFree = [...available.M, ...available.P, ...available.G];
                const used = drawResult.map(d => d.locker);
                const remaining = allFree.filter(x => !used.includes(x));
                if (remaining.length === 0) break;
                const luckyOne = remaining[Math.floor(Math.random() * remaining.length)];
                drawResult.push({ locker: luckyOne, size: getLockerSize(luckyOne), status: 'pending', prize: null, details: null });
            }

            drawResult.sort((a, b) => a.locker - b.locker);
            setCurrentDraw(drawResult);
            setIsMonitoring(true);

        } catch (error) {
            console.error(error);
            toast.update(toastId, { render: "Erro ao conectar com API de armários.", type: "error", isLoading: false, autoClose: 5000 });
        }
    };

    // --- MONITORAMENTO ---
    useEffect(() => {
        let interval;
        if (isMonitoring && currentDraw) {
            const check = async () => {
                try {
                    const response = await fetch(config.apiUrl, { headers: { "Authorization": `Token ${config.token}` } });
                    const data = await response.json();
                    const currentOccupied = data.map(c => parseInt(c.armario)).filter(n => !isNaN(n));
                    setOccupiedLockers(currentOccupied);

                    setCurrentDraw(prevDraw => {
                        return prevDraw.map(item => {
                            if (item.status === 'redeemed') return item;
                            
                            const isNowOccupied = currentOccupied.includes(item.locker);

                            // Ocupado agora -> Verde
                            if (isNowOccupied) {
                                if (item.status !== 'occupied') return { ...item, status: 'occupied' };
                                return item;
                            }

                            // Estava ocupado e liberou -> Vermelho (Perdeu)
                            if (item.status === 'occupied' && !isNowOccupied) {
                                return { ...item, status: 'lost' };
                            }

                            // Já era vermelho -> Mantém
                            if (item.status === 'lost') return item;

                            // Nunca ocupou -> Pendente
                            return item;
                        });
                    });
                } catch (e) { console.error("Erro polling", e); }
            };
            check();
            interval = setInterval(check, 5000);
        }
        return () => clearInterval(interval);
    }, [isMonitoring, config.apiUrl, config.token]); 

    // --- FINALIZAÇÃO ---
    const handleRequestFinalize = () => {
        if (!currentDraw) return;
        setShowFinalizeModal(true);
    };

    const confirmFinalize = async () => {
        setIsFinalizing(true);
        const redeemedCount = currentDraw.filter(i => i.status === 'redeemed').length;
        
        const payload = {
            tipo: 'QUINTA_PREMIADA',
            unidade: currentUnit.toUpperCase(),
            total_sorteados: currentDraw.length,
            total_resgatados: redeemedCount,
            detalhes: currentDraw
        };

        try {
            await axios.post(`${API_URL}/api/tools/history`, payload);
            toast.success("Promoção finalizada e salva no histórico!");
        } catch (error) {
            console.error("Erro ao salvar:", error);
            toast.warning("Finalizado localmente. Falha ao salvar no histórico do servidor.");
        } finally {
            setCurrentDraw(null);
            setIsMonitoring(false);
            setShowFinalizeModal(false);
            setIsFinalizing(false);
            loadHistory();
        }
    };

    // --- MANIPULADORES DE CLICK ---
    const handleLockerClick = (item) => {
        if (item.status === 'occupied') {
            setSelectedLockerForPrize(item);
        } else if (item.status === 'redeemed') {
            toast.info(`Resgatado: ${item.prize}`);
        } else if (item.status === 'lost') {
            toast.error("Cliente saiu sem resgatar! Retire o cupom.");
        } else {
            toast.info("Aguardando cliente...");
        }
    };

    const handleGiftConfirm = (prizeName, detailsString) => {
        if (!selectedLockerForPrize) return;
        setCurrentDraw(prev => prev.map(item => {
            if (item.locker === selectedLockerForPrize.locker) {
                return { ...item, status: 'redeemed', prize: prizeName, details: detailsString };
            }
            return item;
        }));
        setSelectedLockerForPrize(null);
        toast.success("Resgate salvo com sucesso!");
    };

    // --- IMPRESSÃO DETALHADA ---
    const handlePrint = () => {
        if (!currentDraw) return;
        
        // Filtra apenas os resgatados para o relatório
        const redeemedItems = currentDraw.filter(i => i.status === 'redeemed');

        const printWindow = window.open('', '', 'height=800,width=900');
        printWindow.document.write('<html><head><title>Relatório de Resgates - Quinta Premiada</title>');
        printWindow.document.write('<style>');
        printWindow.document.write(`
            body { font-family: 'Courier New', Courier, monospace; padding: 20px; color: #000; }
            h1 { text-align: center; font-size: 1.5em; margin-bottom: 5px; }
            h2 { text-align: center; font-size: 1em; margin-top: 0; border-bottom: 2px dashed #000; padding-bottom: 10px; }
            .summary { text-align: right; margin-bottom: 20px; font-weight: bold; }
            .item { border-bottom: 1px dashed #ccc; padding: 10px 0; display: flex; flex-direction: column; gap: 4px; page-break-inside: avoid; }
            .item-header { display: flex; justify-content: space-between; align-items: center; }
            .locker { font-size: 1.3em; font-weight: bold; }
            .prize { font-weight: bold; text-transform: uppercase; }
            .details { font-size: 0.9em; color: #333; margin-left: 10px; border-left: 2px solid #ccc; padding-left: 8px; }
            .footer { margin-top: 30px; text-align: center; font-size: 0.8em; border-top: 2px dashed #000; padding-top: 10px; }
        `);
        printWindow.document.write('</style></head><body>');
        
        printWindow.document.write(`<h1>${config.name}</h1>`);
        printWindow.document.write(`<h2>RELATÓRIO DE PREMIAÇÕES</h2>`);
        
        printWindow.document.write(`<div class="summary">`);
        printWindow.document.write(`DATA: ${new Date().toLocaleString()}<br/>`);
        printWindow.document.write(`TOTAL RESGATADO: ${redeemedItems.length}`);
        printWindow.document.write(`</div>`);
        
        if (redeemedItems.length === 0) {
            printWindow.document.write('<p style="text-align:center; margin-top:50px;">Nenhum prêmio foi resgatado neste sorteio.</p>');
        } else {
            redeemedItems.forEach(item => {
                // Formata os detalhes para quebra de linha visual na impressão
                const formattedDetails = item.details ? item.details.replace(/ \| /g, '<br/>') : 'Sem detalhes adicionais';
                
                printWindow.document.write('<div class="item">');
                printWindow.document.write('<div class="item-header">');
                printWindow.document.write(`<span class="locker">Armário ${item.locker} <small>(${item.size})</small></span>`);
                printWindow.document.write(`<span class="prize">${item.prize}</span>`);
                printWindow.document.write('</div>');
                printWindow.document.write(`<div class="details">${formattedDetails}</div>`);
                printWindow.document.write('</div>');
            });
        }
        
        printWindow.document.write('<div class="footer">DEDALOS BAR - QUINTA PREMIADA</div>');
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
    };

    return (
        <div className="min-h-screen bg-gradient-warm flex">
            <Sidebar activePage="thursday" headerTitle="Quinta Premiada" headerIcon="stars" group="maintenance" unit={currentUnit} />

            <main className="ml-64 flex-1 p-8 h-screen overflow-hidden flex flex-col">
                {/* HEADER */}
                <div className="flex justify-between items-center mb-8 flex-shrink-0">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-1">Quinta Premiada</h1>
                        <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-widest ${currentUnit === 'sp' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                {config.name}
                            </span>
                            {isMonitoring && <span className="flex items-center gap-2 text-green-400 text-xs font-bold animate-pulse"><span className="w-2 h-2 bg-green-500 rounded-full"></span> MONITORANDO ARMÁRIOS EM TEMPO REAL</span>}
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <button 
                            onClick={handlePrint} 
                            disabled={!currentDraw} 
                            className="bg-white/10 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined">print</span> IMPRIMIR
                        </button>
                        
                        {/* NOVO BOTÃO DE RESGATADOS */}
                        <button 
                            onClick={() => setShowRedeemedModal(true)} 
                            disabled={!currentDraw} 
                            className="bg-purple-600/80 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-600 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined">emoji_events</span> RESGATADOS
                        </button>

                        <button 
                            onClick={handleNewDraw} 
                            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-500 transition-colors shadow-lg flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined">casino</span> NOVO SORTEIO
                        </button>
                    </div>
                </div>

                {/* CORPO */}
                <div className="grid grid-cols-12 gap-8 flex-1 min-h-0">
                    {/* HISTÓRICO */}
                    <div className="col-span-4 liquid-glass rounded-3xl p-6 flex flex-col min-h-0">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-white/50">history</span> Histórico</h2>
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                            {history.length === 0 && <p className="text-white/30 text-sm text-center mt-10">Nenhum histórico recente.</p>}
                            {history.map(h => (
                                <div key={h.id} className="bg-white/5 p-4 rounded-xl border border-white/5 hover:bg-white/10 transition-colors cursor-pointer group">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="text-white font-bold text-sm">{new Date(h.data_hora).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}</p>
                                        <span className="text-xs text-white/50 bg-black/20 px-2 py-0.5 rounded">{h.total_sorteados} cupons</span>
                                    </div>
                                    <div className="flex items-center gap-2"><span className="material-symbols-outlined text-green-400 text-base">check_circle</span><p className="text-sm text-green-100">{h.total_resgatados} resgatados</p></div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* SORTEIO */}
                    <div className="col-span-8 liquid-glass rounded-3xl p-8 flex flex-col min-h-0 relative overflow-hidden">
                        {!currentDraw ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-white/20"><span className="material-symbols-outlined text-8xl mb-4">stars</span><p className="text-xl font-medium uppercase tracking-widest">Aguardando Sorteio</p></div>
                        ) : (
                            <>
                                <div className="grid grid-cols-10 gap-2 overflow-hidden content-start pb-4">
                                    {currentDraw.map((item) => {
                                        let cardClass = "bg-white/5 border-white/10 text-white hover:bg-white/10"; 
                                        let icon = null;
                                        if (item.status === 'occupied') { 
                                            cardClass = "bg-green-600 border-green-400 text-white animate-pulse shadow-[0_0_15px_rgba(34,197,94,0.5)] scale-105"; 
                                            icon = "person"; 
                                        } else if (item.status === 'lost') {
                                            cardClass = "bg-red-900/80 border-red-500 text-red-100"; 
                                            icon = "priority_high";
                                        } else if (item.status === 'redeemed') { 
                                            cardClass = "bg-purple-600 border-purple-400 text-white opacity-60"; 
                                            icon = "emoji_events"; 
                                        }
                                        return (
                                            <div key={item.locker} onClick={() => handleLockerClick(item)} className={`aspect-square rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all relative ${cardClass} p-1`}>
                                                <span className="text-xl font-bold">{item.locker}</span>
                                                <span className="text-[10px] font-bold uppercase opacity-80">{item.size}</span>
                                                {icon && <span className="material-symbols-outlined absolute top-1 right-1 text-xs">{icon}</span>}
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="mt-auto pt-4 border-t border-white/10 flex justify-end">
                                    <button onClick={handleRequestFinalize} className="bg-red-600/80 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-600 transition-colors text-sm flex items-center gap-2"><span className="material-symbols-outlined">stop_circle</span> FINALIZAR PROMOÇÃO</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </main>

            {/* MODAL DE RESGATE DE PRÊMIOS (INPUT) */}
            {selectedLockerForPrize && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <GiftList lockerNumber={selectedLockerForPrize.locker} onCancel={() => setSelectedLockerForPrize(null)} onConfirm={handleGiftConfirm} />
                </div>
            )}

            {/* MODAL LISTA DE RESGATADOS (VISUALIZAÇÃO) */}
            {showRedeemedModal && currentDraw && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-6 max-w-3xl w-full shadow-2xl relative flex flex-col max-h-[80vh]">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                <span className="bg-purple-600 text-white text-sm px-3 py-1 rounded-full">
                                    {currentDraw.filter(i => i.status === 'redeemed').length}
                                </span>
                                Prêmios Resgatados
                            </h2>
                            <button onClick={() => setShowRedeemedModal(false)} className="text-white/50 hover:text-white"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                            {currentDraw.filter(i => i.status === 'redeemed').length === 0 ? (
                                <div className="text-center py-10 text-white/30">
                                    <span className="material-symbols-outlined text-4xl mb-2">inbox</span>
                                    <p>Nenhum prêmio resgatado ainda.</p>
                                </div>
                            ) : (
                                currentDraw.filter(i => i.status === 'redeemed').map(item => (
                                    <div key={item.locker} className="bg-white/5 p-4 rounded-xl border border-white/5 flex gap-4 items-center">
                                        <div className="bg-purple-600/20 text-purple-400 w-16 h-16 rounded-lg flex flex-col items-center justify-center flex-shrink-0 border border-purple-600/30">
                                            <span className="text-xs font-bold uppercase">Armário</span>
                                            <span className="text-2xl font-bold">{item.locker}</span>
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-white font-bold text-lg mb-1">{item.prize}</h3>
                                            <div className="flex flex-col gap-1 text-sm text-text-muted">
                                                {/* Exibe os detalhes quebrando a string onde tiver | */}
                                                {item.details && item.details.split(' | ').map((detail, idx) => (
                                                    <span key={idx} className="block">• {detail.trim()}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE FINALIZAÇÃO */}
            {showFinalizeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
                    <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl relative text-center">
                        <div className="w-16 h-16 rounded-full bg-red-600/20 flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-red-500 text-4xl">warning</span>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Finalizar Promoção?</h2>
                        <p className="text-text-muted mb-8">
                            Isso encerrará o sorteio atual e salvará os resultados no histórico. <br/>
                            <span className="text-red-400 font-bold block mt-2">Esta ação não pode ser desfeita.</span>
                        </p>
                        
                        <div className="flex gap-4">
                            <button onClick={() => setShowFinalizeModal(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-bold transition-colors">CANCELAR</button>
                            <button onClick={confirmFinalize} disabled={isFinalizing} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-red-900/30 flex items-center justify-center gap-2">
                                {isFinalizing ? <span className="material-symbols-outlined animate-spin">refresh</span> : 'FINALIZAR'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}