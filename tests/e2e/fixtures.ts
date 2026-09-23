import { test as base, expect, request, type APIRequestContext, type Browser, type Page } from '@playwright/test'

const baseURL = `http://localhost:${process.env.PORT ?? 3000}`
const studioKey = process.env.STUDIO_KEY ?? 'studio-key-for-tests'

let titles = 0
export const aTitle = (about: string) => `${about} ${process.pid}-${++titles}`

/**
 * A client is created through the API and its cookie handed to a browser
 * context: filling the form again in every test would test the form, not the
 * story the scenario is about.
 */
async function clientPage(browser: Browser, name: string) {
  const api = await request.newContext({ baseURL })
  const response = await api.post('/clients', {
    data: { name, email: `${name.toLowerCase()}@example.com` },
  })
  expect(response.status()).toBe(201)

  const cookie = response
    .headersArray()
    .find((header) => header.name.toLowerCase() === 'set-cookie')!.value
  const token = cookie.split('=')[1]!.split(';')[0]!
  await api.dispose()

  const context = await browser.newContext({ baseURL })
  await context.addCookies([
    { name: 'token', value: token, domain: 'localhost', path: '/' },
  ])

  return context.newPage()
}

type Fixtures = {
  studio: APIRequestContext
  as: (name: string) => Promise<Page>
}

export const test = base.extend<Fixtures>({
  studio: async ({}, use) => {
    const api = await request.newContext({
      baseURL,
      extraHTTPHeaders: { 'x-studio-key': studioKey },
    })
    await use(api)
    await api.dispose()
  },

  as: async ({ browser }, use) => {
    await use((name) => clientPage(browser, name))
  },
})

export { expect }
