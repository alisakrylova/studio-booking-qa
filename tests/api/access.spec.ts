import { expectRefusal, matchingBooking, test } from './fixtures.ts'

test('A-11 booking without credentials', async ({ stranger, newClass }) => {
  const studioClass = await newClass()

  const response = await stranger.post(`/classes/${studioClass.id}/bookings`)

  await expectRefusal(response, 401, 'unauthenticated')
})

test('A-12 a client token on a studio endpoint', async ({ client, newClass }) => {
  const studioClass = await newClass()

  const response = await client.api.get(`/classes/${studioClass.id}/bookings`)

  await expectRefusal(response, 403, 'forbidden')
})

test('A-13 cancelling a booking that belongs to someone else', async ({
  client,
  newClient,
  newClass,
}) => {
  const studioClass = await newClass({ capacity: 2 })
  const booking = matchingBooking(
    await (await client.api.post(`/classes/${studioClass.id}/bookings`)).json(),
  )
  const second = await newClient('Bea')

  const response = await second.api.post(`/bookings/${booking.id}/cancel`)

  await expectRefusal(response, 403, 'forbidden')
})

test('A-14 booking a class that does not exist', async ({ client }) => {
  const response = await client.api.post(
    '/classes/2a4f1f2c-0000-4000-8000-000000000000/bookings',
  )

  await expectRefusal(response, 404, 'not_found')
})

test('A-15 cancelling an id in a shape ids never take', async ({ client }) => {
  const response = await client.api.post('/bookings/abc/cancel')

  await expectRefusal(response, 404, 'not_found')
})

test('A-20 a studio key the server does not know', async ({ stranger, newClass }) => {
  const studioClass = await newClass()

  const response = await stranger.get(`/classes/${studioClass.id}/bookings`, {
    headers: { 'x-studio-key': 'not-the-key' },
  })

  await expectRefusal(response, 401, 'unauthenticated')
})
