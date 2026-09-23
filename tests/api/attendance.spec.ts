import { expect, expectRefusal, matchingBooking, test } from './fixtures.ts'

test('A-07 marking someone who is only on the waitlist', async ({
  client,
  newClient,
  newClass,
  studio,
}) => {
  const studioClass = await newClass({ capacity: 1 })
  await client.api.post(`/classes/${studioClass.id}/bookings`)
  const second = await newClient('Bea')
  const queued = matchingBooking(
    await (await second.api.post(`/classes/${studioClass.id}/bookings`)).json(),
  )

  const response = await studio.post(`/bookings/${queued.id}/attend`)

  await expectRefusal(response, 409, 'not_booked')
})

test('A-08 marking attendance twice changes nothing', async ({
  client,
  newClass,
  studio,
}) => {
  const studioClass = await newClass({ capacity: 1 })
  const booking = matchingBooking(
    await (await client.api.post(`/classes/${studioClass.id}/bookings`)).json(),
  )

  const first = await studio.post(`/bookings/${booking.id}/attend`)
  const again = await studio.post(`/bookings/${booking.id}/attend`)

  expect(first.status()).toBe(200)
  expect(again.status()).toBe(200)
  expect(await again.json()).toEqual(await first.json())
  expect(matchingBooking(await again.json())).toMatchObject({ status: 'attended' })
})
