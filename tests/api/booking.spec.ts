import { anHourAgo, bookingSchema, expect, expectRefusal, test } from './fixtures.ts'

test('A-01 booking a class with a free seat @smoke', async ({ client, newClass }) => {
  const studioClass = await newClass({ capacity: 1 })

  const response = await client.api.post(`/classes/${studioClass.id}/bookings`)

  expect(response.status()).toBe(201)
  const booking = bookingSchema.parse(await response.json())
  expect(booking).toMatchObject({
    classId: studioClass.id,
    clientId: client.id,
    status: 'booked',
    position: null,
  })
})

test('A-02 a full class puts the next client on the waitlist', async ({
  client,
  newClient,
  newClass,
}) => {
  const studioClass = await newClass({ capacity: 1 })
  await client.api.post(`/classes/${studioClass.id}/bookings`)
  const second = await newClient('Bea')

  const response = await second.api.post(`/classes/${studioClass.id}/bookings`)

  expect(response.status()).toBe(201)
  expect(bookingSchema.parse(await response.json())).toMatchObject({
    status: 'waitlisted',
    position: 1,
  })

  const schedule = await (await second.api.get('/classes')).json()
  const seen = schedule.items.find((item: { id: string }) => item.id === studioClass.id)
  expect(seen).toMatchObject({ seatsFree: 0, waitlistCount: 1 })
})

test('A-03 booking the same class twice', async ({ client, newClass }) => {
  const studioClass = await newClass({ capacity: 2 })
  await client.api.post(`/classes/${studioClass.id}/bookings`)

  const response = await client.api.post(`/classes/${studioClass.id}/bookings`)

  await expectRefusal(response, 409, 'already_booked')
})

test('A-04 booking a class that already started', async ({ client, newClass }) => {
  const studioClass = await newClass({ startsAt: anHourAgo() })

  const response = await client.api.post(`/classes/${studioClass.id}/bookings`)

  await expectRefusal(response, 409, 'class_started')
})
