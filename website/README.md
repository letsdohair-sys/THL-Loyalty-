# The Hair Lounge by Nickita — Website

Marketing website for the salon, kept separate from the loyalty app in this same repo.
Plain HTML/CSS/JS, no build step — open `index.html` directly or serve the folder statically.

## Structure

- `index.html` — home page
- `services.html` — services and pricing
- `gallery.html` — photo gallery
- `about.html` — about the studio
- `contact.html` — contact info and form
- `css/style.css` — shared styles
- `js/main.js` — mobile nav toggle, footer year, contact form handling
- `assets/` — put real photos here (logo, hero images, gallery shots)

## To customize

- Replace all `[ Photo ]` / `[ Replace with... ]` placeholders with real images.
- Update address, phone, email, and hours in the footer and `contact.html`.
- Update pricing on `services.html` to match your real menu.
- The "Loyalty Rewards" button links to `#` — point it at the deployed loyalty app URL.
- Wire the contact form up to a real endpoint (Formspree, Netlify Forms, etc.) — it currently
  only shows a placeholder confirmation message.

## Deploying

Any static host works (GitHub Pages, Netlify, Vercel). For GitHub Pages from this repo,
set the Pages source to this `website/` folder (or a subdirectory deploy action), since
`index.html` at the repo root belongs to the loyalty app.
