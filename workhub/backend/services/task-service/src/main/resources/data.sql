INSERT INTO tasks (id, team_id, title, description, status, assignee_id, created_by, created_at, updated_at) VALUES
  (1, 1, 'Plan Sprint Q4', 'Coordinar objetivos del sprint, dependencias y timeline con todos los squads.', 'IN_PROGRESS', 2, 1, '2024-10-20T08:00:00Z', '2024-10-22T09:30:00Z'),
  (2, 1, 'Actualizar tablero de incidencias', 'Revisar backlog de bugs criticos y priorizar fixes antes del release.', 'TODO', 3, 2, '2024-10-21T10:00:00Z', '2024-10-21T10:00:00Z'),
  (3, 2, 'Campania de lanzamiento de noviembre', 'Definir mensajes clave y assets para la campania de Growth.', 'IN_PROGRESS', 4, 2, '2024-10-18T13:30:00Z', '2024-10-23T09:15:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO task_checklist_items (id, task_id, title, description, completed, position, archived, created_at, updated_at) VALUES
  (1, 1, 'Definir objetivos OKR', 'Revisar backlog estrategico con Camila.', TRUE, 1, FALSE, '2024-10-20T08:05:00Z', '2024-10-21T09:00:00Z'),
  (2, 1, 'Bloquear slots con QA', 'Coordinar disponibilidad del equipo de QA para la demo.', FALSE, 2, FALSE, '2024-10-20T08:05:30Z', '2024-10-22T09:30:00Z'),
  (3, 3, 'Brief creativo aprobado', 'Validar copy final con el equipo de contenidos.', TRUE, 1, FALSE, '2024-10-18T13:35:00Z', '2024-10-22T11:10:00Z'),
  (4, 3, 'Checklist de assets', 'Confirmar tamanos requeridos para redes y newsletter.', FALSE, 2, FALSE, '2024-10-18T13:35:30Z', '2024-10-23T09:15:00Z')
ON CONFLICT (id) DO NOTHING;
