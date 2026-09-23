export type ErrorCode =
  | 'validation_failed'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'already_booked'
  | 'class_started'
  | 'not_cancellable'
  | 'not_booked'

/** Every error answer has the same shape; clients read the code, not the message. */
const ANSWERS: Record<ErrorCode, { status: number; message: string }> = {
  validation_failed: { status: 400, message: 'A field is not valid' },
  unauthenticated: { status: 401, message: 'Credentials are missing or unknown' },
  forbidden: { status: 403, message: 'This is not yours to do' },
  not_found: { status: 404, message: 'There is no such thing' },
  already_booked: { status: 409, message: 'There is already a booking on this class' },
  class_started: { status: 409, message: 'The class has already started' },
  not_cancellable: { status: 409, message: 'The booking cannot be cancelled' },
  not_booked: { status: 409, message: 'The booking is not a booked one' },
}

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly field: string | null = null,
  ) {
    super(ANSWERS[code].message)
  }

  get status() {
    return ANSWERS[this.code].status
  }

  get body() {
    return { error: { code: this.code, message: this.message, field: this.field } }
  }
}
