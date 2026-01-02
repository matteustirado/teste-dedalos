USE radio_dedalos;

-- 1. LIMPEZA TOTAL
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS scoreboard_votes;
DROP TABLE IF EXISTS scoreboard_presets;
DROP TABLE IF EXISTS scoreboard_active;
DROP TABLE IF EXISTS historico_promocoes;
DROP TABLE IF EXISTS jukebox_pedidos;
DROP TABLE IF EXISTS agendamentos;
DROP TABLE IF EXISTS radio_config;
DROP TABLE IF EXISTS playlists;
DROP TABLE IF EXISTS tracks;
SET FOREIGN_KEY_CHECKS = 1;

-- 2. CRIAÇÃO DAS TABELAS

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

CREATE TABLE playlists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  imagem VARCHAR(255),
  tracks_ids JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

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

CREATE TABLE jukebox_pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  track_id INT NULL,                
  pulseira_id VARCHAR(100) NOT NULL,
  unidade VARCHAR(50) NOT NULL,
  termo_busca VARCHAR(255) NULL,    
  status ENUM('PENDENTE', 'TOCADO', 'VETADO', 'SUGERIDA') NOT NULL DEFAULT 'PENDENTE', 
  pedido_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tocado_em TIMESTAMP NULL,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

CREATE TABLE radio_config (
  config_key VARCHAR(50) NOT NULL PRIMARY KEY UNIQUE,
  config_value JSON NOT NULL
);

CREATE TABLE historico_promocoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo VARCHAR(50) NOT NULL, 
  unidade VARCHAR(10) NOT NULL, 
  data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total_sorteados INT,
  total_resgatados INT,
  detalhes JSON, 
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- [NOVO] TABELAS DO PLACAR (SCOREBOARD)

-- Armazena a configuração ATUAL rodando nas telas
CREATE TABLE scoreboard_active (
  unidade VARCHAR(10) NOT NULL PRIMARY KEY, -- 'SP' ou 'BH'
  titulo VARCHAR(255) NOT NULL,
  layout ENUM('landscape', 'portrait') NOT NULL DEFAULT 'landscape',
  opcoes JSON NOT NULL, -- Array de objetos: [{nome, tipo, valor(emoji/img)}, ...]
  status ENUM('ATIVO', 'PAUSADO') NOT NULL DEFAULT 'ATIVO',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Armazena configurações salvas para uso posterior
CREATE TABLE scoreboard_presets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo_preset VARCHAR(100) NOT NULL,
  titulo_placar VARCHAR(255) NOT NULL,
  layout ENUM('landscape', 'portrait') NOT NULL DEFAULT 'landscape',
  opcoes JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Armazena os votos individuais
CREATE TABLE scoreboard_votes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  unidade VARCHAR(10) NOT NULL,
  option_index INT NOT NULL, -- Qual opção recebeu o voto (0, 1, 2...)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. DADOS INICIAIS
INSERT INTO radio_config (config_key, config_value) VALUES ('commercial_track_ids', '[]');
INSERT INTO radio_config (config_key, config_value) VALUES ('fallback_playlist_ids', '{"DOMINGO": 1, "SEGUNDA": 1, "TERCA": 1, "QUARTA": 1, "QUINTA": 1, "SEXTA": 1, "SABADO": 1}');

-- Configuração inicial do Placar para não dar erro na primeira carga
INSERT INTO scoreboard_active (unidade, titulo, layout, opcoes, status) VALUES 
('SP', 'Aguardando Configuração', 'landscape', '[{"nome":"Opção 1","tipo":"emoji","valor":"⏳"},{"nome":"Opção 2","tipo":"emoji","valor":"🔧"}]', 'PAUSADO'),
('BH', 'Aguardando Configuração', 'landscape', '[{"nome":"Opção 1","tipo":"emoji","valor":"⏳"},{"nome":"Opção 2","tipo":"emoji","valor":"🔧"}]', 'PAUSADO');