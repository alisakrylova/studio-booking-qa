import { describe, expect, test } from 'vitest'
import {
  attend,
  book,
  cancel,
  positionOf,
  seatsFree,
  type Booking,
  type BookingStatus,
  type StudioClass,
} from '../../src/rules.ts'

const STARTS_AT = Date.UTC(2026, 0, 1, 10, 0)
const BEFORE = STARTS_AT - 60_000
const AFTER = STARTS_AT + 60_000

const aClass = (capacity: number): StudioClass => ({
  id: 'class-1',
  title: 'Morning flow',
  startsAt: STARTS_AT,
  capacity,
})

let made = 0
const aBooking = (clientId: string, status: BookingStatus): Booking => ({
  id: `booking-${++made}`,
  classId: 'class-1',
  clientId,
  status,
  createdAt: BEFORE - 1000 + made,
})

const bookingBy = (clientId: string, bookings: Booking[]) =>
  bookings.find((b) => b.clientId === clientId)!

const booking = (id: string, bookings: Booking[]) =>
  bookings.find((b) => b.id === id)!

const newcomer = (clientId: string) => ({
  id: `booking-new-${clientId}`,
  clientId,
  createdAt: BEFORE,
})

describe('rule 1 — booking', () => {
  test('U-01 a free seat makes the booking booked, with no place in the queue', () => {
    const result = book(aClass(1), [], newcomer('anna'), BEFORE)

    if (!result.ok) throw new Error(`rejected with ${result.code}`)
    expect(result.value.booking.status).toBe('booked')
    expect(positionOf(result.value.booking, result.value.bookings)).toBeNull()
  })

  test('U-02 a full class makes it waitlisted at position 1', () => {
    const taken = [aBooking('anna', 'booked')]

    const result = book(aClass(1), taken, newcomer('bea'), BEFORE)

    if (!result.ok) throw new Error(`rejected with ${result.code}`)
    expect(result.value.booking.status).toBe('waitlisted')
    expect(positionOf(result.value.booking, result.value.bookings)).toBe(1)
  })

  test('U-03 booking again while booked or waitlisted is rejected', () => {
    const seated = [aBooking('anna', 'booked')]
    const queued = [aBooking('bea', 'booked'), aBooking('anna', 'waitlisted')]

    expect(book(aClass(2), seated, newcomer('anna'), BEFORE)).toEqual({
      ok: false,
      code: 'already_booked',
    })
    expect(book(aClass(2), queued, newcomer('anna'), BEFORE)).toEqual({
      ok: false,
      code: 'already_booked',
    })
  })

  test('U-04 booking again after cancelling a full class joins the end of the waitlist', () => {
    const bookings = [
      aBooking('bea', 'booked'),
      aBooking('cleo', 'waitlisted'),
      aBooking('anna', 'cancelled'),
    ]

    const result = book(aClass(1), bookings, newcomer('anna'), BEFORE)

    if (!result.ok) throw new Error(`rejected with ${result.code}`)
    expect(result.value.booking.status).toBe('waitlisted')
    expect(positionOf(result.value.booking, result.value.bookings)).toBe(2)
  })

  test('U-18 booking again after being marked attended is rejected', () => {
    const bookings = [aBooking('anna', 'attended')]

    expect(book(aClass(2), bookings, newcomer('anna'), BEFORE)).toEqual({
      ok: false,
      code: 'already_booked',
    })
  })

  test('U-21 a started class with an active booking of mine answers already_booked', () => {
    const bookings = [aBooking('anna', 'booked')]

    expect(book(aClass(2), bookings, newcomer('anna'), AFTER)).toEqual({
      ok: false,
      code: 'already_booked',
    })
  })
})

describe('rule 2 — cancellation', () => {
  test('U-05 cancelling with an empty waitlist frees the seat', () => {
    const studioClass = aClass(1)
    const bookings = [aBooking('anna', 'booked')]

    const result = cancel(studioClass, bookings, bookings[0]!, BEFORE)

    if (!result.ok) throw new Error(`rejected with ${result.code}`)
    expect(result.value.changed).toBe(true)
    expect(result.value.promotedId).toBeNull()
    expect(seatsFree(studioClass, result.value.bookings)).toBe(1)
  })

  test('U-06 cancelling with one waiting promotes that client', () => {
    const bookings = [aBooking('anna', 'booked'), aBooking('bea', 'waitlisted')]

    const result = cancel(aClass(1), bookings, bookings[0]!, BEFORE)

    if (!result.ok) throw new Error(`rejected with ${result.code}`)
    expect(bookingBy('bea', result.value.bookings).status).toBe('booked')
  })

  test('U-07 cancelling with two waiting promotes only the first', () => {
    const bookings = [
      aBooking('anna', 'booked'),
      aBooking('bea', 'waitlisted'),
      aBooking('cleo', 'waitlisted'),
    ]

    const result = cancel(aClass(1), bookings, bookings[0]!, BEFORE)

    if (!result.ok) throw new Error(`rejected with ${result.code}`)
    const after = result.value.bookings
    expect(bookingBy('bea', after).status).toBe('booked')
    expect(bookingBy('cleo', after).status).toBe('waitlisted')
    expect(positionOf(bookingBy('cleo', after), after)).toBe(1)
  })

  test('U-08 the first of two waiting leaves and nobody is promoted', () => {
    const bookings = [
      aBooking('anna', 'booked'),
      aBooking('bea', 'waitlisted'),
      aBooking('cleo', 'waitlisted'),
    ]

    const result = cancel(aClass(1), bookings, bookingBy('bea', bookings), BEFORE)

    if (!result.ok) throw new Error(`rejected with ${result.code}`)
    const after = result.value.bookings
    expect(result.value.promotedId).toBeNull()
    expect(bookingBy('anna', after).status).toBe('booked')
    expect(positionOf(bookingBy('cleo', after), after)).toBe(1)
  })

  test('U-22 the queue follows the time each client joined, not the order of the list', () => {
    const anna = aBooking('anna', 'booked')
    const bea = { ...aBooking('bea', 'waitlisted'), createdAt: BEFORE - 100 }
    const cleo = { ...aBooking('cleo', 'waitlisted'), createdAt: BEFORE - 500 }
    const bookings = [anna, bea, cleo]

    expect(positionOf(cleo, bookings)).toBe(1)
    expect(positionOf(bea, bookings)).toBe(2)

    const result = cancel(aClass(1), bookings, anna, BEFORE)

    if (!result.ok) throw new Error(`rejected with ${result.code}`)
    expect(result.value.promotedId).toBe(cleo.id)
  })

  test('U-09 cancelling after the class started is rejected', () => {
    const bookings = [aBooking('anna', 'booked')]

    expect(cancel(aClass(1), bookings, bookings[0]!, AFTER)).toEqual({
      ok: false,
      code: 'class_started',
    })
  })

  test('U-10 cancelling an attended booking is rejected', () => {
    const bookings = [aBooking('anna', 'attended')]

    expect(cancel(aClass(1), bookings, bookings[0]!, BEFORE)).toEqual({
      ok: false,
      code: 'not_cancellable',
    })
  })

  test('U-11 cancelling twice changes nothing, even after the class started', () => {
    const bookings = [aBooking('anna', 'booked')]
    const first = cancel(aClass(1), bookings, bookings[0]!, BEFORE)
    if (!first.ok) throw new Error(`rejected with ${first.code}`)

    const cancelled = booking(bookings[0]!.id, first.value.bookings)
    const again = cancel(aClass(1), first.value.bookings, cancelled, AFTER)

    if (!again.ok) throw new Error(`rejected with ${again.code}`)
    expect(again.value.changed).toBe(false)
    expect(again.value.bookings).toEqual(first.value.bookings)
  })

  test('U-20 an attended booking on a started class answers not_cancellable', () => {
    const bookings = [aBooking('anna', 'attended')]

    expect(cancel(aClass(1), bookings, bookings[0]!, AFTER)).toEqual({
      ok: false,
      code: 'not_cancellable',
    })
  })
})

describe('rule 3 — started classes', () => {
  test('U-12 booking is rejected once now reaches startsAt', () => {
    expect(book(aClass(1), [], newcomer('anna'), STARTS_AT)).toEqual({
      ok: false,
      code: 'class_started',
    })
  })

  test('U-13 booking one millisecond earlier is accepted', () => {
    const result = book(aClass(1), [], newcomer('anna'), STARTS_AT - 1)

    expect(result.ok).toBe(true)
  })
})

describe('rule 4 — attendance', () => {
  test('U-14 a booked booking becomes attended, and only that one', () => {
    const bookings = [aBooking('anna', 'booked'), aBooking('bea', 'booked')]
    const bea = bookingBy('bea', bookings)

    const result = attend(bookings, bea)

    if (!result.ok) throw new Error(`rejected with ${result.code}`)
    expect(booking(bea.id, result.value.bookings).status).toBe('attended')
    expect(bookingBy('anna', result.value.bookings).status).toBe('booked')
    expect(result.value.changed).toBe(true)
  })

  test('U-15 marking a waitlisted booking is rejected', () => {
    const bookings = [aBooking('anna', 'waitlisted')]

    expect(attend(bookings, bookings[0]!)).toEqual({ ok: false, code: 'not_booked' })
  })

  test('U-16 marking a cancelled booking is rejected', () => {
    const bookings = [aBooking('anna', 'cancelled')]

    expect(attend(bookings, bookings[0]!)).toEqual({ ok: false, code: 'not_booked' })
  })

  test('U-17 marking twice changes nothing', () => {
    const bookings = [aBooking('anna', 'booked')]
    const bea = bookings[0]!
    const first = attend(bookings, bea)
    if (!first.ok) throw new Error(`rejected with ${first.code}`)

    const attended = booking(bea.id, first.value.bookings)
    const again = attend(first.value.bookings, attended)

    if (!again.ok) throw new Error(`rejected with ${again.code}`)
    expect(again.value.changed).toBe(false)
    expect(again.value.bookings).toEqual(first.value.bookings)
  })

  test('U-19 a seat held by an attended booking keeps the class full', () => {
    const bookings = [aBooking('anna', 'attended')]

    const result = book(aClass(1), bookings, newcomer('bea'), BEFORE)

    if (!result.ok) throw new Error(`rejected with ${result.code}`)
    expect(seatsFree(aClass(1), bookings)).toBe(0)
    expect(result.value.booking.status).toBe('waitlisted')
  })
})
