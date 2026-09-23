# Test cases

This document shows the test-case coverage: every case and the level it runs
at. The rules it checks are in [the requirements](requirements.md).

| Level | Cases | Automated |
|---|:---:|:---:|
| [Unit (rules)](#unit-rules) | 17 | 0 |
| [Unit (rendering)](#unit-rendering) | 7 | 0 |
| [API](#api) | 16 | 0 |
| [E2E](#e2e) | 1 | 0 |
| [Manual](#manual-only) | 2 | — |
| **Total** | **43** | **0** |

Three cases carry the `@smoke` tag — booking works (A-01), the waitlist
promotion works (A-15), and a person sees it (E-01) — so that
`npm run test:smoke` can answer in seconds whether the full suite is worth
starting.

## Unit (rules)

In `tests/unit/rules.test.ts`. The rules module is pure and takes `now` as a
parameter, so every case here runs without HTTP and without waiting for a
clock.

| ID | Rule | Case |
|---|---|---|
| U-01 | Booking | A free seat makes the booking `booked` |
| U-02 | Booking | A full class makes it `waitlisted` at position 1 |
| U-03 | Booking | Booking again while `booked` or `waitlisted` is rejected |
| U-04 | Booking | Booking again after cancelling creates a new booking at the end of the waitlist |
| U-05 | Cancellation | A `booked` client cancels with an empty waitlist → the seat is freed |
| U-06 | Cancellation | A `booked` client cancels with one waiting → that client is promoted |
| U-07 | Cancellation | A `booked` client cancels with two waiting → only the first is promoted, the second moves to position 1 |
| U-08 | Cancellation | A `waitlisted` client cancels → nobody is promoted, the queue closes up |
| U-09 | Cancellation | Cancelling after the class started is rejected |
| U-10 | Cancellation | Cancelling an `attended` booking is rejected |
| U-11 | Cancellation | Cancelling twice is a no-op, even after the class started |
| U-12 | Started classes | `now == startsAt` → booking is rejected |
| U-13 | Started classes | One millisecond before `startsAt` → booking is accepted |
| U-14 | Attendance | A `booked` booking becomes `attended` |
| U-15 | Attendance | Marking a `waitlisted` booking is rejected |
| U-16 | Attendance | Marking a `cancelled` booking is rejected |
| U-17 | Attendance | Marking twice is a no-op |

## Unit (rendering)

In `tests/unit/render.test.ts`. The schedule is rendered by a pure function, so
these run in jsdom and answer "is the schedule displayed correctly" without
paying for a browser.

| ID | Case |
|---|---|
| R-01 | No classes → the empty-state text, not an empty page |
| R-02 | Classes are ordered by start time, soonest first |
| R-03 | Seats free → a `Book` button and the seat count |
| R-04 | Full class → a `Join waitlist` button and the waiting count |
| R-05 | Own `booked` booking → `Cancel` replaces `Book` |
| R-06 | Own `waitlisted` booking → the position is shown |
| R-07 | Started class → no action at all |

## API

In `tests/api/`. Response schemas are declared in the tests with zod, not
imported from the app: a test that reuses the app's own schema checks the app
against itself.

| ID | Case | Expected |
|---|---|---|
| A-01 | Book a class with a free seat `@smoke` | `201`, status `booked`, body matches the schema |
| A-02 | Book a full class | `201`, status `waitlisted` — not an error |
| A-03 | Book the same class twice | `409 already_booked` |
| A-04 | Book a class that already started | `409 class_started` |
| A-05 | Cancel after the class started | `409 class_started` |
| A-06 | Mark attendance on a `waitlisted` booking | `409 not_booked` |
| A-07 | Mark attendance twice | `200`, body unchanged |
| A-08 | Create a client with neither email nor phone | `400 validation_failed`, `field: "email"` |
| A-09 | Create a class with capacity `0` | `400 validation_failed`, `field: "capacity"` |
| A-10 | Create a client with a 500-character name | `400 validation_failed`, `field: "name"` |
| A-11 | Book with no credentials | `401 unauthenticated` |
| A-12 | Call a studio endpoint with a client token | `403 forbidden` |
| A-13 | Cancel another client's booking | `403 forbidden` |
| A-14 | Book a class id that does not exist | `404 not_found` |
| A-15 | Cancel a `booked` booking while someone is waiting `@smoke` | `200`, and the class roster shows the first waiting client as `booked` |
| A-16 | Cancel a booking id that does not exist, in a shape ids never take (`abc`) | `404 not_found`, not `403` and not a crash |

## E2E

In `tests/e2e/`.

| ID | Case |
|---|---|
| E-01 | One seat. Client A books it, client B joins the waitlist. A cancels, and B's booking now reads `Booked`. The two clients run in separate browser contexts. `@smoke` |

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
| Rate limiting and load | The app is not deployed publicly. |
| Session recovery | There is no recovery by design: no passwords and no email delivery. |
| Browser compatibility | E2E runs in Chromium only. The page is plain HTML and CSS with nothing engine-specific, so a second engine would mostly repeat the same assertions for triple the CI time. First thing to add if a browser-specific bug shows up. |
