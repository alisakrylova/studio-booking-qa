import { aTitle, expect, test } from './fixtures.ts'

test('E-02 a visitor sees the schedule first and introduces themselves to book @smoke', async ({
  studio,
  visitor,
}) => {
  const title = aTitle('Evening flow')

  await test.step('the studio opens a class', async () => {
    const response = await studio.post('/classes', {
      data: {
        title,
        startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        capacity: 4,
      },
    })
    expect(
      response.status(),
      `the studio could not open a class: ${await response.text()} — do the server and the tests agree on STUDIO_KEY?`,
    ).toBe(201)
  })

  const card = visitor.getByTestId('class-card').filter({ hasText: title })

  await test.step('the schedule is readable without saying who you are', async () => {
    await visitor.goto('/')

    await expect(card).toContainText('seats free')
    await expect(card.getByRole('button')).toHaveCount(0)
  })

  await test.step('introducing yourself brings the actions', async () => {
    await visitor.getByLabel('Name').fill('Anna')
    await visitor.getByLabel('Email').fill('anna@example.com')
    await visitor.getByRole('button', { name: 'Continue' }).click()

    await expect(card.getByRole('button', { name: 'Book' })).toBeVisible()
  })

  await test.step('and the booking lands in my bookings', async () => {
    await card.getByRole('button', { name: 'Book' }).click()

    await expect(visitor.getByTestId('my-booking').filter({ hasText: title })).toBeVisible()
  })
})
