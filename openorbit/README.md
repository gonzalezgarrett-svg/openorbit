# OpenOrbit

**Live space data, explained.**

OpenOrbit is a free, open-source console for space. It pulls real-time data — a live world map tracking the International Space Station, upcoming rocket launches, current space weather, near-Earth asteroids, and NASA's astronomy picture of the day — and uses an AI layer to translate the raw telemetry into plain language anyone can understand.

Space data is public, but it's locked up in coordinates, TLEs, and Kp indices that mean nothing to a curious student or teacher. OpenOrbit turns "latitude 28.5°, 421 km, 27,580 km/h" into "the station is flying over Florida right now, higher than any airplane and fast enough to circle the Earth in 90 minutes."

Built to make space science accessible — no paywall, no account, open source so anyone can build on it.

---

## Features

- **Live ISS world map** — real-time position with the orbital ground track, a day/night sun glow, and your own location marked. Updates every few seconds.
- **Orbit telemetry** — altitude, speed, orbital period, orbits per day, and distance from you.
- **Launch tracker** — the next launches worldwide with status badges and a live ticking countdown to liftoff.
- **Space weather** — the current planetary K-index with an aurora outlook.
- **Near-Earth asteroids** — today's close approaches from NASA, with the closest object's distance (in lunar distances), size, and speed, plus a hazard flag.
- **NASA picture of the day** — the daily APOD image and caption.
- **Ask the sky** — type any space question and get a plain-language answer.
- **"Explain this" everywhere** — every panel has an AI button, plus a one-tap briefing.

The interface uses a cinematic, monochrome, full-bleed treatment with the live NASA astronomy image of the day as its background.

---

## How it works

| Layer | What it does | Source |
|-------|--------------|--------|
| ISS position | Live coordinates, altitude, velocity | wheretheiss.at |
| Launches | Upcoming launch manifest and status | The Space Devs — Launch Library 2 |
| Space weather | Planetary K-index | NOAA SWPC |
| Asteroids | Today's close approaches | NASA NeoWs |
| Picture of the day | Daily astronomy image | NASA APOD |
| Background | Daily full-bleed space photograph | NASA APOD (with a bundled fallback image) |
| Explanations | Plain-language translation | Anthropic Claude API (via serverless proxy) |

The ISS ground track and day/night sun glow are computed client-side. AI calls go through a small serverless function (`api/explain.js`) so your API key never reaches the browser. A bundled `public/space-bg.jpg` is shown until the live NASA image loads.

---

## Run it locally

```bash
git clone https://github.com/YOUR_USERNAME/openorbit.git
cd openorbit
npm install

cp .env.example .env        # then edit .env and paste your Anthropic key
```

UI only (live data works; AI buttons need the function):

```bash
npm run dev
```

Full app including AI — use the Vercel CLI so the `/api` function runs locally:

```bash
npm i -g vercel
vercel dev
```

---

## Deploy (free, ~2 minutes)

1. Push this repo to GitHub.
2. Go to vercel.com, Import the repo.
3. Add an Environment Variable: `ANTHROPIC_API_KEY` = your key. (Optionally add `VITE_NASA_API_KEY`.)
4. Deploy. You get a live URL like `openorbit.vercel.app`.

No server to manage. Netlify works too; move `api/` to a Netlify function.

---

## Configuration

| Variable | Required | Notes |
|----------|----------|-------|
| `ANTHROPIC_API_KEY` | Yes | Get one at console.anthropic.com. Keep it secret. |
| `VITE_NASA_API_KEY` | No | Free at api.nasa.gov. Raises the asteroid/APOD rate limit; falls back to DEMO_KEY. |

The launch feed uses the production endpoint `ll.thespacedevs.com`. For heavy local development, switch to the rate-friendly mirror `lldev.thespacedevs.com` in `src/App.jsx`.

---

## Roadmap

- [ ] True ISS pass predictions for your location (TLE propagation with satellite.js)
- [ ] Clickable map: tap anywhere to see what's overhead
- [ ] Reminders before the station passes over you
- [ ] Track more objects: Hubble, Tiangong, Starlink trains
- [ ] Classroom mode: printable explainers for teachers
- [ ] Multi-language explanations

---

## Contributing

Contributions are welcome — this is meant to be a community tool. Open an issue with an idea or bug, or send a pull request. Good first issues are tagged in the Issues tab. North star: accessible, accurate, and free.

---

## License

MIT — free to use, modify, and build on.

---

## Credits and disclaimer

Data from wheretheiss.at, The Space Devs, NOAA SWPC, and NASA Open APIs. Earth imagery rendered from NASA Blue Marble (public domain). Explanations powered by Anthropic's Claude.

OpenOrbit is an independent educational project and is not affiliated with NASA, SpaceX, or any space agency.
