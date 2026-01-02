import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { MOVEMENT_MESSAGES } from '../../assets/text/PercentPhrases';

const API_URL = 'http://localhost:4000';

const CROWD_API = {
    sp: {
        url: import.meta.env.VITE_API_URL_SP,
        token: import.meta.env.VITE_API_TOKEN_SP,
        maxCapacity: 210
    },
    bh: {
        url: import.meta.env.VITE_API_URL_BH,
        token: import.meta.env.VITE_API_TOKEN_BH,
        maxCapacity: 160
    }
};

export default function ScoreboardDisplay() {
    const { unidade } = useParams();
    const currentUnit = unidade ? unidade.toLowerCase() : 'sp';
    const crowdConfig = CROWD_API[currentUnit] || CROWD_API.sp;

    const [config, setConfig] = useState(null);
    const [votes, setVotes] = useState({});
    const [crowdCount, setCrowdCount] = useState(0);
    const [loading, setLoading] = useState(true);

    // Injeta fonte Noto Emoji
    useEffect(() => {
        const link = document.createElement('link');
        link.href = 'https://fonts.googleapis.com/css2?family=Noto+Emoji:wght@300..700&display=swap';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
        return () => {
            if (document.head.contains(link)) document.head.removeChild(link);
        };
    }, []);

    useEffect(() => {
        fetchData();

        const socket = io(API_URL);
        socket.on('connect', () => console.log(`[Placar] Conectado ao Socket ${API_URL}`));

        socket.on('placardUpdate', (data) => {
            if (data && data.unit && data.unit.toLowerCase() === currentUnit) {
                setVotes(data.votes);
            }
        });

        socket.on('scoreboard:config_updated', (data) => {
            if (data.unidade.toLowerCase() === currentUnit) {
                fetchData();
            }
        });

        fetchCrowdCount();
        const crowdInterval = setInterval(fetchCrowdCount, 10000);

        return () => {
            socket.disconnect();
            clearInterval(crowdInterval);
        };
    }, [currentUnit]);

    const fetchData = async () => {
        try {
            const [configRes, votesRes] = await Promise.all([
                axios.get(`${API_URL}/api/scoreboard/active/${currentUnit}`),
                axios.get(`${API_URL}/api/scoreboard/votes/${currentUnit}`)
            ]);
            setConfig(configRes.data);
            setVotes(votesRes.data || {});
            setLoading(false);
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
        }
    };

    const fetchCrowdCount = async () => {
        if (!crowdConfig.url || !crowdConfig.token) return;
        try {
            const baseUrl = crowdConfig.url.replace(/\/$/, ""); 
            const endpoint = `${baseUrl}/api/contador/`; 
            const response = await axios.get(endpoint, {
                headers: { 'Authorization': `Token ${crowdConfig.token}` }
            });
            const count = (response.data && response.data.length > 0) ? response.data[0].contador : 0;
            setCrowdCount(count);
        } catch (error) {
            console.error("Erro termômetro:", error);
        }
    };

    const processedOptions = useMemo(() => {
        if (!config || !config.opcoes) return [];
        let totalVotes = 0;
        Object.values(votes).forEach(v => totalVotes += Number(v));

        const options = config.opcoes.map((opt) => {
            const count = Number(votes[opt.nome]) || 0;
            const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
            const color = opt.cor || '#ff4d00'; 
            return { ...opt, count, percentage, color };
        });

        return options.sort((a, b) => b.count - a.count);
    }, [config, votes]);

    const crowdPercentage = Math.min((crowdCount / crowdConfig.maxCapacity) * 100, 100);
    
    const getMovementMessage = (pct) => {
        const rounded = Math.floor(pct / 5) * 5;
        const keys = Object.keys(MOVEMENT_MESSAGES).map(Number).sort((a, b) => b - a);
        for (const key of keys) {
            if (rounded >= key) return MOVEMENT_MESSAGES[key];
        }
        return MOVEMENT_MESSAGES[0];
    };

    if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center font-bold tracking-widest">CARREGANDO...</div>;

    const isLandscape = config?.layout === 'landscape';

    // --- ESTILOS VISUAIS ATUALIZADOS ---

    // Barra de Fundo: Sempre 100% preenchida com a cor da opção
    const getBarStyle = (color) => {
        return {
            background: `linear-gradient(135deg, ${color}CC 0%, ${color} 100%)`, // Gradiente sutil para dar volume
            boxShadow: `inset 0 0 30px rgba(0,0,0,0.3)`, // Sombra interna para profundidade
            width: '100%',  // <--- SEMPRE CHEIO
            height: '100%', // <--- SEMPRE CHEIO
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 0
        };
    };

    // Emoji: Branco sólido, sem neon colorido
    const getEmojiStyle = () => ({
        fontFamily: '"Noto Emoji", sans-serif',
        color: '#ffffff', // Branco Sólido
        filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' // Sombra escura para contraste sobre a cor
    });

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans overflow-hidden relative selection:bg-none p-4 md:p-8 flex flex-col justify-center items-center">
            
            {/* AMBIENTE (FUNDO) */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
                <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-orange-900/20 rounded-full blur-[120px] animate-float-slow"></div>
                <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-red-900/20 rounded-full blur-[100px] animate-float-reverse"></div>
            </div>

            {/* LOGO DE FUNDO */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[60%] max-w-[500px] opacity-[0.08] pointer-events-none z-0">
                <svg viewBox="0 0 600 485" className="w-full h-full drop-shadow-[0_0_30px_#ff0000]">
                    <g fill="none" stroke="#ff0000" strokeWidth="5">
                        <path d="M276 41.3c-12.4 19.9-79.5 127.5-149.2 239.1C57 392 0 483.7 0 484.2s8.4.7 18.7.6l18.6-.3L168.2 275C240.1 159.8 299.5 65.5 300 65.5c.6 0 59.9 94.3 131.9 209.5l130.8 209.5 18.8.3c15.1.2 18.6 0 18.3-1.1-.2-.7-67.3-108.7-149.3-240C359.6 98.2 300.9 5.1 300 5.1c-.9 0-10.6 14.7-24 36.2z"/>
                        <path d="M175.2 284.4C107.5 393 51.7 482.6 51.4 483.4c-.6 1.5 22.5 1.6 248.5 1.6 137 0 249.1-.2 249.1-.5 0-1.1-6.1-11.4-7.4-12.4-.8-.7-10.1-1.2-25.1-1.3l-23.8-.3-13.2-21c-7.2-11.6-50.1-80.3-95.4-152.8C324.5 201.4 301.3 165 300 165c-1.3 0-26.8 40-92.4 145.1-49.8 79.7-90.6 145.7-90.6 146.5 0 1.2 2 1.4 12.3 1.2l12.2-.3 78.7-126c43.3-69.3 79.1-126.1 79.6-126.3.7-.2 62 97.1 156 248l11.1 17.8H275l-.2-24.7-.3-24.8-12.2-.5-12.1-.5 23.1-37c12.8-20.4 24.1-38.5 25.3-40.3l2.1-3.3 23.8 38.3c13.1 21.1 24.5 39.4 25.4 40.7l1.5 2.3-7.1-.7c-10.6-1-11.3-.4-11.3 9.9 0 6.7.3 8.5 1.6 9 .9.3 11.7.6 24 .6H381v-2.4c0-1.4-15.8-27.7-39.3-65.3-29.7-47.6-39.7-62.8-41.2-62.8-1.4 0-11.4 15.2-41.2 63-21.6 34.6-39.3 64-39.3 65.2v2.3h37.9l.6 4.2c.3 2.4.5 9.2.3 15.3l-.3 11-41.3.3-41.3.2 2.3-3.8C189.3 448.8 299.6 273 300.1 273c.3 0 26.5 41.6 58.3 92.5l57.7 92.5h10c8.1 0 9.9-.3 9.9-1.5 0-.8-30.2-49.9-67.1-109.1-53.5-85.6-67.5-107.4-69-107.2-1.3.2-25.4 38-73.7 115.3l-71.9 115-32.1.3-32.1.2 39.8-63.7c22-35.1 69-110.4 104.5-167.3 35.6-56.9 65.1-103.5 65.6-103.5s46.1 72.2 101.2 160.5l100.3 160.5 14.9.3 14.8.3-.4-2.3C530.1 451.9 301.7 87 300 87c-.9 0-49.9 77.5-124.8 197.4z"/>
                    </g>
                </svg>
            </div>

            {/* MOLDURA PRINCIPAL */}
            <div className={`relative z-10 bg-black/60 backdrop-blur-md rounded-3xl border-4 border-transparent bg-clip-padding shadow-2xl p-8 flex flex-col w-full max-w-[1400px] transition-all duration-500
                ${isLandscape ? 'h-[85vh]' : 'min-h-[85vh] h-auto'}
            `} style={{ borderImage: 'linear-gradient(135deg, #ff4d00, #ffcc00) 1' }}>
                
                {/* TÍTULO */}
                <h1 className="text-5xl md:text-6xl font-black italic text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-yellow-400 drop-shadow-[0_0_20px_rgba(255,77,0,0.5)] uppercase tracking-wider shrink-0">
                    {config?.titulo || 'PLACAR DEDALOS'}
                </h1>

                {/* --- ÁREA DO PLACAR (CORE) --- */}
                <div className={`flex-1 flex w-full gap-4 md:gap-8 justify-center items-end ${
                    isLandscape 
                        ? 'flex-row items-end' // PAISAGEM: Colunas lado a lado
                        : 'flex-col justify-start' // RETRATO: Barras empilhadas
                }`}>
                    
                    {processedOptions.map((opt, idx) => (
                        <div key={idx} className={`relative rounded-2xl border border-white/10 bg-black/40 shadow-lg overflow-hidden transition-all duration-500
                            ${isLandscape 
                                ? 'flex-1 h-full flex flex-col justify-end max-w-[250px]' 
                                : 'w-full h-28 flex flex-row items-center'
                            }
                        `}>
                            
                            {/* FUNDO COLORIDO (100% PREENCHIDO) */}
                            <div style={getBarStyle(opt.color)} />

                            {/* --- CONTEÚDO (SOBRE O FUNDO) --- */}
                            
                            {/* 1. LAYOUT PAISAGEM (Colunas Verticais) */}
                            {isLandscape ? (
                                <div className="relative z-10 w-full h-full flex flex-col items-center justify-between py-4 pointer-events-none">
                                    {/* Porcentagem */}
                                    <span className="font-black text-4xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] mb-2">
                                        {opt.percentage.toFixed(0)}%
                                    </span>

                                    {/* Visual (Emoji Branco) */}
                                    <div className="flex-1 flex items-center justify-center">
                                        {opt.tipo === 'emoji' && (
                                            <span 
                                                className="text-[6rem] leading-none transition-transform" 
                                                style={getEmojiStyle()}
                                            >
                                                {opt.valor}
                                            </span>
                                        )}
                                        {opt.tipo === 'image' && opt.valor && (
                                            <img src={`${API_URL}${opt.valor}`} className="w-24 h-24 rounded-full border-4 border-white object-cover shadow-lg" alt={opt.nome} />
                                        )}
                                    </div>

                                    {/* Nome */}
                                    <span className="font-bold text-white uppercase tracking-wider text-center text-xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] px-2 break-words w-full leading-tight">
                                        {opt.nome}
                                    </span>
                                </div>
                            ) : (
                                /* 2. LAYOUT RETRATO (Barras Horizontais) */
                                <div className="relative z-10 w-full h-full flex flex-row items-center px-6 gap-6 justify-between pointer-events-none">
                                    
                                    {/* Visual */}
                                    <div className="w-20 flex-shrink-0 flex items-center justify-center">
                                        {opt.tipo === 'emoji' && (
                                            <span 
                                                className="text-5xl leading-none"
                                                style={getEmojiStyle()}
                                            >
                                                {opt.valor}
                                            </span>
                                        )}
                                        {opt.tipo === 'image' && opt.valor && (
                                            <img src={`${API_URL}${opt.valor}`} className="w-16 h-16 rounded-full border-2 border-white object-cover" alt={opt.nome} />
                                        )}
                                    </div>

                                    {/* Nome */}
                                    <span className="font-black text-white uppercase tracking-wider text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] flex-1 text-left truncate">
                                        {opt.nome}
                                    </span>

                                    {/* Porcentagem */}
                                    <span className="font-black text-4xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                                        {opt.percentage.toFixed(0)}%
                                    </span>
                                </div>
                            )}

                        </div>
                    ))}
                </div>

                {/* TERMÔMETRO DE LOTAÇÃO */}
                <div className="mt-8 pt-4 border-t border-white/10 flex flex-col items-center shrink-0 w-full">
                    <div className="w-full max-w-5xl h-10 bg-black/60 rounded-full border border-white/20 relative overflow-hidden shadow-inner mb-3">
                        <div 
                            className="h-full rounded-full transition-all duration-1000 ease-in-out relative"
                            style={{ 
                                width: `${crowdPercentage}%`,
                                background: 'linear-gradient(90deg, #FFCC00 0%, #FF4D00 50%, #FF0000 100%)', 
                                boxShadow: '0 0 25px rgba(255, 77, 0, 0.6)'
                            }}
                        >
                            <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </div>
                    </div>
                    <p className="text-xl md:text-2xl text-white font-light uppercase tracking-[0.15em] text-center drop-shadow-md animate-fade-in">
                        {getMovementMessage(crowdPercentage)}
                    </p>
                </div>

            </div>
        </div>
    );
}