import type { Request } from 'express'
import { AppError } from './errors.ts'
import { clientByToken, type Client } from './store.ts'

const COOKIE = 'token'

export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict',
  path: '/',
  maxAge: 30 * 24 * 60 * 60 * 1000,
} as const

function tokenOf(request: Request) {
  const header = request.headers.cookie
  if (!header) return undefined

  for (const part of header.split(';')) {
    const [name, ...value] = part.trim().split('=')
    if (name === COOKIE) return decodeURIComponent(value.join('='))
  }
  return undefined
}

const isStudio = (request: Request) =>
  typeof process.env.STUDIO_KEY === 'string' &&
  request.get('x-studio-key') === process.env.STUDIO_KEY

/** On the open endpoints credentials we do not know count as none at all. */
export const clientOrNobody = (request: Request): Client | null =>
  clientByToken(tokenOf(request)) ?? null

export function requireClient(request: Request): Client {
  const client = clientByToken(tokenOf(request))
  if (client) return client

  throw new AppError(isStudio(request) ? 'forbidden' : 'unauthenticated')
}

export function requireStudio(request: Request): void {
  if (isStudio(request)) return

  const knownClient = clientByToken(tokenOf(request))
  const sentAKey = request.get('x-studio-key') !== undefined
  throw new AppError(knownClient && !sentAKey ? 'forbidden' : 'unauthenticated')
}
