/** Every error this layer throws on purpose extends DbError and carries an HTTP status. */
export class DbError extends Error {
  readonly status: number = 500;
}

export interface Issue {
  field: string;
  message: string;
}

/** Bad input. `issues` lists every problem found, for showing next to form fields. */
export class ValidationError extends DbError {
  override readonly status = 400;
  constructor(readonly issues: Issue[]) {
    super(issues.map((i) => `${i.field}: ${i.message}`).join("; "));
    this.name = "ValidationError";
  }
}

export class NotFoundError extends DbError {
  override readonly status = 404;
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/** The current user isn't allowed to change this record. */
export class ForbiddenError extends DbError {
  override readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** The record clashes with an existing one (e.g. a duplicate name). */
export class ConflictError extends DbError {
  override readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
