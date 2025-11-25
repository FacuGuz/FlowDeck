import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { Team, TeamMember } from '../interfaces/team';
import { endpointFor } from './api-config';
import { toFriendlyError } from './error.utils';

@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly http = inject(HttpClient);

  list(params?: { search?: string }): Observable<Team[]> {
    let httpParams = new HttpParams();
    if (params?.search) {
      httpParams = httpParams.set('search', params.search);
    }

    return this.http
      .get<Team[]>(endpointFor('teams', '/teams'), { params: httpParams })
      .pipe(catchError((error) => throwError(() => toFriendlyError(error))));
  }

  get(id: number): Observable<Team> {
    return this.http
      .get<Team>(endpointFor('teams', `/teams/${id}`))
      .pipe(catchError((error) => throwError(() => toFriendlyError(error))));
  }

  create(payload: { name: string }): Observable<Team> {
    return this.http
      .post<Team>(endpointFor('teams', '/teams'), payload)
      .pipe(catchError((error) => throwError(() => toFriendlyError(error))));
  }

  findByCode(code: string): Observable<Team> {
    return this.http
      .get<Team>(endpointFor('teams', `/teams/code/${encodeURIComponent(code)}`))
      .pipe(catchError((error) => throwError(() => toFriendlyError(error))));
  }

  listMembers(teamId: number): Observable<TeamMember[]> {
    return this.http
      .get<TeamMember[]>(endpointFor('teams', `/teams/${teamId}/members`))
      .pipe(catchError((error) => throwError(() => toFriendlyError(error))));
  }

  addMember(teamId: number, payload: { userId: number }): Observable<TeamMember> {
    return this.http
      .post<TeamMember>(endpointFor('teams', `/teams/${teamId}/members`), payload)
      .pipe(catchError((error) => throwError(() => toFriendlyError(error))));
  }

  removeMember(teamId: number, memberId: number): Observable<void> {
    return this.http
      .delete<void>(endpointFor('teams', `/teams/${teamId}/members/${memberId}`))
      .pipe(catchError((error) => throwError(() => toFriendlyError(error))));
  }

  deleteTeam(teamId: number): Observable<void> {
    return this.http
      .delete<void>(endpointFor('teams', `/teams/${teamId}`))
      .pipe(catchError((error) => throwError(() => toFriendlyError(error))));
  }
}
