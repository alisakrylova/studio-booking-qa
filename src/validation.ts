import { z } from 'zod'

/** The order of the validation table in the requirements, one per request. */
export const CLIENT_FIELDS = ['name', 'email', 'phone'] as const
export const CLASS_FIELDS = ['title', 'startsAt', 'capacity'] as const

const NAME_MAX = 100
const EMAIL_MAX = 255
const PHONE_MIN = 5
const PHONE_MAX = 30
const TITLE_MAX = 100

/** Written out rather than taken from zod, which accepts `a@b` and we do not. */
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
      // Stryker disable next-line StringLiteral: zod's code, our contract is the field
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

/** The first field of the table, whatever order the failures arrive in. */
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
  // Stryker disable next-line StringLiteral: a pathless issue is outside the table anyway
  const failed = issues.map((issue) => String(issue.path[0] ?? ''))
  return firstInvalidField(failed, fields)
}
