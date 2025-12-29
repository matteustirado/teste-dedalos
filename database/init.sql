USE radio_dedalos;

-- =======================================================
-- 1. LIMPEZA (Remove tabelas antigas para recriar do zero)
-- =======================================================
DROP TABLE IF EXISTS jukebox_pedidos;
DROP TABLE IF EXISTS agendamentos;
DROP TABLE IF EXISTS radio_config;
DROP TABLE IF EXISTS playlists;
DROP TABLE IF EXISTS tracks;

-- =======================================================
-- 2. CRIAÇÃO DAS TABELAS
-- =======================================================

-- Tabela de Músicas
CREATE TABLE tracks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  youtube_id VARCHAR(50) NOT NULL UNIQUE,
  titulo VARCHAR(255) NOT NULL,
  artista VARCHAR(255),
  artistas_participantes JSON,
  album VARCHAR(255),
  ano INT,
  gravadora VARCHAR(255),
  diretor VARCHAR(255),
  thumbnail_url VARCHAR(512) NULL,
  duracao_segundos INT NOT NULL,
  start_segundos INT NOT NULL DEFAULT 0,
  end_segundos INT,
  loudness_lufs DECIMAL(4,1),
  is_commercial BOOLEAN NOT NULL DEFAULT FALSE,
  dias_semana JSON,
  status_processamento ENUM('PENDENTE', 'PROCESSADO', 'ERRO') NOT NULL DEFAULT 'PENDENTE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Playlists
CREATE TABLE playlists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  imagem VARCHAR(255),
  tracks_ids JSON, -- Array de IDs das músicas
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabela de Agendamentos (Grade de Horários)
CREATE TABLE agendamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  data_agendamento DATE NOT NULL,
  slot_index INT NOT NULL COMMENT 'Representa o slot de 10min do dia (0-143)',
  playlist_id INT NULL,
  regra_repeticao ENUM('NENHUMA', 'DIA_SEMANA_MES') NOT NULL DEFAULT 'NENHUMA',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_data_slot (data_agendamento, slot_index),
  CONSTRAINT fk_playlist
    FOREIGN KEY (playlist_id)
    REFERENCES playlists(id)
    ON DELETE SET NULL,
  CONSTRAINT uq_data_slot UNIQUE (data_agendamento, slot_index)
);

-- Tabela de Pedidos da Jukebox (ATUALIZADA)
CREATE TABLE jukebox_pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  track_id INT NULL,                 -- Pode ser NULL se for uma Sugestão manual
  pulseira_id VARCHAR(100) NOT NULL,
  unidade VARCHAR(50) NOT NULL,
  termo_busca VARCHAR(255) NULL,     -- Salva o texto digitado na sugestão
  status ENUM('PENDENTE', 'TOCADO', 'VETADO', 'SUGERIDA') NOT NULL DEFAULT 'PENDENTE',
  pedido_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tocado_em TIMESTAMP NULL,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

-- Tabela de Configurações Gerais
CREATE TABLE radio_config (
  config_key VARCHAR(50) NOT NULL PRIMARY KEY UNIQUE,
  config_value JSON NOT NULL
);

-- =======================================================
-- 3. DADOS INICIAIS (SEED)
-- =======================================================

INSERT INTO radio_config (config_key, config_value)
VALUES ('commercial_track_ids', '[]');

INSERT INTO radio_config (config_key, config_value)
VALUES ('fallback_playlist_ids', '{"DOMINGO": 1, "SEGUNDA": 1, "TERCA": 1, "QUARTA": 1, "QUINTA": 1, "SEXTA": 1, "SABADO": 1}');