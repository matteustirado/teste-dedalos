import { io } from '../../server.js';
import pool from '../config/db.js';
import { adicionarPedidoNaFila, comporFilaVisual } from './conductorController.js';

const LIMITE_PEDIDOS = 5;
const LIMITE_TEMPO_MINUTOS = 10;

export const handleAdicionarPedido = async (socket, data) => {
    const { trackId, pulseiraId, unidade } = data;

    if (!trackId || !pulseiraId || !unidade) {
        console.warn(`[Jukebox] Pedido inválido recebido (dados ausentes) de ${socket.id}`, data);
        socket.emit('jukebox:erroPedido', { message: 'Pedido inválido. Faltam informações.' });
        return;
    }
    
    const pulseiraLimpa = String(pulseiraId).trim();
    if (pulseiraLimpa.length === 0) {
        console.warn(`[Jukebox] Pedido inválido (pulseira vazia) de ${socket.id}`);
        socket.emit('jukebox:erroPedido', { message: 'Número da pulseira inválido.' });
        return;
    }

    try {
        const [rows] = await pool.query(
            `SELECT COUNT(*) as count 
             FROM jukebox_pedidos 
             WHERE pulseira_id = ? AND unidade = ? AND status = 'PENDENTE' AND pedido_em > NOW() - INTERVAL ? MINUTE`,
            [pulseiraLimpa, unidade, LIMITE_TEMPO_MINUTOS]
        );

        const count = rows[0].count;
        if (count >= LIMITE_PEDIDOS) {
            console.log(`[Jukebox] Pulseira ${pulseiraLimpa} (${unidade}) atingiu o limite de ${LIMITE_PEDIDOS} pedidos pendentes.`);
            socket.emit('jukebox:erroPedido', { message: `Você atingiu o limite de ${LIMITE_PEDIDOS} pedidos a cada ${LIMITE_TEMPO_MINUTOS} minutos. Aguarde sua música tocar.` });
            return;
        }

        const [insertResult] = await pool.query(
            'INSERT INTO jukebox_pedidos (track_id, pulseira_id, unidade, status) VALUES (?, ?, ?, ?)',
            [trackId, pulseiraLimpa, unidade, 'PENDENTE']
        );
        
        const novoPedidoId = insertResult.insertId;
        console.log(`[Jukebox] Pedido ${novoPedidoId} salvo no DB para pulseira ${pulseiraLimpa} (${unidade}).`);

        const pedidoObjeto = {
            id: novoPedidoId,
            trackId: trackId,
            pulseiraId: pulseiraLimpa,
            unidade: unidade,
            tipo: 'JUKEBOX'
        };
        
        const posicaoNaFila = adicionarPedidoNaFila(pedidoObjeto); 

        socket.emit('jukebox:pedidoRecebido', { 
            message: 'Pedido recebido!', 
            posicao: posicaoNaFila
        });
        
        const filaVisual = await comporFilaVisual();
        io.emit('maestro:filaAtualizada', filaVisual);

    } catch (err) {
        console.error("[Jukebox] Erro ao processar pedido:", err);
        if (err.code === 'ER_NO_REFERENCED_ROW_2') {
             socket.emit('jukebox:erroPedido', { message: 'Música não encontrada ou indisponível.' });
        } else {
             socket.emit('jukebox:erroPedido', { message: 'Não foi possível processar seu pedido no momento.' });
        }
    }
};