// @vitest-environment jsdom
import { describe, expect, test } from 'vitest'
import { renderMyBookings, renderSchedule } from '../../public/render.js'

const NOW = Date.UTC(2026, 0, 1, 9, 0)
const IN_AN_HOUR = new Date(NOW + 60 * 60 * 1000).toISOString()
const AN_HOUR_AGO = new Date(NOW - 60 * 60 * 1000).toISOString()

type Booking = { id: string; status: string; position: number | null }

const aClass = (over: Record<string, unknown> = {}) => ({
  id: 'class-1',
  title: 'Morning flow',
  startsAt: IN_AN_HOUR,
  capacity: 8,
  seatsFree: 3,
  waitlistCount: 0,
  myBooking: null as Booking | null,
  ...over,
})

const schedule = (over: Record<string, unknown> = {}) =>
  renderSchedule({ ok: true, me: { id: 'anna', name: 'Anna' }, items: [aClass()], ...over }, NOW)

const card = (root: HTMLElement) => root.querySelector('[data-testid="class-card"]')!
const state = (root: HTMLElement) => card(root).querySelector('.class-card__state')!.textContent
const action = (root: HTMLElement) => card(root).querySelector('button')

describe('the schedule', () => {
  test('R-01 no classes at all says so, rather than drawing nothing', () => {
    const root = schedule({ items: [] })

    expect(root.textContent).toContain('No classes scheduled yet.')
    expect(root.querySelector('[data-testid="class-card"]')).toBeNull()
  })

  test('R-02 a visitor the server does not know gets no actions', () => {
    const root = schedule({ me: null })

    expect(state(root)).toBe('3 of 8 seats free')
    expect(action(root)).toBeNull()
  })

  test('R-03 a free seat offers Book', () => {
    const root = schedule()

    expect(state(root)).toBe('3 of 8 seats free')
    expect(action(root)!.textContent).toBe('Book')
  })

  test('R-04 a full class offers the waitlist and says how many wait', () => {
    const root = schedule({ items: [aClass({ seatsFree: 0, waitlistCount: 2 })] })

    expect(state(root)).toBe('Full · 2 waiting')
    expect(action(root)!.textContent).toBe('Join waitlist')

    const nobodyWaiting = schedule({ items: [aClass({ seatsFree: 0, waitlistCount: 0 })] })
    expect(state(nobodyWaiting)).toBe('Full')
  })

  test('R-05 a booking of mine replaces Book with Cancel', () => {
    const root = schedule({
      items: [aClass({ myBooking: { id: 'b1', status: 'booked', position: null } })],
    })

    expect(state(root)).toBe('Booked')
    expect(action(root)!.textContent).toBe('Cancel')
  })

  test('R-06 a place in the queue is shown with its number', () => {
    const root = schedule({
      items: [aClass({ seatsFree: 0, waitlistCount: 2, myBooking: { id: 'b1', status: 'waitlisted', position: 2 } })],
    })

    expect(state(root)).toBe('Waitlisted · #2')
    expect(action(root)!.textContent).toBe('Leave waitlist')
  })

  test('R-07 a started class is dimmed, has no action and drops the seat count', () => {
    const root = schedule({ items: [aClass({ startsAt: AN_HOUR_AGO })] })

    expect(state(root)).toBe('Started')
    expect(card(root).className).toContain('is-started')
    expect(action(root)).toBeNull()
  })

  test('R-08 a started class keeps my own status next to it', () => {
    const root = schedule({
      items: [
        aClass({
          startsAt: AN_HOUR_AGO,
          myBooking: { id: 'b1', status: 'booked', position: null },
        }),
      ],
    })

    expect(state(root)).toBe('Booked · Started')
    expect(action(root)).toBeNull()
  })

  test('R-09 a booking the studio has marked leaves nothing to press', () => {
    const root = schedule({
      items: [aClass({ myBooking: { id: 'b1', status: 'attended', position: null } })],
    })

    expect(state(root)).toBe('Attended')
    expect(action(root)).toBeNull()
  })

  test('R-11 a schedule that did not load looks nothing like an empty one', () => {
    const root = renderSchedule({ ok: false }, NOW)

    expect(root.textContent).toContain("Couldn't load the schedule.")
    expect(root.textContent).not.toContain('No classes scheduled yet.')
    expect(root.querySelector('button')!.textContent).toBe('Retry')
  })
})

describe('my bookings', () => {
  test('R-10 no bookings says so', () => {
    const root = renderMyBookings([])

    expect(root.textContent).toContain('You have no bookings yet. Pick a class above.')
    expect(root.querySelector('[data-testid="my-booking"]')).toBeNull()
  })

  test('a place in the queue carries its number here too', () => {
    const root = renderMyBookings([
      { id: 'b1', status: 'waitlisted', position: 2, class: { id: 'c1', title: 'Morning flow' } },
      { id: 'b2', status: 'booked', position: null, class: { id: 'c2', title: 'Evening flow' } },
    ])

    const items = [...root.querySelectorAll('[data-testid="my-booking"]')]
    expect(items.map((item) => item.textContent)).toEqual([
      'Morning flowWaitlisted · #2',
      'Evening flowBooked',
    ])
  })
})
