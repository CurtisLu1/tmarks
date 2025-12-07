export interface ValidationFieldErrors {
  [key: string]: string | undefined;
}

export class DatabaseError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class NotFoundError extends Error {
  constructor(public readonly resource: string, public readonly id: string) {
    super(`${resource} with id ${id} not found`);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly fields?: ValidationFieldErrors) {
    super(message);
    this.name = 'ValidationError';
  }
}


