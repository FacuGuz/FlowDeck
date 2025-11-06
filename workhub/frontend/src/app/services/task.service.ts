import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { Task, TaskAssignRequest, TaskCreateRequest, TaskUpdateRequest } from '../interfaces/task';
import { endpointFor } from './api-config';
import { toFriendlyError } from './error.utils';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly http = inject(HttpClient);

  list(params?: { teamId?: number; assigneeId?: number }): Observable<Task[]> {
    let httpParams = new HttpParams();
    if (params?.teamId != null) {
      httpParams = httpParams.set('teamId', params.teamId);
    }
    if (params?.assigneeId != null) {
      httpParams = httpParams.set('assigneeId', params.assigneeId);
    }

    return this.http
      .get<Task[]>(endpointFor('tasks', '/tasks'), { params: httpParams })
      .pipe(catchError((error) => throwError(() => toFriendlyError(error))));
  }

  get(id: number): Observable<Task> {
    return this.http
      .get<Task>(endpointFor('tasks', `/tasks/${id}`))
      .pipe(catchError((error) => throwError(() => toFriendlyError(error))));
  }

  create(payload: TaskCreateRequest): Observable<Task> {
    return this.http
      .post<Task>(endpointFor('tasks', '/tasks'), payload)
      .pipe(catchError((error) => throwError(() => toFriendlyError(error))));
  }

  update(id: number, payload: TaskUpdateRequest): Observable<Task> {
    return this.http
      .patch<Task>(endpointFor('tasks', `/tasks/${id}`), payload)
      .pipe(catchError((error) => throwError(() => toFriendlyError(error))));
  }

  assign(id: number, payload: TaskAssignRequest): Observable<Task> {
    return this.http
      .post<Task>(endpointFor('tasks', `/tasks/${id}/assign`), payload)
      .pipe(catchError((error) => throwError(() => toFriendlyError(error))));
  }
}
