# Weather Dashboard — course-compose-v1.0.0

First submission for the Distributed Systems course (Distribuované systémy).

## Included

- Header city search and browser geolocation with approximate location and
  default fallbacks.
- Current weather, hourly cards, a daily forecast list and weather details in
  the location's time zone.
- Registration, login, JWT sessions and saved favorite locations.
- PostgreSQL weather caching and persistent accounts and favorites.
- Docker Compose startup with health checks, an Nginx reverse proxy and a
  named PostgreSQL volume.

Nginx serves the production Vite build and forwards same-origin API requests
to Spring Boot. Spring Boot calls OpenWeather and stores application data and
the weather cache in PostgreSQL 16.

## Run

Follow the [Compose setup](../../README.md#run-with-docker-compose). Copy
`.env.example` to a private `.env` and set the database name, user and password
(`DB_NAME`, `DB_USER`, `DB_PASS`), a Base64 JWT signing key with at least 32
decoded random bytes (`JWT_SECRET`), and an OpenWeather One Call 3.0 key
(`OPENWEATHER_API_KEY`). `FRONTEND_PORT` defaults to `8080`.

```sh
docker compose up --build -d
```

Open [http://localhost:8080](http://localhost:8080). Use `docker compose down`
to stop the stack and keep its volume. See the
[course demo guide](../course-demo.md) for a walkthrough.

## Verification

- Backend: 98 passed, including 4 PostgreSQL integration tests, with no
  failures or skips.
- Frontend: 216 passed, with no failures or skips. The Vite production build
  succeeded.
- Compose: both images built, all three services became healthy, and Flyway
  applied V1 and V2 on a fresh PostgreSQL volume. Weather, search,
  registration, login and favorites were exercised in Chrome through Nginx.
  The release smoke test used controlled upstream weather responses.

## Scope and follow-up

The stack is intended for a local course demonstration over HTTP. Live
forecasts require a valid provider key and available quota. JWT sessions are
scoped to a browser tab and have no server-side logout revocation.
Kubernetes and Minikube are deferred to a later milestone.

Keep the annotated `course-compose-v1.0.0` tag at the first submission commit.
Start later work on a separate branch. Use
`git switch --detach course-compose-v1.0.0` to inspect this version.
