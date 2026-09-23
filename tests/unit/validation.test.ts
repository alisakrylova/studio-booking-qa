import { describe, expect, test } from 'vitest'
import {
  CLIENT_FIELDS,
  firstInvalidField,
  validateClass,
  validateClient,
} from '../../src/validation.ts'

const client = (over: Record<string, unknown> = {}) =>
  validateClient({ name: 'Anna', email: 'anna@example.com', ...over })

const studioClass = (over: Record<string, unknown> = {}) =>
  validateClass({
    title: 'Morning flow',
    startsAt: '2026-01-01T10:00:00Z',
    capacity: 8,
    ...over,
  })

const chars = (count: number) => 'a'.repeat(count)

/** A well-formed address of exactly `total` characters. */
const addressOf = (total: number) => `${chars(total - '@example.com'.length)}@example.com`

describe('client fields', () => {
  test('V-01 a name of 1 and 100 characters is accepted, empty and 101 are not', () => {
    expect(client({ name: 'A' }).ok).toBe(true)
    expect(client({ name: chars(100) }).ok).toBe(true)
    expect(client({ name: '' })).toEqual({ ok: false, field: 'name' })
    expect(client({ name: chars(101) })).toEqual({ ok: false, field: 'name' })
  })

  test('V-02 an address of 255 characters is accepted, 256 is not', () => {
    expect(addressOf(255)).toHaveLength(255)
    expect(client({ email: addressOf(255) }).ok).toBe(true)
    expect(client({ email: addressOf(256) })).toEqual({ ok: false, field: 'email' })
  })

  test('V-03 the address has to look like local@domain.tld', () => {
    expect(client({ email: 'anna@example.co' }).ok).toBe(true)
    expect(client({ email: 'a@b' })).toEqual({ ok: false, field: 'email' })
    expect(client({ email: 'a@b.' })).toEqual({ ok: false, field: 'email' })
    expect(client({ email: 'a@.b' })).toEqual({ ok: false, field: 'email' })
    expect(client({ email: '@example.com' })).toEqual({ ok: false, field: 'email' })
    expect(client({ email: 'anna@@example.com' })).toEqual({ ok: false, field: 'email' })
    expect(client({ email: 'anna@example.com@evil.com' })).toEqual({
      ok: false,
      field: 'email',
    })
  })

  test('V-04 a phone of 5 and 30 characters is accepted, 4 and 31 are not', () => {
    const noEmail = { email: undefined }
    expect(client({ ...noEmail, phone: chars(5) }).ok).toBe(true)
    expect(client({ ...noEmail, phone: chars(30) }).ok).toBe(true)
    expect(client({ ...noEmail, phone: chars(4) })).toEqual({ ok: false, field: 'phone' })
    expect(client({ ...noEmail, phone: chars(31) })).toEqual({ ok: false, field: 'phone' })
  })

  test('V-05 a client needs an email or a phone, and either one alone is enough', () => {
    expect(client({ email: undefined, phone: undefined })).toEqual({
      ok: false,
      field: 'email',
    })
    expect(client({ email: 'anna@example.com', phone: undefined }).ok).toBe(true)
    expect(client({ email: undefined, phone: '+31612345678' }).ok).toBe(true)
  })

  test('V-06 when two fields are invalid the first one in the table is named', () => {
    expect(client({ name: '', email: 'a@b' })).toEqual({ ok: false, field: 'name' })
    expect(client({ email: 'a@b', phone: chars(4) })).toEqual({
      ok: false,
      field: 'email',
    })
    // "at least one of the two" sits below phone in the table, so a phone that
    // is invalid on its own is named before the missing contact
    expect(client({ email: undefined, phone: chars(4) })).toEqual({
      ok: false,
      field: 'phone',
    })
    expect(studioClass({ title: '', capacity: 0 })).toEqual({
      ok: false,
      field: 'title',
    })
  })

  // zod happens to report failures in the order the fields are declared, so
  // this rule cannot be observed through validateClient alone
  test('V-11 the field named is the first in the table, whatever order failures arrive in', () => {
    expect(firstInvalidField(['phone', 'email'], CLIENT_FIELDS)).toBe('email')
    expect(firstInvalidField(['phone'], CLIENT_FIELDS)).toBe('phone')
    expect(firstInvalidField(['nickname'], CLIENT_FIELDS)).toBe('name')
    expect(firstInvalidField([], CLIENT_FIELDS)).toBe('name')
  })

  test('V-10 a body that is not an object names the first field of the table', () => {
    expect(validateClient('Anna')).toEqual({ ok: false, field: 'name' })
    expect(validateClass(null)).toEqual({ ok: false, field: 'title' })
  })

  test('an unknown field is dropped rather than rejected', () => {
    const result = client({ nickname: 'anna-yoga' })

    expect(result.ok).toBe(true)
    expect(result).toMatchObject({ value: { name: 'Anna' } })
    expect(result.ok && 'nickname' in result.value).toBe(false)
  })
})

describe('class fields', () => {
  test('V-07 capacity is a whole number of at least 1 and startsAt is ISO 8601', () => {
    expect(studioClass({ capacity: 1 }).ok).toBe(true)
    expect(studioClass({ capacity: 0 })).toEqual({ ok: false, field: 'capacity' })
    expect(studioClass({ capacity: 2.5 })).toEqual({ ok: false, field: 'capacity' })
    expect(studioClass({ startsAt: 'tomorrow at ten' })).toEqual({
      ok: false,
      field: 'startsAt',
    })
    expect(studioClass({ startsAt: '2026-01-01T12:00:00+02:00' })).toEqual({
      ok: false,
      field: 'startsAt',
    })
  })

  test('a class in the past is accepted: the studio is trusted with the time', () => {
    expect(studioClass({ startsAt: '2020-01-01T10:00:00Z' }).ok).toBe(true)
  })
})
