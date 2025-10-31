import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import { User, UserCreateRequest, UserTeam } from '../interfaces/user';
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
    return this.http.get<User[]>(endpointFor('auth', '/users')).pipe(
      map((users) =>
        users.find(
          (user) =>
            user.email.toLowerCase() === email.toLowerCase() &&
            user.password === password
        ) ?? null
      ),
      switchMap((user) => {
        if (!user) {
          return throwError(() => toFriendlyError(new Error('Credenciales invÃ¡lidas')));
        }
        return of(user);
      }),
      tap((user) => this.setCurrentUser(user)),
      catchError((error) => throwError(() => toFriendlyError(error)))
    );
  }

  getUserTeams(userId: number): Observable<UserTeam[]> {
    return this.http
      .get<UserTeam[]>(endpointFor('auth', `/users/${userId}/teams`))
      .pipe(catchError((error) => throwError(() => toFriendlyError(error))));
  }

  logout(): void {
    this.setCurrentUser(null);
  }

  private setCurrentUser(user: User | null): void {
    const sanitized = user ? { ...user, password: '' } : null;
    this.currentUserSubject.next(sanitized);
    this.persistUser(sanitized);
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

