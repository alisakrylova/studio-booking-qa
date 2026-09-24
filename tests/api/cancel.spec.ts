import {
  expect,
  expectRefusal,
  matchingBooking,
  test,
  type Client,
} from './fixtures.ts'

test('A-05 cancelling frees the seat and the first in the queue takes it @smoke', async ({
  client,
  newClient,
  newClass,
  studio,
}) => {
  const studioClass = await newClass({ capacity: 1 })
  const second = await newClient('Bea')

  const { seat, queued } = await test.step('one seat, Anna in it and Bea waiting', async () => {
    const seat = matchingBooking(
      await (await client.api.post(`/classes/${studioClass.id}/bookings`)).json(),
    )
    const queued = matchingBooking(
      await (await second.api.post(`/classes/${studioClass.id}/bookings`)).json(),
    )
    expect(queued.status).toBe('waitlisted')
    return { seat, queued }
  })

  await test.step('Anna cancels', async () => {
    const response = await client.api.post(`/bookings/${seat.id}/cancel`)

    expect(response.status()).toBe(200)
    expect(matchingBooking(await response.json())).toMatchObject({
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
  const booking = matchingBooking(
    await (await client.api.post(`/classes/${studioClass.id}/bookings`)).json(),
  )
  await studio.post(`/bookings/${booking.id}/attend`)

  const response = await client.api.post(`/bookings/${booking.id}/cancel`)

  await expectRefusal(response, 409, 'not_cancellable')
})

test('A-21 leaving the queue moves the people behind, and nobody into the room', async ({
  client,
  newClient,
  newClass,
  studio,
}) => {
  const studioClass = await newClass({ capacity: 1 })
  const bea = await newClient('Bea')
  const cleo = await newClient('Cleo')

  const bookAs = async (who: Client) =>
    matchingBooking(
      await (await who.api.post(`/classes/${studioClass.id}/bookings`)).json(),
    )

  const seat = await bookAs(client)
  const leaving = await bookAs(bea)
  const behind = await bookAs(cleo)
  expect(behind.position).toBe(2)

  const response = await bea.api.post(`/bookings/${leaving.id}/cancel`)

  expect(response.status()).toBe(200)
  expect(matchingBooking(await response.json())).toMatchObject({
    id: leaving.id,
    status: 'cancelled',
    position: null,
  })

  const roster = await (await studio.get(`/classes/${studioClass.id}/bookings`)).json()
  expect(roster.items).toEqual([
    expect.objectContaining({ id: seat.id, status: 'booked' }),
    expect.objectContaining({ id: behind.id, status: 'waitlisted', position: 1 }),
  ])

  const schedule = await (await cleo.api.get('/classes')).json()
  const seen = schedule.items.find((item: { id: string }) => item.id === studioClass.id)
  expect(seen).toMatchObject({ seatsFree: 0, waitlistCount: 1 })
})

test('A-22 cancelling twice changes nothing the second time', async ({
  client,
  newClass,
}) => {
  const studioClass = await newClass({ capacity: 1 })
  const booking = matchingBooking(
    await (await client.api.post(`/classes/${studioClass.id}/bookings`)).json(),
  )

  const first = await client.api.post(`/bookings/${booking.id}/cancel`)
  const again = await client.api.post(`/bookings/${booking.id}/cancel`)

  expect(first.status()).toBe(200)
  expect(again.status()).toBe(200)
  expect(await again.json()).toEqual(await first.json())
  expect(matchingBooking(await again.json())).toMatchObject({ status: 'cancelled' })
})
