ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password VARCHAR(120);

ALTER TABLE user_teams
    ADD COLUMN IF NOT EXISTS role VARCHAR(30);

INSERT INTO users (id, email, full_name, role, password, created_at) VALUES
  (1, 'camila.torres@deckflow.com', 'Camila Torres', 'ADMIN', 'deckflow123', '2024-10-01T09:00:00Z'),
  (2, 'diego.ramos@deckflow.com', 'Diego Ramos', 'USER', 'deckflow123', '2024-10-02T09:15:00Z'),
  (3, 'lucia.perez@deckflow.com', 'Lucia Perez', 'USER', 'deckflow123', '2024-10-04T10:45:00Z'),
  (4, 'martin.gomez@deckflow.com', 'Martin Gomez', 'USER', 'deckflow123', '2024-10-08T14:20:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_teams (id, user_id, team_id, role, created_at) VALUES
  (1, 1, 1, 'OWNER', '2024-10-10T08:00:00Z'),
  (2, 2, 1, 'MANAGER', '2024-10-10T08:00:00Z'),
  (3, 3, 1, 'MEMBER', '2024-10-10T08:00:00Z'),
  (4, 2, 2, 'OWNER', '2024-10-12T11:30:00Z'),
  (5, 4, 2, 'MEMBER', '2024-10-12T11:30:00Z')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE users
    ALTER COLUMN password SET NOT NULL;

ALTER TABLE user_teams
    ALTER COLUMN role SET NOT NULL;
