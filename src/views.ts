import { positionOf, seatsFree, waitlist, type Booking, type StudioClass } from './rules.ts'
import { bookingsOfClass, classById, clientById, type Client } from './store.ts'

const asTime = (value: number) => new Date(value).toISOString()

export const clientView = (client: Client) => ({
  id: client.id,
  name: client.name,
  email: client.email ?? null,
  phone: client.phone ?? null,
})

export const bookingView = (booking: Booking, siblings: Booking[]) => ({
  id: booking.id,
  classId: booking.classId,
  clientId: booking.clientId,
  status: booking.status,
  position: positionOf(booking, siblings),
  createdAt: asTime(booking.createdAt),
})

/** What a schedule card is drawn from, including the reader's own booking. */
export function classView(
  studioClass: StudioClass,
  viewerId: string | null,
  siblings = bookingsOfClass(studioClass.id),
) {
  const mine = viewerId
    ? siblings.find((b) => b.clientId === viewerId && b.status !== 'cancelled')
    : undefined

  return {
    id: studioClass.id,
    title: studioClass.title,
    startsAt: asTime(studioClass.startsAt),
    capacity: studioClass.capacity,
    seatsFree: seatsFree(studioClass, siblings),
    waitlistCount: waitlist(siblings).length,
    myBooking: mine
      ? { id: mine.id, status: mine.status, position: positionOf(mine, siblings) }
      : null,
  }
}

/** The studio's roster: the room first, then the queue, each with the person. */
export function rosterView(studioClass: StudioClass) {
  const siblings = bookingsOfClass(studioClass.id)
  const inTheRoom = siblings
    .filter((b) => b.status === 'booked' || b.status === 'attended')
    .sort((a, b) => a.createdAt - b.createdAt)

  return [...inTheRoom, ...waitlist(siblings)].map((booking) => ({
    ...bookingView(booking, siblings),
    client: clientView(clientById(booking.clientId)!),
  }))
}

/** A client's own bookings, each carrying the class it belongs to. */
export const myBookingsView = (own: Booking[]) =>
  own
    .filter((booking) => booking.status !== 'cancelled')
    .map((booking) => {
      const siblings = bookingsOfClass(booking.classId)
      return {
        ...bookingView(booking, siblings),
        class: classView(classById(booking.classId)!, booking.clientId, siblings),
      }
    })
