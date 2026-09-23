import { test as base, expect, request, type APIRequestContext } from '@playwright/test'
import { z } from 'zod'

const baseURL = `http://localhost:${process.env.PORT ?? 3000}`
const studioKey = process.env.STUDIO_KEY ?? 'studio-key-for-tests'

/**
 * Schemas are declared here, not imported from the app: a test that reuses the
 * app's own schema only checks the app against itself.
 */
export const clientSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
})

export const bookingSchema = z.strictObject({
  id: z.string(),
  classId: z.string(),
  clientId: z.string(),
  status: z.enum(['booked', 'waitlisted', 'cancelled', 'attended']),
  position: z.number().nullable(),
  createdAt: z.string(),
})

export const classSchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  startsAt: z.string(),
  capacity: z.number(),
  seatsFree: z.number(),
  waitlistCount: z.number(),
  myBooking: z
    .strictObject({
      id: z.string(),
      status: z.string(),
      position: z.number().nullable(),
    })
    .nullable(),
})

const errorSchema = z.strictObject({
  error: z.strictObject({
    code: z.string(),
    message: z.string(),
    field: z.string().nullable(),
  }),
})

/** Every failure goes through here, so each case asserts the envelope as well as the code. */
export async function expectRefusal(
  response: { status(): number; json(): Promise<unknown> },
  status: number,
  code: string,
  field: string | null = null,
) {
  expect(response.status()).toBe(status)
  const body = errorSchema.parse(await response.json())
  expect(body.error).toMatchObject({ code, field })
}

export type Client = { api: APIRequestContext; id: string; name: string }

export const inAnHour = () => new Date(Date.now() + 60 * 60 * 1000).toISOString()
export const anHourAgo = () => new Date(Date.now() - 60 * 60 * 1000).toISOString()

/** Tests share one schedule, so every class carries a title only its test uses. */
let titles = 0
export const aTitle = (about: string) => `${about} ${process.pid}-${++titles}`

type Fixtures = {
  studio: APIRequestContext
  stranger: APIRequestContext
  client: Client
  newClient: (name?: string) => Promise<Client>
  newClass: (over?: { startsAt?: string; capacity?: number; title?: string }) => Promise<
    z.infer<typeof classSchema>
  >
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

  stranger: async ({}, use) => {
    const api = await request.newContext({ baseURL })
    await use(api)
    await api.dispose()
  },

  newClient: async ({}, use) => {
    const opened: APIRequestContext[] = []

    await use(async (name = 'Anna') => {
      const api = await request.newContext({ baseURL })
      opened.push(api)

      const response = await api.post('/clients', {
        data: { name, email: `${name.toLowerCase()}@example.com` },
      })
      expect(response.status()).toBe(201)
      const client = clientSchema.parse(await response.json())

      return { api, id: client.id, name: client.name }
    })

    for (const api of opened) await api.dispose()
  },

  client: async ({ newClient }, use) => {
    await use(await newClient())
  },

  newClass: async ({ studio }, use) => {
    await use(async (over = {}) => {
      const response = await studio.post('/classes', {
        data: {
          title: over.title ?? aTitle('Class'),
          startsAt: over.startsAt ?? inAnHour(),
          capacity: over.capacity ?? 1,
        },
      })
      expect(response.status()).toBe(201)
      return classSchema.parse(await response.json())
    })
  },
})

export { expect, request }
