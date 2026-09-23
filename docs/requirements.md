# Requirements

This document defines the behaviour the tests check, and it was written before
the code. If something is not described here, a test has no ground to expect
it. So anything a test relies on must be written here first.


- [Actors and credentials](#actors-and-credentials)
- [Entities](#entities)
- [Rules](#rules)
- [Order of checks](#order-of-checks)
- [API](#api)
- [Errors](#errors)
- [UI](#ui)

## Actors and credentials

| | Client | Studio |
|---|---|---|
| Credential | A random token from `POST /clients` | `STUDIO_KEY`, from the environment |
| Sent as | `token` cookie, `HttpOnly`, `SameSite=Strict` | `X-Studio-Key` header |

Every endpoint requires one actor or the other. `GET /classes` accepts both.

There are no passwords and no login: the cookie is the identity. Email is not
unique, and there is no account recovery — a cleared browser or a server
restart loses those bookings.

## Entities

**Client** — `id`, `name`, and an `email`, a `phone`, or both. A client with
no way to be contacted is invalid.

**Class** — `id`, `title`, `startsAt` (ISO 8601, UTC), `capacity`. Read
responses also carry `seatsFree` and `waitlistCount`, so the UI can show
whether booking will mean a seat or a place in the queue.

**Booking** — `id`, `classId`, `clientId`, `status`, `createdAt`. Status is
one of `booked`, `waitlisted`, `cancelled`, `attended`. A waitlisted booking
also has a `position`, starting at 1.

```mermaid
stateDiagram-v2
    [*] --> booked: seat available
    [*] --> waitlisted: class full
    waitlisted --> booked: a booked client cancels
    booked --> cancelled
    waitlisted --> cancelled
    booked --> attended: studio marks attendance
```

## Rules

### 1. Booking

A free seat makes the booking `booked`. Otherwise it is `waitlisted`. The
waitlist is first in, first out, ordered by the time each client joined it.

- A client who already has an active (`booked` or `waitlisted`) booking on a
  class cannot book it again → `409 already_booked`.
- A client who cancelled may book again. That creates a **new** booking, and
  if the class is full it goes to the end of the waitlist.

### 2. Cancellation

When a `booked` client cancels, the seat is freed and the first `waitlisted`
client becomes `booked`. Promotion is automatic and immediate.

- When a `waitlisted` client cancels, they leave the queue and nobody is
  promoted. Positions behind them shift up.
- A booking on a class that has already started cannot be cancelled →
  `409 class_started`. Otherwise promotion would book someone onto a started
  class and break rule 3.
- An `attended` booking cannot be cancelled → `409 not_cancellable`.

### 3. Started classes

A class has started when `now >= startsAt`. Booking a started class is
rejected → `409 class_started`. Cancelling is rejected by rule 2.

### 4. Attendance

Only a `booked` booking can be marked as attended. A `waitlisted` or
`cancelled` booking is rejected → `409 not_booked`. Attendance is not limited
by time: the studio may mark someone before the class starts.

### Repeating an action

Repeating a transition that already happened — cancelling a cancelled
booking, marking an attended booking again — returns `200` and changes
nothing.

**This check runs before the rule checks.** Cancelling an already cancelled
booking after the class has started is still a no-op, not a `409`.

### Validation

| Field | Rule |
|---|---|
| `name` | Required, 1–100 characters |
| `email` | Optional, valid form, at most 255 characters |
| `phone` | Optional, 5–30 characters |
| `email` / `phone` | At least one of the two is required |
| `title` | Required, 1–100 characters |
| `startsAt` | Required, ISO 8601. Any point in time, including the past |
| `capacity` | Required, an integer, at least 1 |

## Order of checks

1. **Credentials present and known** → else `401`
2. **Right actor for this endpoint** → else `403`
3. **Body valid** → else `400`
4. **Resource exists** → else `404`. Ids are opaque strings, so an id in an
   unexpected shape is simply unknown: `404`, never `400`
5. **Resource belongs to this client** (cancellation only) → else `403`
6. **Transition already happened** → `200`, nothing changes
7. **Rule allows the transition** → else `409`

Step 5 answers `403` rather than `404`, which does tell the caller that a
booking with that id exists. Ids are random, so they cannot be enumerated,
and an explicit `403` is clearer to read. This is a deliberate trade-off.

## API

All bodies are JSON. Successful responses return the entity, or a list of
entities under `items`.

| Method | Path | Actor | Purpose | Success |
|---|---|---|---|---|
| `POST` | `/clients` | — | Create a client; sets the `token` cookie | `201` client |
| `GET` | `/classes` | Client or Studio | List classes, soonest first, with `seatsFree` and `waitlistCount` | `200` items |
| `POST` | `/classes` | Studio | Create a class | `201` class |
| `POST` | `/classes/:id/bookings` | Client | Book a class | `201` booking (`booked` or `waitlisted`) |
| `GET` | `/me/bookings` | Client | Own bookings, with class details | `200` items |
| `POST` | `/bookings/:id/cancel` | Client | Cancel own booking | `200` booking |
| `GET` | `/classes/:id/bookings` | Studio | Who is booked and who is waiting | `200` items |
| `POST` | `/bookings/:id/attend` | Studio | Mark attendance | `200` booking |

A full class still returns `201`: joining the waitlist is a success, not an
error. The caller tells the two apart by `status`, not by the status code.

## Errors

Every error response has the same shape:

```json
{ "error": { "code": "class_started", "message": "The class has already started", "field": null } }
```

`field` is set only for validation errors. **Clients pick their wording from
`code`, never from `message`**, so that rephrasing a message does not break
the UI or a test.

| Code | Status | When |
|---|---|---|
| `validation_failed` | `400` | A field breaks a validation rule; `field` says which |
| `unauthenticated` | `401` | No credentials, or credentials the server does not know |
| `forbidden` | `403` | Wrong actor for the endpoint, or someone else's booking |
| `not_found` | `404` | No such class or booking |
| `already_booked` | `409` | The client already has an active booking on this class |
| `class_started` | `409` | The class has already started |
| `not_cancellable` | `409` | The booking is `attended` |
| `not_booked` | `409` | Attendance on a booking that is not `booked` |

## UI

One page: the schedule. The UI is English, plain HTML and JavaScript, served
by the same server.

**The UI reflects state; it does not enforce rules.** A button is missing
because showing it would be meaningless, not because it protects a rule. A
request sent around the UI must still be rejected by the API — which is why
every rule is tested below the UI too.

### The class card

| The client's situation | What is shown | Action |
|---|---|---|
| Seats free, no booking | `3 of 8 seats free` | `Book` |
| Full, no booking | `Full · 2 waiting` | `Join waitlist` |
| Booked | `Booked` | `Cancel` |
| Waitlisted | `Waitlisted · #2` | `Leave waitlist` |
| Class started | `Started`, card dimmed | none |
| Attended | `Attended` | none |

A double booking is impossible in the UI because the button is **replaced**,
not disabled. Disabled buttons are avoided: they do not explain themselves.

The one place a button is disabled is while its own request is in flight.
Otherwise a double click sends two requests, and the second one fails with
`409` on an action that actually succeeded.

### Empty states

| Situation | Text |
|---|---|
| No classes at all | `No classes scheduled yet.` |
| No bookings | `You have no bookings yet. Pick a class above.` |
| The schedule failed to load | `Couldn't load the schedule.` plus a `Retry` button |

An empty list and a failed load must look different. A test for the empty
state has to fail if the page is showing an error instead.

### Messages

The identity form carries `novalidate`, so the browser shows none of its own
bubbles: `type="email"` stays only for the right mobile keyboard. Validation
is ours, in our wording, under the field — the browser would accept `a@b`, and
it has no way to express "an email or a phone". Either way this is convenience,
not the rule: the server validates on its own.

Form errors appear under the field, on submit. Action errors appear as a
toast, and the card refreshes to the state the server reports.

| Trigger | Text |
|---|---|
| `name` missing | `Enter your name` |
| No email and no phone | `Enter an email or a phone number so the studio can reach you` |
| `email` malformed | `This doesn't look like an email address` |
| `class_started` | `This class has already started.` |
| `already_booked` | `You're already on the list for this class.` |
| `not_found` | `This class is no longer available.` |
| `unauthenticated` | `Your session has ended. Enter your details again.` and the identity form reappears |
| `forbidden` | `You can't do that.` |
| Network failure or `5xx` | `Something went wrong. Please try again.` |

### A stale screen is not an error

The schedule a client is looking at can be out of date. Two cases matter:

- The last seat was taken while the page was open. `Book` then returns
  `201 waitlisted`, and the UI says
  `The class filled up — you're #2 on the waitlist.` That is a different
  outcome, not a failure.
- The booking was already cancelled in another tab. `Cancel` returns `200`
  unchanged and the card silently refreshes.

### How tests find things

Ordinary elements are found by role and accessible name, for example
`getByRole('button', { name: 'Book' })`. Class cards carry
`data-testid="class-card"` and `data-class-id`, because they repeat and look
alike.
