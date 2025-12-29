import pool from '../config/db.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SLOTS_PER_DAY = 144; 

const getDatesForDayOfWeekInMonth = (year, month, dayOfWeek) => {
    const dates = [];
    const date = new Date(Date.UTC(year, month - 1, 1));
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getDate();

    while (date.getUTCDay() !== dayOfWeek) {
        date.setUTCDate(date.getUTCDate() + 1);
        if (date.getUTCMonth() !== month - 1) break;
    }

    while (date.getUTCMonth() === month - 1 && date.getUTCDate() <= daysInMonth) {
        dates.push(new Date(date.getTime()));
        date.setUTCDate(date.getUTCDate() + 7);
    }

    return dates.map(d => d.toISOString().split('T')[0]);
};

const safeJsonParse = (jsonString) => {
  if (!jsonString || typeof jsonString !== 'string') {
       return Array.isArray(jsonString) ? jsonString.map(id => Number(id)).filter(id => !isNaN(id)) : [];
  }
  try {
    const cleanedString = jsonString
        .replace(/\s+/g, '')
        .replace(/,\s*]/, ']');
    const parsed = JSON.parse(cleanedString);
    return Array.isArray(parsed)
        ? parsed.map(id => Number(id)).filter(id => !isNaN(id))
        : [];
  } catch (e) {
    console.error("Erro no safeJsonParse:", e, "String original:", jsonString);
    return [];
  }
};

const calculatePlaylistDuration = (playlistId, allPlaylists, allTracks) => {
    const playlist = allPlaylists.find(p => p.id === playlistId);
    if (!playlist || !allTracks || allTracks.length === 0) {
        return 0;
    }

    const trackIds = Array.isArray(playlist.tracks_ids) ? playlist.tracks_ids : [];
    let totalDurationSeconds = 0;

    trackIds.forEach(id => {
        const track = allTracks.find(t => t.id === Number(id));
        if (track) {
            const end = track.end_segundos ?? track.duracao_segundos;
            const start = track.start_segundos ?? 0;
            const duration = (end > start) ? (end - start) : 0;
            totalDurationSeconds += duration;
        }
    });
    return totalDurationSeconds;
};

const slotToTime = (slotIndex) => {
    const totalMinutes = slotIndex * 10;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const getScheduleSummaryByMonth = async (req, res) => {
    const { year, month } = req.params;
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        return res.status(400).json({ error: 'Ano ou mês inválido.' });
    }

    const firstDay = `${year}-${String(monthNum).padStart(2, '0')}-01`;
    const lastDayOfMonth = new Date(yearNum, monthNum, 0).getDate();
    const lastDay = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    try {
        const [rows] = await pool.query(
            `SELECT DISTINCT DATE_FORMAT(data_agendamento, '%Y-%m-%d') as scheduled_date
             FROM agendamentos
             WHERE data_agendamento BETWEEN ? AND ? AND playlist_id IS NOT NULL`,
            [firstDay, lastDay]
        );

        const scheduledDates = rows.map(row => row.scheduled_date);
        res.json(scheduledDates);

    } catch (err) {
        console.error(`Erro ao buscar resumo de agendamentos:`, err);
        res.status(500).json({ error: 'Erro ao buscar resumo de agendamentos.' });
    }
};

export const getScheduleByDate = async (req, res) => {
    const { data } = req.params;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data)) {
        return res.status(400).json({ error: 'Formato de data inválido. Use YYYY-MM-DD.' });
    }

    try {
        const [scheduleRows] = await pool.query(
            `SELECT slot_index, playlist_id
             FROM agendamentos
             WHERE data_agendamento = ?
             ORDER BY slot_index ASC`,
            [data]
        );

        const playlistIds = scheduleRows
                                .map(r => r.playlist_id)
                                .filter(id => id !== null);

        let playlistsInfo = [];
        let allTracksInfo = [];

        if (playlistIds.length > 0) {
            const placeholders = playlistIds.map(() => '?').join(',');
            [playlistsInfo] = await pool.query(
                `SELECT id, nome, tracks_ids FROM playlists WHERE id IN (${placeholders})`,
                playlistIds
            );
             playlistsInfo = playlistsInfo.map(p => ({
                 ...p,
                 tracks_ids: safeJsonParse(p.tracks_ids)
             }));

            [allTracksInfo] = await pool.query(
                 'SELECT id, duracao_segundos, start_segundos, end_segundos FROM tracks WHERE status_processamento = "PROCESSADO"'
            );
        }

        const schedule = {};
        for (let i = 0; i < SLOTS_PER_DAY; i++) {
            schedule[i] = null;
        }

        scheduleRows.forEach(row => {
            if (row.playlist_id !== null) {
                const playlistData = playlistsInfo.find(p => p.id === row.playlist_id);
                if (playlistData) {
                    const durationSeconds = calculatePlaylistDuration(row.playlist_id, playlistsInfo, allTracksInfo);
                    schedule[row.slot_index] = {
                        playlist_id: row.playlist_id,
                        playlist_nome: playlistData.nome || 'Playlist Sem Nome',
                        duration_seconds: durationSeconds
                    };
                } else {
                     schedule[row.slot_index] = {
                         playlist_id: row.playlist_id,
                         playlist_nome: 'Playlist Deletada/Inválida',
                         duration_seconds: 0
                     };
                }
            }
        });

        res.json(schedule);

    } catch (err) {
        console.error(`Erro ao buscar agendamento:`, err);
        res.status(500).json({ error: 'Erro ao buscar agendamento.' });
    }
};

export const saveSchedule = async (req, res) => {
    const { dates, schedule, regra_repeticao } = req.body;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dates || !Array.isArray(dates) || dates.length === 0) {
        return res.status(400).json({ error: 'Datas inválidas, ausentes ou formato incorreto.' });
    }

    for (const d of dates) {
        if (!dateRegex.test(d)) {
            return res.status(400).json({ error: `Formato de data inválido (${d}). Use YYYY-MM-DD.` });
        }
    }

    if (!schedule || typeof schedule !== 'object') {
        return res.status(400).json({ error: 'Dados de agendamento inválidos ou ausentes.' });
    }
    
    const validRepeticao = ['NENHUMA', 'DIA_SEMANA_MES'];
    if (!regra_repeticao || !validRepeticao.includes(regra_repeticao)) {
        return res.status(400).json({ error: 'Regra de repetição inválida ou ausente.' });
    }

    if (regra_repeticao === 'DIA_SEMANA_MES' && dates.length > 1) {
        return res.status(400).json({ error: 'Regra de repetição mensal só pode ser aplicada a um único dia.' });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        let datesToProcess = [];

        if (regra_repeticao === 'DIA_SEMANA_MES') {
            const singleDate = dates[0];
            const dateObj = new Date(singleDate + 'T00:00:00Z');
            const year = dateObj.getUTCFullYear();
            const month = dateObj.getUTCMonth() + 1;
            const dayOfWeek = dateObj.getUTCDay();

            // Gera todas as ocorrências do mês
            const allOccurrences = getDatesForDayOfWeekInMonth(year, month, dayOfWeek);
            
            // CORREÇÃO: Filtra para manter apenas datas >= data inicial selecionada
            datesToProcess = allOccurrences.filter(dateStr => dateStr >= singleDate);
            
        } else {
            datesToProcess = dates;
        }

        if (datesToProcess.length > 0) {
             const placeholders = datesToProcess.map(() => '?').join(',');
            await connection.query(
                `DELETE FROM agendamentos WHERE data_agendamento IN (${placeholders})`,
                datesToProcess
            );
        }

        const inserts = [];
        for (const dateToInsert of datesToProcess) {
            for (let slot = 0; slot < SLOTS_PER_DAY; slot++) {
                const slotStr = String(slot);
                if (schedule[slotStr] && schedule[slotStr].playlist_id) {
                    const playlistId = Number(schedule[slotStr].playlist_id);
                     if (!isNaN(playlistId)) {
                        inserts.push([
                            dateToInsert,
                            slot,
                            playlistId,
                            regra_repeticao
                        ]);
                     }
                }
            }
        }

        if (inserts.length > 0) {
            await connection.query(
                'INSERT INTO agendamentos (data_agendamento, slot_index, playlist_id, regra_repeticao) VALUES ?',
                [inserts]
            );
        }

        await connection.commit();
        res.status(201).json({ message: 'Agendamento salvo com sucesso!' });

    } catch (err) {
        await connection.rollback();
        console.error('Erro ao salvar agendamento:', err);
         if (err.code === 'ER_DUP_ENTRY') {
             res.status(409).json({ error: 'Conflito: Já existe um agendamento para um dos horários/datas especificados.' });
         } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
              res.status(400).json({ error: 'Erro: Uma das playlists selecionadas não existe mais.' });
         } else {
            res.status(500).json({ error: 'Erro interno ao salvar o agendamento.' });
         }
    } finally {
        connection.release();
    }
};

export const getScheduleReport = async (req, res) => {
    const { data } = req.params;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data)) {
        return res.status(400).json({ error: 'Formato de data inválido. Use YYYY-MM-DD.' });
    }

    try {
        const [rows] = await pool.query(
            `SELECT a.slot_index, p.nome as playlist_nome, p.descricao as playlist_descricao, p.id as playlist_id
             FROM agendamentos a
             LEFT JOIN playlists p ON a.playlist_id = p.id
             WHERE a.data_agendamento = ?
             ORDER BY a.slot_index ASC`,
            [data]
        );

        let report = `Relatório de Agendamento - ${data}\n\n`;
        if (rows.length === 0) {
            report += "Nenhuma playlist agendada para este dia.";
        } else {
            const scheduleMap = {};
            for (let i = 0; i < SLOTS_PER_DAY; i++) {
                scheduleMap[i] = 'Tempo Vazio';
            }
            rows.forEach(row => {
                 scheduleMap[row.slot_index] = row.playlist_id
                    ? `Playlist: ${row.playlist_nome || 'N/A'} (ID: ${row.playlist_id})`
                    : 'Tempo Vazio (Playlist Deletada)';
            });

            for (let slot = 0; slot < SLOTS_PER_DAY; slot++) {
                report += `${slotToTime(slot)} - ${scheduleMap[slot]}\n`;
            }
        }

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=agendamento_${data}.txt`);
        res.send(report);

    } catch (err) {
        console.error(`Erro ao gerar relatório para ${data}:`, err);
        res.status(500).json({ error: 'Erro ao gerar relatório de agendamento.' });
    }
};