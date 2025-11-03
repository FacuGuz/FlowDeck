export interface Team {
  id: number;
  name: string;
  code: string;
  createdAt: string;
}

export interface TeamMember {
  id: number;
  teamId: number;
  userId: number;
  createdAt: string;
}
