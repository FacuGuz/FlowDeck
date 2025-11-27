import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { endpointFor } from './api-config';
import { toFriendlyError } from './error.utils';

interface CalendarStartResponse {
  authorizationUrl: string;
  state: string;
}

interface CalendarSyncPayload {
  userId: number;
  teamName: string;
  taskName: string;
  date: string;
}

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly http = inject(HttpClient);

  startGoogleCalendar(userId: number): Observable<string> {
    const params = new HttpParams().set('userId', userId);
    return this.http
      .get<CalendarStartResponse>(endpointFor('auth', '/oauth/google/calendar/start'), { params })
      .pipe(
        map((resp) => resp.authorizationUrl),
        catchError((error) => throwError(() => toFriendlyError(error)))
      );
  }

  syncTask(payload: CalendarSyncPayload): Observable<void> {
    return this.http
      .post<void>(endpointFor('auth', '/calendar/google/sync-task'), payload)
      .pipe(catchError((error) => throwError(() => toFriendlyError(error))));
  }
}
