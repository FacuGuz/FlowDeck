import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, tap, throwError } from 'rxjs';
import { User, UserCreateRequest, UserTeam } from '../interfaces/user';
import { TeamRole } from '../enums/team-role';
import { endpointFor } from './api-config';
import { toFriendlyError } from './error.utils';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storageKey = 'flowdeck.currentUser';
  private readonly currentUserSubject = new BehaviorSubject<User | null>(this.restoreUser());

  readonly currentUser$ = this.currentUserSubject.asObservable();

  register(request: UserCreateRequest): Observable<User> {
    return this.http.post<User>(endpointFor('auth', '/users'), request).pipe(
      tap((user) => this.setCurrentUser(user)),
      catchError((error) => throwError(() => toFriendlyError(error)))
    );
  }

  login(email: string, password: string): Observable<User> {
    return this.http
      .post<User>(endpointFor('auth', '/users/login'), { email, password })
      .pipe(
        tap((user) => this.setCurrentUser(user)),
        catchError((error) => throwError(() => toFriendlyError(error)))
      );
  }

  getUser(id: number): Observable<User> {
    return this.http
      .get<User>(endpointFor('auth', `/users/${id}`))
      .pipe(catchError((error) => throwError(() => toFriendlyError(error))));
  }

  getUserTeams(userId: number): Observable<UserTeam[]> {
    return this.http
      .get<UserTeam[]>(endpointFor('auth', `/users/${userId}/teams`))
      .pipe(catchError((error) => throwError(() => toFriendlyError(error))));
  }

  updateUserProfile(userId: number, payload: { nickname?: string | null }): Observable<User> {
    return this.http
      .patch<User>(endpointFor('auth', `/users/${userId}/profile`), payload)
      .pipe(
        tap((user) => this.setCurrentUser(user)),
        catchError((error) => throwError(() => toFriendlyError(error)))
      );
  }

  uploadUserAvatar(userId: number, file: File): Observable<User> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post<User>(endpointFor('auth', `/users/${userId}/avatar`), formData)
      .pipe(
        tap((user) => this.setCurrentUser(user)),
        catchError((error) => throwError(() => toFriendlyError(error)))
      );
  }

  addUserToTeam(userId: number, payload: { teamId: number; role: TeamRole }): Observable<UserTeam> {
    return this.http
      .post<UserTeam>(endpointFor('auth', `/users/${userId}/teams`), payload)
      .pipe(catchError((error) => throwError(() => toFriendlyError(error))));
  }

  removeUserFromTeam(userId: number, teamId: number): Observable<void> {
    return this.http
      .delete<void>(endpointFor('auth', `/users/${userId}/teams/${teamId}`))
      .pipe(catchError((error) => throwError(() => toFriendlyError(error))));
  }

  removeUserTeamById(userTeamId: number): Observable<void> {
    return this.http
      .delete<void>(endpointFor('auth', `/users/teams/${userTeamId}`))
      .pipe(catchError((error) => throwError(() => toFriendlyError(error))));
  }

  logout(): void {
    this.setCurrentUser(null);
  }

  // Marca el usuario como autenticado tras OAuth.
  completeOAuthLogin(user: User): void {
    this.setCurrentUser(user);
  }

  startGoogleOAuth(): Observable<string> {
    return this.http
      .get<{ authorizationUrl: string }>(endpointFor('auth', '/oauth/google/start'))
      .pipe(
        map((resp) => resp.authorizationUrl),
        catchError((error) => throwError(() => toFriendlyError(error)))
      );
  }

  private setCurrentUser(user: User | null): void {
    this.currentUserSubject.next(user);
    this.persistUser(user);
  }

  private restoreUser(): User | null {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return null;
    }

    const raw = window.localStorage.getItem(this.storageKey);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as User;
    } catch {
      window.localStorage.removeItem(this.storageKey);
      return null;
    }
  }

  private persistUser(user: User | null): void {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return;
    }

    if (!user) {
      window.localStorage.removeItem(this.storageKey);
      return;
    }

    window.localStorage.setItem(this.storageKey, JSON.stringify(user));
  }
}
