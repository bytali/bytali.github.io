# Camille & Miguel — Philippine Digital Wedding Invite

A fresh, responsive single-page wedding invitation designed for a Philippine wedding context.

## Included

- Direct hero (no envelope/opening gate)
- Mobile-first romantic layout
- Intentionally simpler desktop presentation
- Countdown in Philippine Standard Time (UTC+8)
- Ceremony and reception details with Google Maps links
- Philippine-style entourage: parents, principal sponsors, secondary sponsors
- Barong Tagalog / modern Filipiniana dress-code guidance
- Unplugged ceremony, children, gifts, traffic and parking notes
- RSVP demo using browser localStorage
- Downloadable `.ics` calendar event
- Reduced-motion accessibility support
- No build tools required

## Files

- `index.html`
- `styles.css`
- `script.js`

## Run locally

Open `index.html` directly, or serve the folder with any static server.

Example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## GitHub Pages

Upload these files to the root of your GitHub Pages repository, commit, and push. The site has no framework or build step.

## Important before publishing

All names, phone numbers, dates, sponsors, addresses, and venue details in this demo are sample content. Replace them with the couple's actual information.

The RSVP form is intentionally backend-free and only saves to the current browser. For production, connect the submit handler in `script.js` to your preferred RSVP endpoint, Google Apps Script / Sheet, Formspree, Supabase, Firebase, or your own API.
