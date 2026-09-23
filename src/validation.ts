import { z } from 'zod'

/**
 * The order of the validation table in the requirements. A `400` names one
 * field, and when several are invalid it is the first one in this order — per
 * request, because a client and a class have tables of their own.
 */
export const CLIENT_FIELDS = ['name', 'email', 'phone'] as const
export const CLASS_FIELDS = ['title', 'startsAt', 'capacity'] as const

const NAME_MAX = 100
const EMAIL_MAX = 255
const PHONE_MIN = 5
const PHONE_MAX = 30
const TITLE_MAX = 100

/**
 * `local@domain.tld`: exactly one `@`, nothing empty around it, and a dot
 * inside the domain that is neither its first nor its last character. Written
 * out rather than taken from zod, because the requirements are stricter than
 * the library: `a@b` is an address zod accepts and we do not.
 */
function looksLikeAnAddress(value: string) {
  const [local, domain, ...rest] = value.split('@')
  if (!local || !domain || rest.length > 0) return false

  const dot = domain.indexOf('.')
  return dot > 0 && dot < domain.length - 1
}

const email = z.string().max(EMAIL_MAX).refine(looksLikeAnAddress)

export const clientInput = z
  .object({
    name: z.string().min(1).max(NAME_MAX),
    email: email.optional(),
    phone: z.string().min(PHONE_MIN).max(PHONE_MAX).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.email && !value.phone) {
      // Stryker disable next-line StringLiteral: zod's own issue code, while
      // our contract is the field name
      ctx.addIssue({ code: 'custom', path: ['email'] })
    }
  })

export const classInput = z.object({
  title: z.string().min(1).max(TITLE_MAX),
  startsAt: z.iso.datetime().transform(Date.parse),
  capacity: z.int().min(1),
})

export type ClientInput = z.infer<typeof clientInput>
export type ClassInput = z.infer<typeof classInput>

export type Valid<T> = { ok: true; value: T }
export type Invalid = { ok: false; field: string }

/** Unknown fields are dropped on the way in; they do not make a body invalid. */
export const validateClient = (body: unknown) =>
  validate(clientInput, body, CLIENT_FIELDS)

export const validateClass = (body: unknown) =>
  validate(classInput, body, CLASS_FIELDS)

function validate<T>(
  schema: z.ZodType<T>,
  body: unknown,
  fields: readonly string[],
): Valid<T> | Invalid {
  const parsed = schema.safeParse(body)
  if (parsed.success) return { ok: true, value: parsed.data }

  return { ok: false, field: firstFieldOf(parsed.error.issues, fields) }
}

/**
 * Which field a `400` names when several are invalid: the first one in the
 * table, whatever order the failures arrive in. A body that is not an object
 * at all names no field, so it falls back to the first of the table — there is
 * nothing more specific to say.
 */
export function firstInvalidField(
  failed: readonly string[],
  fields: readonly string[],
) {
  const ranks = failed
    .map((field) => fields.indexOf(field))
    .filter((rank) => rank !== -1)
    .sort((a, b) => a - b)

  return fields[ranks[0] ?? 0]!
}

function firstFieldOf(issues: readonly z.core.$ZodIssue[], fields: readonly string[]) {
  // Stryker disable next-line StringLiteral: an issue with no path is outside
  // the table either way, so any replacement behaves the same
  const failed = issues.map((issue) => String(issue.path[0] ?? ''))
  return firstInvalidField(failed, fields)
}
