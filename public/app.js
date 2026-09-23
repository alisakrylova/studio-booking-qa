import { renderMyBookings, renderSchedule } from './render.js'

const identity = document.querySelector('#identity')
const scheduleBox = document.querySelector('#schedule')
const mineBox = document.querySelector('#mine')
const mineSection = document.querySelector('#mine-section')
const toasts = document.querySelector('#toasts')

/** The page picks its wording from the code, never from the server's message. */
const SAYINGS = {
  class_started: 'This class has already started.',
  already_booked: "You're already on the list for this class.",
  not_cancellable: 'The studio has already marked you as attended.',
  not_found: 'This class is no longer available.',
  unauthenticated: 'Your session has ended. Enter your details again.',
  forbidden: "You can't do that.",
}

const SOMETHING_WENT_WRONG = 'Something went wrong. Please try again.'

function say(message) {
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.textContent = message
  toasts.append(toast)
  setTimeout(() => toast.remove(), 4000)
}

async function send(path, options = {}) {
  try {
    const response = await fetch(path, { headers: { 'content-type': 'application/json' }, ...options })
    const body = response.status === 204 ? null : await response.json()
    return { ok: response.ok, status: response.status, body }
  } catch {
    return { ok: false, status: 0, body: null }
  }
}

function complain(result) {
  const code = result.body?.error?.code
  if (code === 'unauthenticated') {
    say(SAYINGS.unauthenticated)
    show(null)
    return
  }
  say(SAYINGS[code] ?? SOMETHING_WENT_WRONG)
}

let me = null

function show(who) {
  me = who
  identity.hidden = Boolean(who)
  mineSection.hidden = !who
}

async function load() {
  const schedule = await send('/classes')
  if (!schedule.ok) {
    scheduleBox.replaceChildren(renderSchedule({ ok: false }))
    return
  }

  show(schedule.body.me)
  scheduleBox.replaceChildren(renderSchedule({ ok: true, ...schedule.body }))

  if (!me) return

  const mine = await send('/me/bookings')
  if (mine.ok) mineBox.replaceChildren(renderMyBookings(mine.body.items))
}

/** Disabled only while its own request is in flight, so a double click books once. */
async function whilePressed(button, work) {
  button.disabled = true
  try {
    await work()
  } finally {
    button.disabled = false
  }
}

scheduleBox.addEventListener('click', (event) => {
  const button = event.target.closest('button')
  if (!button) return

  if (button.dataset.action === 'retry') return void load()

  const card = button.closest('[data-class-id]')
  const classId = card.dataset.classId
  const booking = card.dataset.bookingId

  whilePressed(button, async () => {
    if (button.dataset.action === 'book') {
      const result = await send(`/classes/${classId}/bookings`, { method: 'POST' })
      if (!result.ok) return complain(result)
      if (result.body.status === 'waitlisted') {
        say(`The class filled up — you're #${result.body.position} on the waitlist.`)
      }
    } else {
      const result = await send(`/bookings/${booking}/cancel`, { method: 'POST' })
      if (!result.ok) return complain(result)
    }
    await load()
  })
})

const complaints = {
  name: (value) =>
    !value ? 'Enter your name' : value.length > 100 ? 'Use 100 characters or fewer' : '',
  email: (value) =>
    !value
      ? ''
      : value.length > 255
        ? 'Use 255 characters or fewer'
        : /^[^@]+@[^@.][^@]*\.[^@.]+$/.test(value)
          ? ''
          : "This doesn't look like an email address",
  phone: (value) =>
    !value || (value.length >= 5 && value.length <= 30)
      ? ''
      : 'Enter a phone number of 5 to 30 characters',
}

identity.addEventListener('submit', async (event) => {
  event.preventDefault()

  const fields = Object.fromEntries(
    ['name', 'email', 'phone'].map((name) => [name, identity.elements[name].value.trim()]),
  )

  const problems = {
    name: complaints.name(fields.name),
    email: complaints.email(fields.email),
    phone: complaints.phone(fields.phone),
  }
  if (!problems.email && !fields.email && !fields.phone) {
    problems.email = 'Enter an email or a phone number so the studio can reach you'
  }

  for (const [field, problem] of Object.entries(problems)) {
    identity.querySelector(`[data-error-for="${field}"]`).textContent = problem
  }
  if (Object.values(problems).some(Boolean)) return

  const button = identity.querySelector('button[type="submit"]')
  await whilePressed(button, async () => {
    const result = await send('/clients', {
      method: 'POST',
      body: JSON.stringify({
        name: fields.name,
        ...(fields.email ? { email: fields.email } : {}),
        ...(fields.phone ? { phone: fields.phone } : {}),
      }),
    })
    if (!result.ok) return complain(result)
    await load()
  })
})

load()
