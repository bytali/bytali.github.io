# Amara & Julian — Digital Wedding Invitation

Saturday 17 October 2026 · The Willow Conservatory, Charleston, South Carolina

Open `index.html` in any browser. No build step, no server, no internet connection required.

---

## The idea

The invitation's own copy describes "an autumn afternoon, a candlelit evening." The page
follows that arc: as you scroll, the light shifts from afternoon gold through dusk into
candlelight. Everything else — the deep conservatory green, the brass, the drifting petals —
comes from the venue itself, a glasshouse garden.

---

## What's interactive

| Feature | What it does |
|---|---|
| **Envelope opening** | Wax seal cracks in half and flies apart, flap swings open in 3D, the card rises out on a spring curve with a light sheen sweeping across it |
| **Live countdown** | Real-time count to 17 Oct 2026, 4:30 PM Eastern, updating every second with a digit-flip animation. Switches to a day-of message, then a married message |
| **RSVP form** | Name validation, accept/decline, guest stepper (1–8), dietary notes, 280-character message with counter, submit state, confirmation |
| **Saved reply** | The reply is stored on the guest's device and restored on their next visit; they can edit or copy it |
| **Add to calendar** | Generates a real `.ics` file with a day-before reminder — works with Apple Calendar, Google Calendar, Outlook |
| **Share** | Native share sheet on mobile, clipboard fallback elsewhere |
| **Copy contact** | One tap copies the phone number or email |

## Motion

- Petal particle system on canvas — ambient drift, with bursts when the envelope opens and when a guest accepts
- Names split into individual letters that rise with a stagger and a gold shimmer sweep
- Scroll-linked parallax on glass panes, light rays, and foliage
- Staggered section reveals via IntersectionObserver
- Timeline markers that light as you pass them
- Magnetic buttons, click ripples, and a soft pointer glow on desktop
- The conservatory illustration is drawn in SVG with individually swaying leaves and a light sweep

## Accessibility and fallbacks

- **`prefers-reduced-motion`** — all animation disabled, petals off, content shown immediately
- **No JavaScript** — the envelope gate is skipped entirely and the full invitation renders as static content
- **Older browsers** — if 3D transforms or `clip-path` are unavailable, a `legacy` class drops the envelope and shows the invitation directly
- Keyboard operable throughout, with visible focus rings
- The envelope is a real `<button>` with `aria-expanded`; the countdown is a `role="timer"`
- Page zoom is not disabled

## Responsive

Tested at 1440px desktop and 390px mobile, with breakpoints at 900px, 640px, and 380px,
plus a short-landscape rule for phones held sideways. Uses `100svh` where supported with a
`100vh` fallback, and respects iOS safe-area insets.

## Files

- `index.html` — structure and the SVG conservatory
- `styles.css` — all styling, animation, and responsive rules
- `script.js` — interaction layer, no dependencies

## Changing the details

- **Date and time** — `WEDDING` and `WEDDING_END` at the top of `script.js`, and the `.ics` block in the same file
- **Names, venue, schedule, contact** — all plain text in `index.html`
- **Colours and fonts** — the `:root` custom properties at the top of `styles.css`

## A note on typefaces

The build deliberately uses no web fonts so it works offline and loads instantly. The display
face resolves to Didot or Bodoni on macOS and iOS, and falls back to a generic serif on Windows
and Android. If you'd rather it look identical everywhere, self-hosted font files can be added
to the folder and referenced with `@font-face` in `styles.css`.
