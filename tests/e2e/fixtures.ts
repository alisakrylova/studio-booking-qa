import {
  test as base,
  expect,
  request,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test'

const baseURL = `http://localhost:${process.env.PORT ?? 3100}`
const studioKey = process.env.STUDIO_KEY ?? 'studio-key-for-tests'

let titles = 0
export const aTitle = (about: string) => `${about} ${process.pid}-${++titles}`

/** Signed in through the API: E-02 is the scenario about the form. */
function clientPage(browser: Browser, name: string, opened: BrowserContext[]) {
  return base.step(
    `${name} arrives`,
    async () => {
      const api = await request.newContext({ baseURL })
      const response = await api.post('/clients', {
        data: { name, email: `${name.toLowerCase()}@example.com` },
      })
      expect(response.status(), await response.text()).toBe(201)

      const cookie = response
        .headersArray()
        .find((header) => header.name.toLowerCase() === 'set-cookie')!.value
      const token = cookie.split('=')[1]!.split(';')[0]!
      await api.dispose()

      const context = await browser.newContext({ baseURL })
      opened.push(context)
      await context.addCookies([
        { name: 'token', value: token, domain: 'localhost', path: '/' },
      ])

      return context.newPage()
    },
    { box: true },
  )
}

type Fixtures = {
  studio: APIRequestContext
  as: (name: string) => Promise<Page>
  visitor: Page
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

  visitor: async ({ browser }, use) => {
    const context = await browser.newContext({ baseURL })
    await use(await context.newPage())
    await context.close()
  },

  // The code after `use` runs even when the test fails.

  as: async ({ browser }, use) => {
    const opened: BrowserContext[] = []

    await use((name) => clientPage(browser, name, opened))

    for (const context of opened) await context.close()
  },
})

export { expect }
