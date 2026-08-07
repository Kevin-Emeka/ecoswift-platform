/**
 * Base class for all domain-level exceptions. Framework-agnostic so it can be
 * thrown from domain/application layers and translated by an HTTP-layer filter.
 */
export class DomainException extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundException extends DomainException {
  constructor(resource: string, identifier: string | number) {
    super(`${resource} with identifier "${identifier}" was not found`, 'NOT_FOUND', 404);
  }
}

export class ConflictException extends DomainException {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}

export class ValidationException extends DomainException {
  constructor(details: unknown) {
    super('Validation failed', 'VALIDATION_ERROR', 422, details);
  }
}

/** A sensitive action needs a fresh MFA code before it can proceed — distinct `code` so callers can prompt for step-up rather than showing a generic error. */
export class MfaRequiredException extends DomainException {
  constructor(message = 'This action requires a verification code') {
    super(message, 'MFA_REQUIRED', 403);
  }
}
