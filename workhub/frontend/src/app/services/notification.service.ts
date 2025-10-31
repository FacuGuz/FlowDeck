import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { Notification } from '../interfaces/notification';
import { endpointFor } from './api-config';
import { toFriendlyError } from './error.utils';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);

  list(params?: { userId?: number }): Observable<Notification[]> {
    let httpParams = new HttpParams();
    if (params?.userId != null) {
      httpParams = httpParams.set('userId', params.userId);
    }

    return this.http
      .get<Notification[]>(endpointFor('notifications', '/notifications'), { params: httpParams })
      .pipe(catchError((error) => throwError(() => toFriendlyError(error))));
  }

  markAsRead(id: number): Observable<Notification> {
    return this.http
      .post<Notification>(endpointFor('notifications', `/notifications/${id}/read`), {})
      .pipe(catchError((error) => throwError(() => toFriendlyError(error))));
  }
}
