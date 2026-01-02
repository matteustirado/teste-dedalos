import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';

const LOCAL_API_URL = 'http://localhost:4000';

// Endereços dos servidores LEGADOS que emitem o sinal da pulseira
const EXTERNAL_SOCKETS = {
    sp: 'https://placar-80b3f72889ba.herokuapp.com/',
    bh: 'https://placarbh-cf51a4a5b78a.herokuapp.com/'
};

export default function ScoreboardGame() {
    const { unidade } = useParams();
    const currentUnit = unidade ? unidade.toLowerCase() : 'sp';

    // --- ESTADOS ---
    const [config, setConfig] = useState(null);
    const [viewState, setViewState] = useState('idle'); // 'idle' | 'voting' | 'success'
    const [votedOption, setVotedOption] = useState(null);
    const [loading, setLoading] = useState(true);

    // --- REFS PARA TEMPORIZADORES ---
    const idleTimerRef = useRef(null);
    const successTimerRef = useRef(null);

    // --- FUNÇÕES AUXILIARES DE FLUXO ---
    
    const clearTimers = () => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };

    const startVotingSession = () => {
        console.log("Iniciando Sessão de Votação...");
        clearTimers(); // Limpa timers anteriores
        
        setViewState('voting');

        // REGRA 1: Se não votar em 20 segundos, volta para Idle
        idleTimerRef.current = setTimeout(() => {
            console.log("Tempo esgotado. Voltando para descanso.");
            setViewState('idle');
        }, 20000);
    };

    // --- EFEITOS (CONEXÕES E CARREGAMENTO) ---
    useEffect(() => {
        // 1. Busca configuração inicial
        fetchConfig();

        // ---------------------------------------------------------
        // CONEXÃO 1: BACKEND LOCAL (Para Config e Envio de Votos)
        // ---------------------------------------------------------
        const localSocket = io(LOCAL_API_URL);
        
        localSocket.on('connect', () => console.log("[LOCAL] Conectado ao Backend Novo"));

        // Se o admin mudar o placar na sala de controle, atualiza aqui
        localSocket.on('scoreboard:config_updated', (data) => {
            if (data.unidade === currentUnit.toUpperCase()) {
                console.log("[LOCAL] Configuração atualizada pelo Admin");
                fetchConfig();
            }
        });

        // ---------------------------------------------------------
        // CONEXÃO 2: SERVIDOR EXTERNO (O GATILHO DA PULSEIRA)
        // ---------------------------------------------------------
        const externalUrl = EXTERNAL_SOCKETS[currentUnit] || EXTERNAL_SOCKETS.sp;
        console.log(`[EXTERNO] Tentando conectar em: ${externalUrl}`);
        
        const externalSocket = io(externalUrl, {
            transports: ['websocket', 'polling'], // Garante compatibilidade
            reconnection: true,
            reconnectionAttempts: Infinity,
        });

        externalSocket.on('connect', () => {
            console.log(`[EXTERNO] CONECTADO AO SERVIDOR DE CHECK-IN (${currentUnit.toUpperCase()})`);
        });

        externalSocket.on('connect_error', (err) => {
            console.error('[EXTERNO] Erro de conexão:', err.message);
        });
        
        // O EVENTO MÁGICO: 'new_id'
        externalSocket.on('new_id', (data) => {
            console.log('⚡ GATILHO "new_id" RECEBIDO!', data);
            
            // Verifica se já não estamos votando
            setViewState(currentState => {
                if (currentState === 'idle' || currentState === 'success') {
                    startVotingSession(); // Dispara a tela de votação
                    return 'voting';
                }
                return currentState;
            });
        });

        // Cleanup ao desmontar
        return () => {
            localSocket.disconnect();
            externalSocket.disconnect();
            clearTimers();
        };
    }, [currentUnit]);

    const fetchConfig = async () => {
        try {
            const res = await axios.get(`${LOCAL_API_URL}/api/scoreboard/active/${currentUnit}`);
            setConfig(res.data);
            setLoading(false);
        } catch (error) {
            console.error("Erro ao buscar config:", error);
        }
    };

    // --- AÇÕES DO USUÁRIO ---

    const handleVote = async (index, optionName) => {
        if (navigator.vibrate) navigator.vibrate(50); // Feedback tátil

        // Usuário votou, cancela o timer de inatividade
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

        try {
            // Envia o voto para o SEU BACKEND NOVO
            await axios.post(`${LOCAL_API_URL}/api/scoreboard/vote`, {
                unidade: currentUnit,
                optionIndex: index
            });

            setVotedOption(optionName);
            setViewState('success');

            // REGRA 2: Tela de sucesso por 5 segundos
            successTimerRef.current = setTimeout(() => {
                setViewState('idle');
                setVotedOption(null);
            }, 5000);

        } catch (error) {
            console.error("Erro ao votar:", error);
            // Fallback em caso de erro
            setTimeout(() => setViewState('idle'), 2000);
        }
    };

    // --- RENDERIZAÇÃO ---

    if (loading) return <div className="min-h-screen bg-black" />;

    const gridCols = config?.opcoes.length <= 2 ? 'grid-cols-1' : 'grid-cols-2';

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans overflow-hidden relative selection:bg-none flex items-center justify-center p-6 md:p-8">
            
            {/* AMBIENTE DE LUZ (FUNDO) */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-20%] w-[800px] h-[800px] bg-orange-600/10 rounded-full blur-[120px] animate-float-slow"></div>
                <div className="absolute bottom-[-20%] right-[-20%] w-[600px] h-[600px] bg-yellow-500/5 rounded-full blur-[100px] animate-float-reverse"></div>
            </div>

            {/* MOLDURA PRINCIPAL */}
            <main className="relative z-10 w-full max-w-[600px] h-[85vh] bg-black/60 backdrop-blur-md rounded-[2.5rem] border-[3px] border-transparent bg-clip-padding flex flex-col shadow-2xl"
                  style={{ borderImage: 'linear-gradient(135deg, #ff4d00, #ffcc00) 1', borderRadius: '2.5rem' }}>
                
                {/* --- TELA 1: IDLE (ESPERA) --- */}
                {viewState === 'idle' && (
                    <div className="flex-1 flex flex-col justify-between p-8 text-center animate-fade-in h-full">
                        
                        {/* TOPO: Título */}
                        <div className="mt-8">
                            <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-yellow-400 mb-2 drop-shadow-sm tracking-tight">
                                OLÁ, PLAYER!
                            </h1>
                            <p className="text-lg text-gray-400 font-medium tracking-wide">
                                Pronto para subir de nível?
                            </p>
                        </div>

                        {/* MEIO: Logo e Texto "Aguardando" */}
                        <div className="flex flex-col items-center justify-center">
                            <p className="text-gray-500 text-sm md:text-base mb-6 animate-pulse italic tracking-widest uppercase">
                                ...aguardando o próximo movimento...
                            </p>
                            
                            {/* SVG ANIMADO DO LOGO */}
                            <svg className="w-56 h-auto drop-shadow-[0_0_20px_rgba(255,77,0,0.4)]" viewBox="0 0 600 485" xmlns="http://www.w3.org/2000/svg">
                                <defs>
                                    <linearGradient id="logo-gradient-stroke" x1="0%" y1="100%" x2="0%" y2="0%">
                                        <stop offset="0%" stopColor="#FF4D00" />
                                        <stop offset="100%" stopColor="#FFCC00" />
                                    </linearGradient>
                                </defs>
                                <g fill="none" stroke="url(#logo-gradient-stroke)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                    <path className="animate-draw-logo" d="M276 41.3c-12.4 19.9-79.5 127.5-149.2 239.1C57 392 0 483.7 0 484.2s8.4.7 18.7.6l18.6-.3L168.2 275C240.1 159.8 299.5 65.5 300 65.5c.6 0 59.9 94.3 131.9 209.5l130.8 209.5 18.8.3c15.1.2 18.6 0 18.3-1.1-.2-.7-67.3-108.7-149.3-240C359.6 98.2 300.9 5.1 300 5.1c-.9 0-10.6 14.7-24 36.2z"/>
                                    <path className="animate-draw-logo delay-100" d="M175.2 284.4C107.5 393 51.7 482.6 51.4 483.4c-.6 1.5 22.5 1.6 248.5 1.6 137 0 249.1-.2 249.1-.5 0-1.1-6.1-11.4-7.4-12.4-.8-.7-10.1-1.2-25.1-1.3l-23.8-.3-13.2-21c-7.2-11.6-50.1-80.3-95.4-152.8C324.5 201.4 301.3 165 300 165c-1.3 0-26.8 40-92.4 145.1-49.8 79.7-90.6 145.7-90.6 146.5 0 1.2 2 1.4 12.3 1.2l12.2-.3 78.7-126c43.3-69.3 79.1-126.1 79.6-126.3.7-.2 62 97.1 156 248l11.1 17.8H275l-.2-24.7-.3-24.8-12.2-.5-12.1-.5 23.1-37c12.8-20.4 24.1-38.5 25.3-40.3l2.1-3.3 23.8 38.3c13.1 21.1 24.5 39.4 25.4 40.7l1.5 2.3-7.1-.7c-10.6-1-11.3-.4-11.3 9.9 0 6.7.3 8.5 1.6 9 .9.3 11.7.6 24 .6H381v-2.4c0-1.4-15.8-27.7-39.3-65.3-29.7-47.6-39.7-62.8-41.2-62.8-1.4 0-11.4 15.2-41.2 63-21.6 34.6-39.3 64-39.3 65.2v2.3h37.9l.6 4.2c.3 2.4.5 9.2.3 15.3l-.3 11-41.3.3-41.3.2 2.3-3.8C189.3 448.8 299.6 273 300.1 273c.3 0 26.5 41.6 58.3 92.5l57.7 92.5h10c8.1 0 9.9-.3 9.9-1.5 0-.8-30.2-49.9-67.1-109.1-53.5-85.6-67.5-107.4-69-107.2-1.3.2-25.4 38-73.7 115.3l-71.9 115-32.1.3-32.1.2 39.8-63.7c22-35.1 69-110.4 104.5-167.3 35.6-56.9 65.1-103.5 65.6-103.5s46.1 72.2 101.2 160.5l100.3 160.5 14.9.3 14.8.3-.4-2.3C530.1 451.9 301.7 87 300 87c-.9 0-49.9 77.5-124.8 197.4z"/>
                                </g>
                            </svg>
                        </div>

                        {/* RODAPÉ (Botão de Teste Disfarçado) */}
                        <div className="mb-8 cursor-pointer" onClick={startVotingSession} title="Simular Checkin (Admin)">
                            <p className="text-orange-500/60 text-xs font-bold uppercase tracking-widest animate-pulse hover:text-orange-400 transition-colors">
                                Faça seu checkin e libere o game!
                            </p>
                        </div>
                    </div>
                )}

                {/* --- TELA 2: VOTING (VOTAÇÃO) --- */}
                {viewState === 'voting' && (
                    <div className="flex-1 flex flex-col h-full animate-scale-in">
                        {/* Header */}
                        <div className="pt-10 pb-6 px-8 text-center shrink-0">
                            <h1 className="text-3xl md:text-4xl font-black uppercase text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-yellow-400 leading-tight drop-shadow-md">
                                {config?.titulo || 'FAÇA SUA ESCOLHA!'}
                            </h1>
                            <p className="text-gray-400 text-sm mt-3 uppercase tracking-wide font-bold">
                                Escolha a sua vibe:
                            </p>
                        </div>

                        {/* Grid de Opções */}
                        <div className={`flex-1 grid ${gridCols} gap-6 px-8 pb-8 content-center overflow-y-auto custom-scrollbar`}>
                            {config?.opcoes.map((opt, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleVote(idx, opt.nome)}
                                    className="group relative bg-[#151515] border border-white/5 hover:border-orange-500/50 rounded-3xl p-4 flex flex-col items-center justify-center gap-3 transition-all duration-200 active:scale-95 shadow-xl hover:shadow-orange-900/10 hover:-translate-y-1"
                                    style={{ 
                                        minHeight: 'auto', 
                                        aspectRatio: config.opcoes.length <= 4 ? '4/3' : '3/2' 
                                    }}
                                >
                                    {/* Visual Colorido */}
                                    <div className="transform group-hover:scale-110 transition-transform duration-300">
                                        {opt.tipo === 'emoji' && (
                                            <span className="text-6xl md:text-7xl drop-shadow-lg filter-none">{opt.valor}</span>
                                        )}
                                        
                                        {opt.tipo === 'image' && opt.valor && (
                                            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden border-2 border-white/10 shadow-lg">
                                                <img src={`${LOCAL_API_URL}${opt.valor}`} alt={opt.nome} className="w-full h-full object-cover" />
                                            </div>
                                        )}

                                        {opt.tipo === 'none' && (
                                            <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-white/10">
                                                <span className="material-symbols-outlined text-3xl">touch_app</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Nome */}
                                    <span className="block text-base md:text-lg font-bold text-gray-200 uppercase leading-tight px-1 group-hover:text-white">
                                        {opt.nome}
                                    </span>
                                </button>
                            ))}
                        </div>
                        
                        {/* Botão Cancelar */}
                        <div className="pb-6 text-center shrink-0">
                            <button onClick={() => {
                                clearTimers();
                                setViewState('idle');
                            }} className="text-[10px] text-white/20 uppercase tracking-widest hover:text-white/50 transition-colors py-2 px-4">
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}

                {/* --- TELA 3: SUCCESS (CONFIRMAÇÃO) --- */}
                {viewState === 'success' && (
                    <div className="flex-1 flex flex-col justify-between items-center p-8 text-center animate-fade-in h-full">
                        
                        <div className="mt-12">
                            <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-yellow-400 mb-2 drop-shadow-sm">
                                ISSO AÍ!
                            </h1>
                            <p className="text-lg text-gray-400 font-medium">
                                As portas do labirinto se abrirão.
                            </p>
                        </div>

                        {/* Logo Estático com Glow */}
                        <div className="flex-1 flex items-center justify-center">
                            <svg className="w-64 h-auto drop-shadow-[0_0_30px_rgba(255,77,0,0.6)]" viewBox="0 0 600 485" xmlns="http://www.w3.org/2000/svg">
                                <g fill="none" stroke="#FF4D00" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M276 41.3c-12.4 19.9-79.5 127.5-149.2 239.1C57 392 0 483.7 0 484.2s8.4.7 18.7.6l18.6-.3L168.2 275C240.1 159.8 299.5 65.5 300 65.5c.6 0 59.9 94.3 131.9 209.5l130.8 209.5 18.8.3c15.1.2 18.6 0 18.3-1.1-.2-.7-67.3-108.7-149.3-240C359.6 98.2 300.9 5.1 300 5.1c-.9 0-10.6 14.7-24 36.2z"/>
                                    <path d="M175.2 284.4C107.5 393 51.7 482.6 51.4 483.4c-.6 1.5 22.5 1.6 248.5 1.6 137 0 249.1-.2 249.1-.5 0-1.1-6.1-11.4-7.4-12.4-.8-.7-10.1-1.2-25.1-1.3l-23.8-.3-13.2-21c-7.2-11.6-50.1-80.3-95.4-152.8C324.5 201.4 301.3 165 300 165c-1.3 0-26.8 40-92.4 145.1-49.8 79.7-90.6 145.7-90.6 146.5 0 1.2 2 1.4 12.3 1.2l12.2-.3 78.7-126c43.3-69.3 79.1-126.1 79.6-126.3.7-.2 62 97.1 156 248l11.1 17.8H275l-.2-24.7-.3-24.8-12.2-.5-12.1-.5 23.1-37c12.8-20.4 24.1-38.5 25.3-40.3l2.1-3.3 23.8 38.3c13.1 21.1 24.5 39.4 25.4 40.7l1.5 2.3-7.1-.7c-10.6-1-11.3-.4-11.3 9.9 0 6.7.3 8.5 1.6 9 .9.3 11.7.6 24 .6H381v-2.4c0-1.4-15.8-27.7-39.3-65.3-29.7-47.6-39.7-62.8-41.2-62.8-1.4 0-11.4 15.2-41.2 63-21.6 34.6-39.3 64-39.3 65.2v2.3h37.9l.6 4.2c.3 2.4.5 9.2.3 15.3l-.3 11-41.3.3-41.3.2 2.3-3.8C189.3 448.8 299.6 273 300.1 273c.3 0 26.5 41.6 58.3 92.5l57.7 92.5h10c8.1 0 9.9-.3 9.9-1.5 0-.8-30.2-49.9-67.1-109.1-53.5-85.6-67.5-107.4-69-107.2-1.3.2-25.4 38-73.7 115.3l-71.9 115-32.1.3-32.1.2 39.8-63.7c22-35.1 69-110.4 104.5-167.3 35.6-56.9 65.1-103.5 65.6-103.5s46.1 72.2 101.2 160.5l100.3 160.5 14.9.3 14.8.3-.4-2.3C530.1 451.9 301.7 87 300 87c-.9 0-49.9 77.5-124.8 197.4z"/>
                                </g>
                            </svg>
                        </div>

                        {/* Bottom: Texto final */}
                        <div className="mb-10 w-full max-w-xs mx-auto">
                            <p className="text-white/60 text-sm uppercase tracking-wide mb-2">Você escolheu:</p>
                            <p className="text-2xl font-bold text-orange-400 mb-6 drop-shadow-md truncate px-4">
                                "{votedOption}"
                            </p>
                            
                            {/* Barra de Progresso (Feedback Visual do Timer) */}
                            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 animate-progress-shrink origin-left w-full"></div>
                            </div>
                            <p className="text-xl font-bold italic text-white/90 mt-6">
                                Você está no controle. Boa diversão!
                            </p>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}