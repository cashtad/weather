# Weather Dashboard

Weather Dashboard serves a browser frontend and a Java 17 / Spring Boot 4 API.
PostgreSQL 16 stores accounts, favorite locations and a JSONB weather cache.
OpenWeather supplies forecasts and geocoding data.

See the [course demonstration guide](docs/course-demo.md) for the live demo,
persistence check and optional recovery scenarios. The first course submission
is documented in the [course-compose-v1.0.0 release notes](docs/releases/course-compose-v1.0.0.md).

## Run with Docker Compose

Install Docker Desktop or Docker Engine with the Docker Compose plugin. Start
the Docker engine in Linux container mode. Docker builds the Java and Vite
projects, so you can run this setup without Maven, Java or Node.js on the host.

In the repository root, copy `.env.example` to `.env` if it does not already
exist. For a new database, choose a password and set `DB_PASS`. Generate and
set `JWT_SECRET` using the instructions below. Set `OPENWEATHER_API_KEY` to
your own key with One Call 3.0 access. For an existing volume, keep its
database name, user and password.

To create a new `.env`, use `cp .env.example .env` on Linux/macOS or
`Copy-Item .env.example .env` in PowerShell. Edit the new file locally.

```text
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

Open [http://localhost:8080](http://localhost:8080) once all three containers
are healthy. Set `FRONTEND_PORT` in `.env` if port 8080 is occupied and open the
new port instead. Only Nginx is published, and its port is bound to localhost.

| Service | Files | Role |
| --- | --- | --- |
| `frontend` | `frontend/Dockerfile`, `frontend/nginx.conf`, `frontend/src/` | Nginx serves the compiled Vite site on port 80 and proxies same-origin `/api/` requests to `backend:8080`. The runtime contains static assets and Nginx. |
| `backend` | Root `Dockerfile`, `pom.xml`, `src/main/` | Spring Boot serves the REST API. It connects to `postgres:5432` over the Compose network and calls OpenWeather externally. |
| `postgres` | `docker-compose.yml`, schema in `src/main/resources/db/migration/` | PostgreSQL keeps data in the named `pgdata` volume. Flyway applies the schema from the backend. |

Compose uses its project network and internal DNS for service names. The
backend and database ports are available to containers on that network.
The host browser uses the Nginx port for both the page and the API.

This setup serves a single local instance over HTTP. Live forecasts depend
on OpenWeather access and quota. The release notes describe the scope of
the course milestone and how to keep its Git snapshot available.

### Health, logs and shutdown

```text
docker compose ps
docker compose logs --tail=100 backend postgres frontend
docker compose exec backend curl -fsS http://127.0.0.1:8080/actuator/health/readiness
docker compose exec postgres pg_isready -h 127.0.0.1
docker compose down
```

PostgreSQL must become healthy before the backend starts. Backend readiness
checks the database before Nginx starts. Nginx's `/healthz` returns HTTP 204
and checks the frontend server. Actuator routes stay inside the Compose
network. The health conditions order startup. They do not restart an unhealthy
container by themselves or test OpenWeather access.

`docker compose down` stops and removes the project containers and network.
The named `pgdata` volume survives, so accounts, favorites, cache and Flyway
history survive container recreation. `docker compose down -v` also deletes
project volumes and their database contents. Use ordinary `down` to shut down
an environment you want to keep. Run `docker compose up --build -d` again after
source changes.

### Common startup problems

- **A required variable is missing.** Fill in the named variable in `.env` or
  the shell environment. Use `docker compose config --quiet` to validate without
  printing resolved secrets.
- **Port 8080 is busy.** Set `FRONTEND_PORT` to a free port. If upgrading from
  the older stack, stop the old `app` and `pgadmin` containers after confirming
  that they belong to your project. They are no longer defined. Use the same
  Compose project name to reuse its `pgdata` volume.
- **Backend readiness fails.** Inspect backend and database logs. A malformed
  or short JWT key prevents startup. Check the credentials of any existing
  volume. Changing `POSTGRES_*` settings does not reinitialize it.
- **Weather is unavailable while services are healthy.** Check OpenWeather
  network access, key validity, One Call 3.0 entitlement and API quota.
- **Location permission is unavailable.** Browser geolocation requires a
  secure context such as localhost or HTTPS. Manual search remains available.

## Configuration

Copy `.env.example` to `.env` only if you do not already have a local `.env`.
Fill in your own values; never commit `.env` or other credentials.

| Variable | Purpose / default |
| --- | --- |
| `DB_URL` | Required only for a backend run directly on the host; example `jdbc:postgresql://localhost:5432/weather`. Compose constructs `jdbc:postgresql://postgres:5432/${DB_NAME}`. |
| `DB_USER`, `DB_PASS` | Required PostgreSQL credentials for the backend and database |
| `DB_NAME` | Required database name for Compose |
| `JWT_SECRET` | Required standard Base64 key with at least 32 decoded random bytes, suitable for HS256 |
| `OPENWEATHER_API_KEY` | Required provider credential for real weather/geocoding requests; One Call 3.0 access is required |
| `FRONTEND_PORT` | Published localhost port, default `8080` |
| `OPENWEATHER_BASE_URL` | `https://api.openweathermap.org`; override only for trusted integration testing |
| `OPENWEATHER_CONNECT_TIMEOUT` | Positive duration, default `3s` |
| `OPENWEATHER_READ_TIMEOUT` | Positive duration, default `10s` |
| `WEATHER_CACHE_TTL` | Positive duration, default `10m` |

Generate a signing key with `openssl rand -base64 32`, or PowerShell:

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
$rng.Dispose()
```

Keep this key private and stable across restarts. Replacing it invalidates issued
tokens. Empty, invalid Base64 and short signing keys prevent startup. No valid
production signing key is supplied by default.

### Local process versus Compose

Spring Boot and Maven do not automatically load a dotenv file. Set variables in
the process environment before running Java. For the simple unquoted entries in
`.env.example`, PowerShell can load your local file without printing values:

```powershell
Get-Content .env | ForEach-Object {
    if ($_ -match '^([A-Z][A-Z0-9_]*)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
}
```

This loader intentionally supports only unquoted values without inline comments.
On Linux/macOS, export the same variables in your shell or use a trusted dotenv
loader; do not execute files from untrusted sources.

Docker Compose uses `.env` for YAML substitution. Shell variables can override
entries in that file. The Compose `environment` sections explicitly select the
variables each service receives. The JWT signing key and OpenWeather key go to
the backend only. The frontend receives no application credentials. Keep
`.env` private and use `.env.example` as the shareable template.

## Local development without Compose

Use JDK 17 or newer; the project compiles with Java 17 compatibility.

```text
./mvnw test
./mvnw package
```

On Windows, use `mvnw.cmd`. Ordinary tests require neither PostgreSQL nor real
provider credentials and make no real OpenWeather requests.

For a host-run backend, use a separate PostgreSQL 16 development instance
reachable on the host. The default Compose database has no host port. Set the
matching local `DB_URL`, load the backend environment and start:

```text
java -jar target/weather-0.0.1-SNAPSHOT.jar
```

Flyway applies V1/V2 and Hibernate validates the schema. The database migration
user needs permission to create tables, indexes and the `uuid-ossp` extension
(or an administrator must provision that extension first). Use the
[frontend development guide](frontend/README.md) to start Vite alongside it.
Both the host-run backend and the default Compose frontend use port 8080, so
choose separate ports if you run them together.

Spring Boot exposes `/actuator/health`, `/actuator/health/liveness` and
`/actuator/health/readiness`. Liveness tracks the process. Readiness returns
HTTP 503 when PostgreSQL is unavailable. The probes require no JWT and expose
no component details.

## PostgreSQL integration tests

Use only a disposable PostgreSQL 16 instance, never a user database. Set
`TEST_DB_URL`, `TEST_DB_USER` and `TEST_DB_PASS` in the Maven process, then run:

```text
./mvnw -Ppostgres-it verify
```

This runs the ordinary tests plus `PostgresCacheIT` through Failsafe. The test
creates a unique `stage2b_it_*` schema, provisions `uuid-ossp` in `public`, applies
V1, seeds duplicate cache rows and unrelated disposable user/favorite data, then
lets the real application apply V2. It checks the winner, uniqueness, JSONB,
expiry/refresh, stable IDs and 32 concurrent writes through independent
transactions. Missing test configuration fails the integration test rather than
silently skipping it. Created test schemas remain for inspection; dispose of
only your dedicated test instance afterwards. Ordinary `package` does not run
these explicitly selected PostgreSQL integration tests.

See [Stage 2A](docs/stage-2a.md) for API validation/compatibility and
[Stage 2B](docs/stage-2b.md) for cache and provider reliability decisions.
