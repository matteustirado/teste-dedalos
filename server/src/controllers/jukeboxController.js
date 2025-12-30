import { getIO } from '../socket.js'; 
import pool from '../config/db.js';
import { adicionarPedidoNaFila, comporFilaVisual, verificarDisponibilidadeTrack } from './conductorController.js';

const LIMITE_PEDIDOS = 5;
const LIMITE_TEMPO_MINUTOS = 10;

// --- HISTÓRICO DE PEDIDOS ---
export const getHistoricoPedidos = async (req, res) => {
    try {
        // CORREÇÃO: Trocado 'jp.created_at' por 'jp.pedido_em'
        const query = `
            SELECT 
                jp.id,
                jp.pulseira_id,
                jp.unidade,
                jp.status,
                jp.pedido_em as created_at, 
                jp.tocado_em,
                jp.termo_busca,
                t.titulo,
                t.artista,
                t.thumbnail_url,
                t.is_commercial
            FROM jukebox_pedidos jp
            LEFT JOIN tracks t ON jp.track_id = t.id
            ORDER BY jp.pedido_em DESC
            LIMIT 200
        `;
        
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (error) {
        console.error("[Jukebox] Erro ao buscar histórico:", error);
        res.status(500).json({ error: "Erro ao buscar histórico de pedidos." });
    }
};

// --- RECEBER SUGESTÃO MANUAL ---
export const handleReceberSugestao = async (socket, data) => {
    const { termo, pulseiraId, unidade } = data;

    if (!termo || !pulseiraId || !unidade) {
        return;
    }

    try {
        await pool.query(
            'INSERT INTO jukebox_pedidos (pulseira_id, unidade, status, termo_busca, track_id) VALUES (?, ?, ?, ?, NULL)',
            [pulseiraId, unidade, 'SUGERIDA', termo]
        );
        console.log(`[Jukebox] Sugestão salva: "${termo}" (${unidade})`);
        
        socket.emit('jukebox:sugestaoAceita'); 

    } catch (err) {
        console.error("[Jukebox] Erro ao salvar sugestão:", err);
        socket.emit('jukebox:erroPedido', { message: 'Erro ao salvar sugestão.' });
    }
};

// --- ADICIONAR PEDIDO DE MÚSICA ---
export const handleAdicionarPedido = async (socket, data) => {
    const { trackId, pulseiraId, unidade } = data;

    if (!trackId || !pulseiraId || !unidade) {
        socket.emit('jukebox:erroPedido', { message: 'Pedido inválido.' });
        return;
    }
    
    const pulseiraLimpa = String(pulseiraId).trim();
    if (pulseiraLimpa.length === 0) {
        socket.emit('jukebox:erroPedido', { message: 'Número da pulseira inválido.' });
        return;
    }

    // 1. Validação de Disponibilidade com o Maestro
    const disponibilidade = verificarDisponibilidadeTrack(trackId);
    
    if (!disponibilidade.allowed) {
        socket.emit('jukebox:pedidoRecusado', { motivo: disponibilidade.motivo });
        return; 
    }

    try {
        // 2. Verifica limites de pedidos
        const [rows] = await pool.query(
            `SELECT COUNT(*) as count FROM jukebox_pedidos 
             WHERE pulseira_id = ? AND unidade = ? AND status = 'PENDENTE' AND pedido_em > NOW() - INTERVAL ? MINUTE`,
            [pulseiraLimpa, unidade, LIMITE_TEMPO_MINUTOS]
        );

        if (rows[0].count >= LIMITE_PEDIDOS) {
            socket.emit('jukebox:erroPedido', { message: `Limite de ${LIMITE_PEDIDOS} pedidos a cada ${LIMITE_TEMPO_MINUTOS} min atingido.` });
            return;
        }

        // 3. Insere no Banco de Dados
        const [insertResult] = await pool.query(
            'INSERT INTO jukebox_pedidos (track_id, pulseira_id, unidade, status) VALUES (?, ?, ?, ?)',
            [trackId, pulseiraLimpa, unidade, 'PENDENTE']
        );
        
        // 4. Adiciona na Fila do Maestro
        const pedidoObjeto = {
            id: insertResult.insertId,
            trackId: trackId,
            pulseiraId: pulseiraLimpa,
            unidade: unidade,
            tipo: 'JUKEBOX'
        };
        
        const posicaoNaFila = adicionarPedidoNaFila(pedidoObjeto); 

        // 5. Confirmação para o Frontend
        socket.emit('jukebox:pedidoAceito', { posicao: posicaoNaFila });
        
        // Atualiza a fila visual globalmente
        const filaVisual = await comporFilaVisual();
        getIO().emit('maestro:filaAtualizada', filaVisual);

    } catch (err) {
        console.error("[Jukebox] Erro:", err);
        socket.emit('jukebox:erroPedido', { message: 'Erro ao processar pedido.' });
    }
};