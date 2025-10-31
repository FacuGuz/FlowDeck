TRUNCATE TABLE user_teams RESTART IDENTITY CASCADE;
TRUNCATE TABLE users RESTART IDENTITY CASCADE;

INSERT INTO users (id, email, full_name, role, password, created_at) VALUES
  (1, 'camila.torres@deckflow.com', 'Camila Torres', 'OWNER', 'deckflow123', '2024-10-01T09:00:00Z'),
  (2, 'diego.ramos@deckflow.com', 'Diego Ramos', 'MANAGER', 'deckflow123', '2024-10-02T09:15:00Z'),
  (3, 'lucia.perez@deckflow.com', 'Lucia Perez', 'MEMBER', 'deckflow123', '2024-10-04T10:45:00Z'),
  (4, 'martin.gomez@deckflow.com', 'Martin Gomez', 'MEMBER', 'deckflow123', '2024-10-08T14:20:00Z');

INSERT INTO user_teams (id, user_id, team_id, created_at) VALUES
  (1, 1, 1, '2024-10-10T08:00:00Z'),
  (2, 2, 1, '2024-10-10T08:00:00Z'),
  (3, 3, 1, '2024-10-10T08:00:00Z'),
  (4, 2, 2, '2024-10-12T11:30:00Z'),
  (5, 4, 2, '2024-10-12T11:30:00Z');
