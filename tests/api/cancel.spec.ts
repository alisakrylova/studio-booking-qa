import { bookingSchema, expect, expectRefusal, test } from './fixtures.ts'

test('A-05 cancelling frees the seat and the first in the queue takes it @smoke', async ({
  client,
  newClient,
  newClass,
  studio,
}) => {
  const studioClass = await newClass({ capacity: 1 })
  const second = await newClient('Bea')

  const { seat, queued } = await test.step('one seat, Anna in it and Bea waiting', async () => {
    const seat = bookingSchema.parse(
      await (await client.api.post(`/classes/${studioClass.id}/bookings`)).json(),
    )
    const queued = bookingSchema.parse(
      await (await second.api.post(`/classes/${studioClass.id}/bookings`)).json(),
    )
    expect(queued.status).toBe('waitlisted')
    return { seat, queued }
  })

  await test.step('Anna cancels', async () => {
    const response = await client.api.post(`/bookings/${seat.id}/cancel`)

    expect(response.status()).toBe(200)
    expect(bookingSchema.parse(await response.json())).toMatchObject({
      id: seat.id,
      status: 'cancelled',
    })
  })

  await test.step('the roster now has Bea in the room', async () => {
    const roster = await (await studio.get(`/classes/${studioClass.id}/bookings`)).json()
    expect(roster.items).toEqual([
      expect.objectContaining({ id: queued.id, status: 'booked' }),
    ])
  })
})

test('A-06 cancelling a booking the studio has marked as attended', async ({
  client,
  newClass,
  studio,
}) => {
  const studioClass = await newClass({ capacity: 1 })
  const booking = bookingSchema.parse(
    await (await client.api.post(`/classes/${studioClass.id}/bookings`)).json(),
  )
  await studio.post(`/bookings/${booking.id}/attend`)

  const response = await client.api.post(`/bookings/${booking.id}/cancel`)

  await expectRefusal(response, 409, 'not_cancellable')
})
