export const TEAM_ROLES = ['MEMBER', 'MANAGER', 'OWNER'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];
