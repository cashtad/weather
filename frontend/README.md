# Weather Dashboard frontend

Vite 8, vanilla JavaScript ES modules, HTML and regular CSS. Guests can search
for cities and view weather. Accounts add session restoration and favorites.
There are no runtime dependencies. Vitest and happy-dom are dev
dependencies; happy-dom supplies DOM APIs for tests, not a production framework.

## Run with Spring Boot

Use Node.js 24 LTS (tested with 24.19.0) and npm 10+. Supported engine ranges are
in `package.json`. From `frontend/`:

```text
npm ci
npm run dev
```

On PowerShell use `npm.cmd` if the `npm.ps1` shim is blocked. No global Vite
installation is needed. Vite listens on port 5173 and proxies `/api` to Spring
Boot at `http://localhost:8080`. Start the existing backend/PostgreSQL following
the root README. Provider credentials and JWT configuration belong only there.

For another backend, set the server-only variable before starting Vite:

```powershell
$env:API_PROXY_TARGET = 'http://127.0.0.1:18080'
npm.cmd run dev
```

Browser API URLs remain relative `/api/v1/...`. The frontend does not read the
repository root `.env`. Never put credentials in frontend files or `VITE_`
variables. JavaScript runs in the visitor's browser; Spring Boot supplies JSON.
Vite serves modules during development and builds static assets. Opening the
HTML file directly is unsupported. The [Docker Compose setup](../README.md#run-with-docker-compose)
serves the production build from Nginx and proxies `/api` on the same origin.

## Location priority and privacy

1. A validated manual city preference from localStorage.
2. One browser `getCurrentPosition` attempt.
3. Approximate browser-side lookup through `https://ipwho.is/`.
4. Prague, Czechia: latitude 50.0755, longitude 14.4378.

A saved manual city bypasses both browser and IP lookup. Otherwise the browser
may show its standard permission prompt on initial visit; there is no extra
permission modal. Browser geolocation needs HTTPS or localhost. Low-accuracy
options use an 8-second timeout and a 5-minute maximum age. An independent
9-second deadline also bounds unanswered permission prompts. Unsupported or
insecure contexts, denial, timeout and invalid coordinates advance to IP lookup.

The IP request has a 4-second deadline covering fetch and response-body parsing.
Only success, city, region, country, latitude and longitude are requested. This
third-party service receives the visitor's public IP as part of the request.
Precise browser coordinates are never sent to it. No IP address or raw provider
response is retained, logged or stored. Estimates may reflect a neighboring
city, ISP, VPN or corporate exit; the UI labels them approximate. See the
[provider documentation](https://ipwhois.io/documentation). Failure or rate
limiting falls back to Prague and still attempts to load weather.

`Use my location` explicitly repeats detection; search remains usable throughout.
Automatic detection does not loop or restart when a weather request fails. Late
callbacks cannot replace a manual choice or completed fallback. Initial detection
is bounded by approximately 13 seconds overall, excluding weather loading.

Only manual selections are saved under `weather-dashboard.location.v1`. The
versioned record holds name, country, optional state, coordinates and source.
Malformed/obsolete records are ignored. Browser coordinates, IP estimates,
automatic Prague and weather payloads are not persisted. Blocked storage does
not prevent in-memory use. An explicit device-location action is temporary: the
last manual city remains the preference for a later visit. Browser coordinates
are used for the normal weather request to our backend, which queries OpenWeather.
There is no analytics, tracking or `watchPosition`.

## Search and weather

Search for a city in the header. The crosshair button runs **Use my location**.
Search waits 300 ms after at least two trimmed characters and calls
`/api/v1/geo/search?name=...`. Results display the returned city, state and
country. Click a result or use the arrow keys and Enter. Escape or clicking
outside closes the dropdown. Obsolete requests are aborted and stale results
ignored. A manual choice overrides pending location detection and weather
requests.

One `/api/v1/weather/all?lat=...&lon=...` request supplies all weather sections,
without JWT. The current card puts the city and local date at the top, groups
temperature, conditions and feels-like temperature on the left, and shows a
large weather icon on the right. A compact heart saves the city when signed in.
The hourly cards scroll horizontally
and retain the API order, including the first available forecast hour.
The weekly list shows one row per returned day with labeled day/night
temperatures, or min/max when the response only provides those values.

**Weather details** appears below the weekly list. It shows humidity and cloud
coverage in percent, wind in m/s, pressure in hPa, UV index, visibility in km,
and local sunrise and sunset. Sun times use the current weather fields first,
then a daily entry for the same local date when available. Missing values display
a dash and numeric zero stays visible.

Loading, empty, search errors and weather errors are distinct. Retry reloads only
the active weather request. A city switch clears old measurements, aborts the
old request and invalidates late results. Hourly scrolling supports touch and
the keyboard. No second weather cache is created in localStorage.

Official icon codes are allowlisted before constructing HTTPS OpenWeather image
URLs. Invalid codes or failed loads use a neutral local SVG. Images contain no
coordinates or API keys in their URLs. External/user text uses safe DOM APIs
or `textContent`, never interpolated HTML.

## UTC and local time

Unix timestamps are converted with `new Date(timestamp * 1000)`. The numeric
`timezone_offset` is never added. `Intl.DateTimeFormat` uses the validated IANA
timezone from the response and handles DST and date boundaries. The current
card normally shows only the date and time. Missing or invalid identifiers use
UTC, marked by a small label next to the time.

## Accounts and saved cities

Open **Sign in** from the header. The dialog accepts
an email and password. Select **Create an account** to register and sign in
in one step. Enter submits the form, and Escape or the close button dismisses it.
The frontend checks required fields, email syntax and the existing 72 UTF-8-byte
password limit. Spring Boot validates the request and credentials.

The frontend treats JWTs as opaque and stores only the issued token in
`sessionStorage`, where it survives a reload of the current tab. It verifies
the token with `GET /api/v1/user/me` before showing the email or requesting
favorites. Temporary verification failures offer **Retry session** and
**Sign out** while public weather stays available. When storage is inaccessible
the session works in memory for the current page.

**Sign out** clears the token and private state, cancels protected requests and
keeps the selected weather. A 401 for the current session clears it too. A 403,
network failure or server error leaves the session intact. An old request
cannot change a newer account, even if the server issued identical token strings.
Logout is local because the backend uses stateless JWTs.

JWTs in `sessionStorage` are readable by JavaScript. An XSS vulnerability could
steal them, and signing out does not revoke a token already copied elsewhere.
Passwords and profiles are never written to browser storage. Use safe DOM APIs
for user/backend text. JWTs travel only in Bearer headers on protected requests.

After signing in, use **Save city** next to a named location. Saving is always
explicit. **Saved** indicates an existing exact coordinate match, and the save
button is disabled while a request is active. An automatic named location can
also be saved by clicking the button. For raw GPS coordinates, search for a
named city first because the API has no reverse geocoding.

Focus the empty city search field to open **Saved places**. It shows the first
five saved locations. **Show all** expands the scrollable list when there are
more. Use Tab to reach saved-place actions or type a city to switch to search
suggestions. Selecting a favorite loads its weather. If its metadata satisfies
the manual preference format, it becomes the city remembered for the next
visit. A favorite without a country is still selectable. **Remove** deletes
that record and leaves its weather visible.
Favorites live in PostgreSQL through the API. Client duplicate checks cover this
page's list and pending saves. Separate tabs can still create duplicates because
the backend allows them.

| Request                                                 | Purpose                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------ |
| `POST /api/v1/auth/register`, `POST /api/v1/auth/login` | Send email and password, receive a token                     |
| `GET /api/v1/user/me`                                   | Verify the Bearer token and load the safe profile            |
| `GET /api/v1/favorites`                                 | Load the current user's favorites                            |
| `POST /api/v1/favorites`                                | Save a named location with coordinates and optional metadata |
| `DELETE /api/v1/favorites/{id}`                         | Remove a favorite by its UUID                                |

## Organization

- `main.js`: CSS/bootstrap and Vite hot-disposal cleanup.
- `app.js`: dashboard, session, location and request coordination.
- `components/`: DOM creation/update functions and callbacks; no API requests.
- `api/`: existing fetch client and endpoint modules, unchanged from Stage 3A.
- `auth/session.js`: token storage, verification and session identity.
- `favorites/favorites.js`: protected list, save and remove operations.
- `location/`: preferences, bounded browser/IP requests and priority resolution.
- `utils/weatherFormat.js`: numeric, description and timezone formatting.
- `styles/main.css`: established visual tokens plus functional responsive states.

Components clean up global listeners; cancelled requests cannot update a
destroyed application.

## Tests and production build

```text
npm test
npm run test:watch
npm run build
npm run preview
```

`dist/` contains static HTML, hashed CSS/JavaScript and favicon files; it needs no
Node runtime when hosted. Preview is a local build check, not a production server.

The 142 Stage 3B tests remain in the suite. Account and favorites tests cover
storage, modal behavior, protected request ordering, stale responses and session
changes. Automated tests use mocked fetch, storage and geolocation.

Stage 3C browser verification used headless Chrome at 1440, 768 and 375 px.
Authentication and favorites traveled through Vite to Spring Boot and a
disposable PostgreSQL instance. Weather and search used controlled responses.
Physical GPS and live IP providers were outside that run.

Stage 3D exercised city search and forecasts through Chrome, Vite, Spring Boot
and the live OpenWeather APIs. Reloading the selected city reused the PostgreSQL
weather cache. A second run used a controlled OpenWeather upstream for failure,
location and timezone scenarios. See the [Stage 4 handoff](../docs/stage-4-handoff.md)
for the final container verification checklist.
