ALTER TABLE teams
    ADD COLUMN IF NOT EXISTS code VARCHAR(6);

TRUNCATE TABLE team_members RESTART IDENTITY CASCADE;
TRUNCATE TABLE teams RESTART IDENTITY CASCADE;

INSERT INTO teams (id, name, code, created_at) VALUES
  (1, 'FlowDeck Core', 'FLD101', '2024-09-15T12:00:00Z'),
  (2, 'Growth Marketing', 'GRW204', '2024-09-20T15:45:00Z');

INSERT INTO team_members (id, team_id, user_id, created_at) VALUES
  (1, 1, 1, '2024-10-10T08:05:00Z'),
  (2, 1, 2, '2024-10-10T08:05:30Z'),
  (3, 1, 3, '2024-10-10T08:06:00Z'),
  (4, 2, 2, '2024-10-12T11:35:00Z'),
  (5, 2, 4, '2024-10-12T11:35:30Z');

SELECT setval(
    pg_get_serial_sequence('teams', 'id'),
    COALESCE((SELECT MAX(id) FROM teams), 0),
    true
);

SELECT setval(
    pg_get_serial_sequence('team_members', 'id'),
    COALESCE((SELECT MAX(id) FROM team_members), 0),
    true
);
