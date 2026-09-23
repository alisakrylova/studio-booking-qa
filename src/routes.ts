import { Router, type Request, type Response } from 'express'
import { COOKIE_OPTIONS, clientOrNobody, requireClient, requireStudio } from './auth.ts'
import { AppError } from './errors.ts'
import { attend, book, cancel, type Result } from './rules.ts'
import {
  allClasses,
  bookingById,
  bookingsOfClass,
  bookingsOfClient,
  classById,
  createClass,
  createClient,
  saveBookings,
} from './store.ts'
import { bookingView, classView, clientView, myBookingsView, rosterView } from './views.ts'
import { validateClass, validateClient } from './validation.ts'

/**
 * Handlers stay thin and follow the order of checks from the requirements:
 * credentials, actor, body, resource, owner, repeat, rule.
 */
export const routes = Router()

const valid = <T>(result: { ok: true; value: T } | { ok: false; field: string }) => {
  if (!result.ok) throw new AppError('validation_failed', result.field)
  return result.value
}

const theClass = (request: Request) => {
  const studioClass = classById(String(request.params.id))
  if (!studioClass) throw new AppError('not_found')
  return studioClass
}

const theBooking = (request: Request) => {
  const booking = bookingById(String(request.params.id))
  if (!booking) throw new AppError('not_found')
  return booking
}

const decided = <T>(result: Result<T>) => {
  if (!result.ok) throw new AppError(result.code)
  return result.value
}

routes.post('/clients', (request: Request, response: Response) => {
  const input = valid(validateClient(request.body))
  const { client, token } = createClient(input)

  response.cookie('token', token, COOKIE_OPTIONS)
  response.status(201).json(clientView(client))
})

routes.get('/classes', (request: Request, response: Response) => {
  const viewer = clientOrNobody(request)

  response.json({
    items: allClasses().map((studioClass) => classView(studioClass, viewer?.id ?? null)),
    me: viewer ? { id: viewer.id, name: viewer.name } : null,
  })
})

routes.post('/classes', (request: Request, response: Response) => {
  requireStudio(request)
  const input = valid(validateClass(request.body))

  response.status(201).json(classView(createClass(input), null))
})

routes.post('/classes/:id/bookings', (request: Request, response: Response) => {
  const client = requireClient(request)
  const studioClass = theClass(request)

  const { bookings, booking } = decided(
    book(
      studioClass,
      bookingsOfClass(studioClass.id),
      { id: crypto.randomUUID(), clientId: client.id, createdAt: Date.now() },
      Date.now(),
    ),
  )
  saveBookings(bookings)

  response.status(201).json(bookingView(booking, bookings))
})

routes.get('/me/bookings', (request: Request, response: Response) => {
  const client = requireClient(request)

  response.json({ items: myBookingsView(bookingsOfClient(client.id)) })
})

routes.post('/bookings/:id/cancel', (request: Request, response: Response) => {
  const client = requireClient(request)
  const booking = theBooking(request)
  if (booking.clientId !== client.id) throw new AppError('forbidden')

  const studioClass = classById(booking.classId)!
  const { bookings } = decided(
    cancel(studioClass, bookingsOfClass(studioClass.id), booking, Date.now()),
  )
  saveBookings(bookings)

  response.json(bookingView(bookingById(booking.id)!, bookings))
})

routes.get('/classes/:id/bookings', (request: Request, response: Response) => {
  requireStudio(request)

  response.json({ items: rosterView(theClass(request)) })
})

routes.post('/bookings/:id/attend', (request: Request, response: Response) => {
  requireStudio(request)
  const booking = theBooking(request)

  const { bookings } = decided(attend(bookingsOfClass(booking.classId), booking))
  saveBookings(bookings)

  response.json(bookingView(bookingById(booking.id)!, bookings))
})
