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