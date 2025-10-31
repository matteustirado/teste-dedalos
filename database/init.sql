USE radio_dedalos;

CREATE TABLE IF NOT EXISTS tracks (
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

CREATE TABLE IF NOT EXISTS playlists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  imagem VARCHAR(255),
  tracks_ids JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agendamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  data_agendamento DATE NOT NULL,
  hora_inicio INT NOT NULL COMMENT 'Representa a hora do dia (0-23)',
  playlist_id INT NULL,
  regra_repeticao ENUM('NENHUMA', 'DIA_SEMANA_MES') NOT NULL DEFAULT 'NENHUMA',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_data_hora (data_agendamento, hora_inicio),
  CONSTRAINT fk_playlist
    FOREIGN KEY (playlist_id)
    REFERENCES playlists(id)
    ON DELETE SET NULL,
  CONSTRAINT uq_data_hora UNIQUE (data_agendamento, hora_inicio)
);


CREATE TABLE IF NOT EXISTS jukebox_pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  track_id INT NOT NULL,
  pulseira_id VARCHAR(100) NOT NULL,
  unidade VARCHAR(50) NOT NULL,
  status ENUM('PENDENTE', 'TOCADO', 'VETADO') NOT NULL DEFAULT 'PENDENTE',
  pedido_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tocado_em TIMESTAMP NULL,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS radio_config (
  config_key VARCHAR(50) NOT NULL PRIMARY KEY UNIQUE,
  config_value JSON NOT NULL
);


INSERT INTO radio_config (config_key, config_value)
VALUES ('commercial_track_ids', '[]')
ON DUPLICATE KEY UPDATE config_key=config_key;


INSERT INTO radio_config (config_key, config_value)
VALUES ('fallback_playlist_ids', '{"DOMINGO": 1, "SEGUNDA": 1, "TERCA": 1, "QUARTA": 1, "QUINTA": 1, "SEXTA": 1, "SABADO": 1}')
ON DUPLICATE KEY UPDATE config_key=config_key;