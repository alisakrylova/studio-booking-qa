export type BookingStatus = 'booked' | 'waitlisted' | 'cancelled' | 'attended'

export type Booking = {
  id: string
  classId: string
  clientId: string
  status: BookingStatus
  createdAt: number
}

export type StudioClass = {
  id: string
  title: string
  startsAt: number
  capacity: number
}

export type RuleCode =
  | 'already_booked'
  | 'class_started'
  | 'not_cancellable'
  | 'not_booked'

export type Result<T> = { ok: true; value: T } | { ok: false; code: RuleCode }

const ok = <T>(value: T): Result<T> => ({ ok: true, value })
const rejected = (code: RuleCode): Result<never> => ({ ok: false, code })

const ACTIVE: BookingStatus[] = ['booked', 'waitlisted', 'attended']

export const isActive = (booking: Booking) => ACTIVE.includes(booking.status)

export const hasStarted = (studioClass: StudioClass, now: number) =>
  now >= studioClass.startsAt

export function seatsFree(studioClass: StudioClass, bookings: Booking[]) {
  const taken = bookings.filter(
    (b) => b.status === 'booked' || b.status === 'attended',
  ).length
  return studioClass.capacity - taken
}

export function waitlist(bookings: Booking[]) {
  return bookings
    .filter((b) => b.status === 'waitlisted')
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
}

export function positionOf(booking: Booking, bookings: Booking[]) {
  const index = waitlist(bookings).findIndex((b) => b.id === booking.id)
  return index === -1 ? null : index + 1
}

/** Rule 1. A booking of your own is answered before the state of the class. */
export function book(
  studioClass: StudioClass,
  bookings: Booking[],
  fresh: { id: string; clientId: string; createdAt: number },
  now: number,
): Result<{ bookings: Booking[]; booking: Booking }> {
  const own = bookings.find((b) => b.clientId === fresh.clientId && isActive(b))
  if (own) return rejected('already_booked')
  if (hasStarted(studioClass, now)) return rejected('class_started')

  const booking: Booking = {
    id: fresh.id,
    classId: studioClass.id,
    clientId: fresh.clientId,
    status: seatsFree(studioClass, bookings) > 0 ? 'booked' : 'waitlisted',
    createdAt: fresh.createdAt,
  }
  return ok({ bookings: [...bookings, booking], booking })
}

/** Rule 2. A repeat is answered before the rules, so it holds after the start too. */
export function cancel(
  studioClass: StudioClass,
  bookings: Booking[],
  booking: Booking,
  now: number,
): Result<{ bookings: Booking[]; changed: boolean; promotedId: string | null }> {
  if (booking.status === 'cancelled')
    return ok({ bookings, changed: false, promotedId: null })
  if (booking.status === 'attended') return rejected('not_cancellable')
  if (hasStarted(studioClass, now)) return rejected('class_started')

  const promoted = booking.status === 'booked' ? waitlist(bookings)[0] : undefined

  const next = bookings.map((b) => {
    if (b.id === booking.id) return { ...b, status: 'cancelled' as const }
    if (promoted && b.id === promoted.id) return { ...b, status: 'booked' as const }
    return b
  })

  return ok({ bookings: next, changed: true, promotedId: promoted?.id ?? null })
}

export function attend(
  bookings: Booking[],
  booking: Booking,
): Result<{ bookings: Booking[]; changed: boolean }> {
  if (booking.status === 'attended') return ok({ bookings, changed: false })
  if (booking.status !== 'booked') return rejected('not_booked')

  const next = bookings.map((b) =>
    b.id === booking.id ? { ...b, status: 'attended' as const } : b,
  )
  return ok({ bookings: next, changed: true })
}
