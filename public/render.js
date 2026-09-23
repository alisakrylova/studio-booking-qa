/** Drawing the schedule, as a pure function of what `GET /classes` answered. */

const element = (tag, className, text) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

const at = (startsAt) =>
  new Date(startsAt).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

const hasStarted = (studioClass, now) => now >= Date.parse(studioClass.startsAt)

function situation(studioClass, started) {
  const mine = studioClass.myBooking

  if (mine?.status === 'attended') return { text: 'Attended', tone: 'attended' }
  if (mine?.status === 'booked') {
    return { text: 'Booked', tone: 'booked', action: 'cancel', label: 'Cancel' }
  }
  if (mine?.status === 'waitlisted') {
    return {
      text: `Waitlisted · #${mine.position}`,
      tone: 'waitlisted',
      action: 'cancel',
      label: 'Leave waitlist',
    }
  }

  if (started) return { text: '', tone: 'started' }

  if (studioClass.seatsFree > 0) {
    return {
      text: `${studioClass.seatsFree} of ${studioClass.capacity} seats free`,
      tone: 'free',
      action: 'book',
      label: 'Book',
    }
  }
  return {
    text: studioClass.waitlistCount
      ? `Full · ${studioClass.waitlistCount} waiting`
      : 'Full',
    tone: 'full',
    action: 'book',
    label: 'Join waitlist',
  }
}

function card(studioClass, canAct, now) {
  const started = hasStarted(studioClass, now)
  const { text, tone, action, label } = situation(studioClass, started)

  const node = element('li', started ? 'class-card is-started' : 'class-card')
  node.setAttribute('data-testid', 'class-card')
  node.setAttribute('data-class-id', studioClass.id)
  if (studioClass.myBooking) node.setAttribute('data-booking-id', studioClass.myBooking.id)

  const about = element('div', 'class-card__about')
  about.append(
    element('h3', 'class-card__title', studioClass.title),
    element('p', 'class-card__time', at(studioClass.startsAt)),
  )

  const state = element(
    'p',
    'class-card__state',
    [text, started ? 'Started' : ''].filter(Boolean).join(' · '),
  )
  state.dataset.tone = started ? 'started' : tone

  const side = element('div', 'class-card__side')
  side.append(state)

  if (action && canAct && !started) {
    const button = element('button', 'class-card__action', label)
    button.type = 'button'
    button.dataset.action = action
    side.append(button)
  }

  node.append(about, side)

  return node
}

/** `{ ok: false }` when the request did not answer: that must not look empty. */
export function renderSchedule(state, now = Date.now()) {
  const root = element('div', 'schedule')

  if (!state.ok) {
    root.append(element('p', 'notice', "Couldn't load the schedule."))
    const retry = element('button', 'notice__action', 'Retry')
    retry.type = 'button'
    retry.dataset.action = 'retry'
    root.append(retry)
    return root
  }

  if (state.items.length === 0) {
    root.append(element('p', 'notice', 'No classes scheduled yet.'))
    return root
  }

  const list = element('ul', 'class-list')
  for (const studioClass of state.items) list.append(card(studioClass, !!state.me, now))
  root.append(list)

  return root
}

export function renderMyBookings(items) {
  const root = element('div', 'my-bookings')

  if (items.length === 0) {
    root.append(element('p', 'notice', 'You have no bookings yet. Pick a class above.'))
    return root
  }

  const list = element('ul', 'booking-list')
  for (const booking of items) {
    const node = element('li', 'booking')
    node.setAttribute('data-testid', 'my-booking')
    node.setAttribute('data-booking-id', booking.id)
    node.append(
      element('span', 'booking__title', booking.class.title),
      element(
        'span',
        'booking__state',
        booking.status === 'waitlisted' ? `Waitlisted · #${booking.position}` : 'Booked',
      ),
    )
    list.append(node)
  }
  root.append(list)

  return root
}
