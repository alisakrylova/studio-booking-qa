import { arranged, aTitle, expect, test } from './fixtures.ts'

test('E-01 a cancelled seat reaches the first person waiting for it @smoke', async ({
  as,
  studio,
}) => {
  const title = aTitle('Morning flow')

  await test.step('the studio opens a class with a single seat', async () => {
    await arranged(
      await studio.post('/classes', {
        data: {
          title,
          startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          capacity: 1,
        },
      }),
      'opening a class as the studio',
    )
  })

  const anna = await as('Anna')
  const bea = await as('Bea')
  const card = (page: typeof anna) => page.getByTestId('class-card').filter({ hasText: title })

  await test.step('Anna takes the seat', async () => {
    await anna.goto('/')
    await card(anna).getByRole('button', { name: 'Book' }).click()

    await expect(card(anna)).toContainText('Booked')
  })

  await test.step('Bea finds the class full and joins the queue', async () => {
    await bea.goto('/')
    await expect(card(bea)).toContainText('Full')

    await card(bea).getByRole('button', { name: 'Join waitlist' }).click()

    await expect(card(bea)).toContainText('Waitlisted · #1')
  })

  await test.step('Anna cancels, and the seat does not stay free', async () => {
    await card(anna).getByRole('button', { name: 'Cancel' }).click()

    // the seat went straight to Bea, so Anna is offered the queue, not a seat
    await expect(card(anna)).toContainText('Full')
    await expect(card(anna)).not.toContainText('Booked')
  })

  await test.step('Bea reloads and the seat is hers', async () => {
    await bea.reload()

    await expect(card(bea)).toContainText('Booked')
    await expect(card(bea).getByRole('button', { name: 'Cancel' })).toBeVisible()
  })
})
