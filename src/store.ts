import { randomUUID } from 'node:crypto'
import type { Booking, StudioClass } from './rules.ts'

export type Client = {
  id: string
  name: string
  email?: string | undefined
  phone?: string | undefined
}

/**
 * Everything lives in memory: a restart is a fresh studio. The layer exists so
 * the rules never see a database, and so swapping one in later is one file.
 */
const clients = new Map<string, Client>()
const tokens = new Map<string, string>()
const classes = new Map<string, StudioClass>()
const bookings = new Map<string, Booking>()

export function createClient(input: {
  name: string
  email?: string | undefined
  phone?: string | undefined
}) {
  const client: Client = { id: randomUUID(), ...input }
  const token = randomUUID()

  clients.set(client.id, client)
  tokens.set(token, client.id)

  return { client, token }
}

export function clientByToken(token: string | undefined) {
  if (!token) return undefined
  const id = tokens.get(token)
  return id ? clients.get(id) : undefined
}

export const clientById = (id: string) => clients.get(id)

export function createClass(input: { title: string; startsAt: number; capacity: number }) {
  const studioClass: StudioClass = { id: randomUUID(), ...input }
  classes.set(studioClass.id, studioClass)
  return studioClass
}

export const classById = (id: string) => classes.get(id)

/** Soonest first; classes that start at the same time keep the order they were created in. */
export const allClasses = () =>
  [...classes.values()].sort((a, b) => a.startsAt - b.startsAt)

export const bookingById = (id: string) => bookings.get(id)

export const bookingsOfClass = (classId: string) =>
  [...bookings.values()].filter((b) => b.classId === classId)

export const bookingsOfClient = (clientId: string) =>
  [...bookings.values()].filter((b) => b.clientId === clientId)

/** The rules hand back the whole list for a class; storing it is this layer's job. */
export function saveBookings(next: Booking[]) {
  for (const booking of next) bookings.set(booking.id, booking)
}
