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
  imagem LONGTEXT,
  tracks_ids JSON
);