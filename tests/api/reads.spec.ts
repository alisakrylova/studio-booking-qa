import {
  anHourAgo,
  aTitle,
  bookingSchema,
  classSchema,
  clientSchema,
  expect,
  inAnHour,
  request,
  test,
} from './fixtures.ts'

test('A-16 the schedule comes back soonest first, started classes included', async ({
  stranger,
  newClass,
}) => {
  const label = aTitle('Ordered')

  const { later, started, soon } = await test.step(
    'three classes, created in the wrong order and one of them already started',
    async () => ({
      later: await newClass({ title: `${label} later`, startsAt: inAnHour() }),
      started: await newClass({ title: `${label} started`, startsAt: anHourAgo() }),
      soon: await newClass({
        title: `${label} soon`,
        startsAt: new Date(Date.now() + 60_000).toISOString(),
        capacity: 3,
      }),
    }),
  )

  await test.step('the schedule sorts them by their start, started one included', async () => {
    const schedule = await (await stranger.get('/classes')).json()
    const mine = schedule.items
      .map((item: unknown) => classSchema.parse(item))
      .filter((item: { title: string }) => item.title.startsWith(label))

    expect(mine.map((item: { id: string }) => item.id)).toEqual([
      started.id,
      soon.id,
      later.id,
    ])
    expect(mine[1]).toMatchObject({ seatsFree: 3, waitlistCount: 0 })
  })
})

test('A-17 myBooking belongs to whoever is asking', async ({
  client,
  newClass,
  stranger,
  studio,
}) => {
  const studioClass = await newClass({ capacity: 1 })
  const booking = bookingSchema.parse(
    await (await client.api.post(`/classes/${studioClass.id}/bookings`)).json(),
  )

  const seenBy = async (api: typeof stranger) => {
    const response = await api.get('/classes')
    expect(response.status()).toBe(200)
    const body = await response.json()
    return {
      me: body.me,
      mine: body.items.find((item: { id: string }) => item.id === studioClass.id).myBooking,
    }
  }

  await test.step('the client sees their own booking', async () => {
    const seen = await seenBy(client.api)
    expect(seen.me).toMatchObject({ id: client.id, name: client.name })
    expect(seen.mine).toMatchObject({ id: booking.id, status: 'booked' })
  })

  await test.step('the studio and a stranger see nobody', async () => {
    expect(await seenBy(studio)).toMatchObject({ me: null, mine: null })
    expect(await seenBy(stranger)).toMatchObject({ me: null, mine: null })
  })

  await test.step('a cookie the server never issued is treated as none', async () => {
    const withAStaleCookie = await request.newContext({
      baseURL: `http://localhost:${process.env.PORT ?? 3000}`,
      extraHTTPHeaders: { cookie: 'token=0e5f1a2b-dead-4000-8000-000000000000' },
    })

    expect(await seenBy(withAStaleCookie)).toMatchObject({ me: null, mine: null })
    await withAStaleCookie.dispose()
  })
})

test('A-18 a client sees their own active bookings, with the class on each', async ({
  client,
  newClient,
  newClass,
}) => {
  const { taken, free } = await test.step('Bea has bookings of her own', async () => {
    const taken = await newClass({ capacity: 1, title: aTitle('Taken') })
    const free = await newClass({ capacity: 2, title: aTitle('Free') })

    const other = await newClient('Bea')
    await other.api.post(`/classes/${taken.id}/bookings`)
    await other.api.post(`/classes/${free.id}/bookings`)

    return { taken, free }
  })

  await test.step('Anna takes a seat, joins a queue, and leaves a third class', async () => {
    const leaving = await newClass({ capacity: 2, title: aTitle('Leaving') })

    await client.api.post(`/classes/${free.id}/bookings`)
    await client.api.post(`/classes/${taken.id}/bookings`)
    const dropped = bookingSchema.parse(
      await (await client.api.post(`/classes/${leaving.id}/bookings`)).json(),
    )
    await client.api.post(`/bookings/${dropped.id}/cancel`)
  })

  await test.step('Anna sees her two live bookings and neither the cancelled one nor Bea', async () => {
    const mine = await (await client.api.get('/me/bookings')).json()

    expect(mine.items).toHaveLength(2)
    expect(mine.items.map((item: { class: { id: string } }) => item.class.id).sort()).toEqual(
      [free.id, taken.id].sort(),
    )
    const waiting = mine.items.find((item: { status: string }) => item.status === 'waitlisted')
    const seated = mine.items.find((item: { status: string }) => item.status === 'booked')
    expect(waiting).toMatchObject({ position: 1, class: { id: taken.id } })
    expect(seated).toMatchObject({ position: null, class: { id: free.id } })
  })
})

test('A-19 the session cookie is the only place the token appears', async ({ stranger }) => {
  const response = await stranger.post('/clients', {
    data: { name: 'Anna', email: 'anna@example.com' },
  })

  expect(response.status()).toBe(201)
  const cookie = response
    .headersArray()
    .find((header) => header.name.toLowerCase() === 'set-cookie')!.value

  expect(cookie).toContain('HttpOnly')
  expect(cookie).toContain('SameSite=Strict')
  expect(cookie).toContain('Path=/')
  expect(cookie).toContain('Max-Age=2592000')

  // read the body as text: parsing it first would drop an extra field and
  // hide exactly the mistake this case is about
  const token = cookie.split('=')[1]!.split(';')[0]!
  const raw = await response.text()
  expect(raw).not.toContain(token)
  clientSchema.parse(JSON.parse(raw))
})
