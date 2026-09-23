# Test cases

This document shows the test-case coverage: every case and the level it runs
at. The rules it checks are in [the requirements](requirements.md).

| Level | Cases | Automated |
|---|:---:|:---:|
| [Unit (rules)](#unit-rules) | 22 | 22 |
| [Unit (validation)](#unit-validation) | 11 | 11 |
| [Unit (rendering)](#unit-rendering) | 11 | 0 |
| [API](#api) | 20 | 0 |
| [E2E](#e2e) | 1 | 0 |
| [Manual](#manual-only) | 2 | — |
| **Total** | **67** | **33** |

Three cases carry the `@smoke` tag — booking works (A-01), the waitlist
promotion works (A-05), and a person sees it (E-01) — so that
`npm run test:smoke` can answer in seconds whether the full suite is worth
starting.

## Unit (rules)

In `tests/unit/rules.test.ts`. The rules module is pure and takes `now` as a
parameter, so every case here runs without HTTP and without waiting for a
clock.

| ID | Rule | Case |
|---|---|---|
| U-01 | Booking | A free seat makes the booking `booked`, with no place in the queue |
| U-02 | Booking | A full class makes it `waitlisted` at position 1 |
| U-03 | Booking | Booking again while `booked` or `waitlisted` is rejected |
| U-04 | Booking | Booking again after cancelling, on a class that is full with someone already waiting, creates a new booking at the end of the waitlist |
| U-05 | Cancellation | A `booked` client cancels with an empty waitlist → the seat is freed |
| U-06 | Cancellation | A `booked` client cancels with one waiting → that client is promoted |
| U-07 | Cancellation | A `booked` client cancels with two waiting → only the first is promoted, the second moves to position 1 |
| U-08 | Cancellation | The first of two `waitlisted` clients cancels → nobody is promoted, and the one behind moves to position 1 |
| U-09 | Cancellation | Cancelling after the class started is rejected |
| U-10 | Cancellation | Cancelling an `attended` booking is rejected |
| U-11 | Cancellation | Cancelling twice is a no-op, even after the class started |
| U-12 | Started classes | `now == startsAt` → booking is rejected |
| U-13 | Started classes | One millisecond before `startsAt` → booking is accepted |
| U-14 | Attendance | A `booked` booking becomes `attended`, and the other bookings are left alone |
| U-15 | Attendance | Marking a `waitlisted` booking is rejected |
| U-16 | Attendance | Marking a `cancelled` booking is rejected |
| U-17 | Attendance | Marking twice is a no-op |
| U-18 | Booking | Booking again after being marked `attended` is rejected |
| U-19 | Attendance | A class whose only seat is held by an `attended` booking is full: the next client is `waitlisted` |
| U-20 | Cancellation | Cancelling an `attended` booking on a started class answers `not_cancellable`, not `class_started` |
| U-21 | Booking | Booking a started class while holding an active booking answers `already_booked`, not `class_started` |
| U-22 | Cancellation | The queue follows the time each client joined, not the order the bookings arrive in: the earliest waiting client is at position 1 and is the one promoted |

## Unit (validation)

In `tests/unit/validation.test.ts`. Validation is a pure function of the
request body, so the boundaries are checked here; the API section keeps the
two cases that show a route actually calls it.

| ID | Case |
|---|---|
| V-01 | `name`: 1 and 100 characters accepted, empty and 101 rejected |
| V-02 | `email`: 255 characters accepted, 256 rejected, both well-formed addresses |
| V-03 | `email`: `a@b`, `a@b.`, `a@.b`, `@example.com` and an address with a second `@` rejected, `a@b.co` accepted |
| V-04 | `phone`: 5 and 30 characters accepted, 4 and 31 rejected |
| V-05 | Neither email nor phone → rejected naming `email`; either one alone is enough |
| V-06 | Two invalid fields → `field` names the first one in the order of the validation table |
| V-07 | `capacity`: 1 accepted, 0 and a fractional number rejected; `startsAt` rejected when it is not ISO 8601 in UTC, an offset form included |
| V-08 | An unknown field is dropped rather than rejected, and does not reach the value |
| V-09 | A class in the past is accepted: the studio is trusted with the time |
| V-10 | A body that is not an object at all is rejected, naming the first field of that table |
| V-11 | The field named is the first one in the table whatever order the failures arrive in, and a failure outside the table falls back to the first field |

## Unit (rendering)

In `tests/unit/render.test.ts`. The schedule is rendered by a pure function of
what `GET /classes` returns, so these run in jsdom and answer "is the schedule
displayed correctly" without paying for a browser.

| ID | Case |
|---|---|
| R-01 | No classes → the empty-state text, not an empty page |
| R-02 | `me` is `null` → the schedule renders with seat counts and no action on any card |
| R-03 | `me` is set and there is no booking → a `Book` button and the seat count |
| R-04 | Full class → a `Join waitlist` button and the waiting count |
| R-05 | Own `booked` booking → `Cancel` replaces `Book` |
| R-06 | Own `waitlisted` booking → the position is shown |
| R-07 | Started class without a booking → `Started`, dimmed, no action |
| R-08 | Started class with own `booked` booking → `Booked · Started`, still no action |
| R-09 | Own `attended` booking → `Attended`, no action |
| R-10 | No bookings → `You have no bookings yet. Pick a class above.`, while the schedule itself still renders |
| R-11 | The schedule failed to load → the error text and `Retry`, never the empty state |

## API

In `tests/api/`. Response schemas are declared in the tests with zod, not
imported from the app: a test that reuses the app's own schema checks the app
against itself. Errors go through one shared helper that validates the whole
`{error:{code,message,field}}` envelope, so every case below that expects a
`4xx` asserts the envelope as well as the code.

| ID | Case | Expected |
|---|---|---|
| A-01 | Book a class with a free seat `@smoke` | `201`, status `booked`, body matches the schema |
| A-02 | Book a full class | `201`, status `waitlisted` — not an error |
| A-03 | Book the same class twice | `409 already_booked` |
| A-04 | Book a class that already started | `409 class_started` |
| A-05 | Cancel a `booked` booking while someone is waiting `@smoke` | `200` with the booking back as `cancelled`, and the class roster shows the first waiting client as `booked` |
| A-06 | Cancel an `attended` booking | `409 not_cancellable` |
| A-07 | Mark attendance on a `waitlisted` booking | `409 not_booked` |
| A-08 | Mark attendance twice | `200`, body unchanged |
| A-09 | Create a client with neither email nor phone | `400 validation_failed`, `field: "email"` — the route calls validation and dresses the result as the envelope |
| A-10 | Create a class with capacity `0` under a title only this test uses | `400 validation_failed`, `field: "capacity"`, and no class with that title appears in `GET /classes` — validation runs before any work |
| A-11 | Book with no credentials | `401 unauthenticated` |
| A-12 | Call a studio endpoint with a client token | `403 forbidden` |
| A-13 | Cancel another client's booking | `403 forbidden` |
| A-14 | Book a class id that does not exist | `404 not_found` |
| A-15 | Cancel a booking id that does not exist, in a shape ids never take (`abc`) | `404 not_found`, never `400`, not `403` and not a crash |
| A-16 | `GET /classes` on a schedule created out of order, including a started class | `200`, classes soonest first, started ones included, each with `seatsFree` and `waitlistCount` matching its bookings |
| A-17 | `GET /classes` for a client who booked one of them, for the studio, with no credentials, and with a cookie the server has never issued | `200` every time; `me` and `myBooking` carry the client's own identity, status and position, and both are `null` for the studio, the anonymous caller and the unknown cookie — never `401` |
| A-18 | `GET /me/bookings` after booking one class and cancelling another, while a second client also has bookings | `200`, only this client's active bookings — the cancelled one is gone — each with its `class` nested and a `position` only when `waitlisted` |
| A-19 | `POST /clients` sets the session cookie | `Set-Cookie` for `token` carries `HttpOnly`, `SameSite=Strict`, `Path=/` and a 30-day `Max-Age`, and the token is not in the body |
| A-20 | Call a studio endpoint with a wrong `X-Studio-Key` | `401 unauthenticated`, not `403` — an unknown key is nobody |

## E2E

In `tests/e2e/`.

| ID | Case |
|---|---|
| E-01 | One seat. Client A books it, client B joins the waitlist and sees `Waitlisted · #1`. A cancels; B reloads and now reads `Booked`. The two clients run in separate browser contexts. `@smoke` |

One scenario is deliberate. It exercises booking, the waitlist and automatic
promotion in a single story, across the whole path from UI to storage.
Attendance has no UI, and every other browser-level check would repeat
something that already fails at a cheaper level.

## Manual only

| ID | Case | Why not automated |
|---|---|---|
| M-01 | Layout on a narrow viewport | One column, no responsive logic of its own. A screenshot test would mostly report font rendering. |
| M-02 | The schedule is readable and the state of each class is obvious at a glance | This is a judgement about the design, not an assertion. |

## Deliberately not covered

| Area | Why |
|---|---|
| Pagination and virtualization | Not built. A studio schedule fits in one response. |
| Cancelling after the class started, over HTTP | Booking is only possible before the start, so setting this up would mean waiting for the real clock. U-09 holds the rule, and A-04 shows the clock reaching the rules through the booking route — the cancel route passes `now` of its own, and that hand-off stays unverified. Accepted risk; the cure is a test that waits a second or two. |
| Rate limiting and load | The app is not deployed publicly. |
| Session recovery | There is no recovery by design: no passwords and no email delivery. |
| Form messages, toast wording and the in-flight button | Browser-only details that change no state. The rules behind them are asserted in the validation and API cases, where breaking one actually costs something. |
| Browser compatibility | E2E runs in Chromium only. The page is plain HTML and CSS with nothing engine-specific, so a second engine would mostly repeat the same assertions for triple the CI time. First thing to add if a browser-specific bug shows up. |
