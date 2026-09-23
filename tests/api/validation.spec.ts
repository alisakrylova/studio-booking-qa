import { aTitle, expect, expectRefusal, test } from './fixtures.ts'

test('A-09 a client with neither an email nor a phone', async ({ stranger }) => {
  const response = await stranger.post('/clients', { data: { name: 'Anna' } })

  await expectRefusal(response, 400, 'validation_failed', 'email')
})

test('A-10 a class with no seats is refused before anything is created', async ({
  studio,
  stranger,
}) => {
  const title = aTitle('Class with no seats')

  const response = await studio.post('/classes', {
    data: { title, startsAt: new Date().toISOString(), capacity: 0 },
  })

  await expectRefusal(response, 400, 'validation_failed', 'capacity')

  const schedule = await (await stranger.get('/classes')).json()
  expect(schedule.items.map((item: { title: string }) => item.title)).not.toContain(title)
})
