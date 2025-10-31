export interface User {
  id: number;
  email: string;
  fullName: string;
  role: string;
  password: string;
  createdAt: string;
}

export interface UserCreateRequest {
  email: string;
  fullName: string;
  role: string;
  password: string;
}

export interface UserTeam {
  id: number;
  userId: number;
  teamId: number;
  createdAt: string;
}
