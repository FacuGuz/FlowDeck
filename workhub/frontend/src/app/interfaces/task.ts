export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';

export interface TaskChecklistItem {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  position: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: number;
  teamId: number;
  title: string;
  description: string;
  status: TaskStatus;
  assigneeId: number | null;
  dueOn: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  checklist: TaskChecklistItem[];
}

export interface TaskChecklistItemInput {
  title: string;
  description?: string;
  completed?: boolean;
  position?: number;
  archived?: boolean;
}

export interface TaskCreateRequest {
  teamId: number;
  title: string;
  description: string;
  status?: TaskStatus;
  dueOn?: string | null;
  createdBy: number;
  assigneeId?: number;
  checklist?: TaskChecklistItemInput[];
}

export interface TaskUpdateRequest {
  title?: string;
  description?: string;
  status?: TaskStatus;
  dueOn?: string | null;
  checklist?: TaskChecklistItemInput[];
}

export interface TaskAssignRequest {
  assigneeId: number;
}
