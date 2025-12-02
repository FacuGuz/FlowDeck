import { TeamRole } from '../enums/team-role';
import { UserRole } from '../enums/user-role';

export interface User {
  id: number;
  email: string;
  fullName: string;
  nickname?: string | null;
  avatarUrl?: string | null;
  role: UserRole;
  password: string;
  createdAt: string;
}

export interface UserCreateRequest {
  email: string;
  fullName: string;
  role: UserRole;
  password: string;
}

export interface UserTeam {
  id: number;
  userId: number;
  teamId: number;
  role: TeamRole;
  createdAt: string;
}
