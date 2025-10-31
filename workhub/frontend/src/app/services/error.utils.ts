import { HttpErrorResponse } from '@angular/common/http';

export const friendlyErrorMessage =
  'No fue posible completar la acción. Inténtalo nuevamente.';

export function toFriendlyError(error: unknown, fallback = friendlyErrorMessage): Error {
  if (error instanceof Error) {
    return error;
  }

  if (error instanceof HttpErrorResponse) {
    const message =
      (error.error && typeof error.error === 'object' && 'message' in error.error
        ? (error.error as { message?: string }).message
        : null) ?? error.message;

    return new Error(message || fallback);
  }

  if (typeof error === 'object' && error !== null && 'error' in error) {
    const nested = (error as { error?: { message?: string } }).error;
    if (nested?.message) {
      return new Error(nested.message);
    }
  }

  return new Error(fallback);
}
