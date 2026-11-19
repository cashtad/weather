# Stage 2A: API contract and security

Run `./mvnw test` (Windows: `mvnw.cmd test`) or `./mvnw package` with tests enabled.
Automated tests use real MVC, validation, services and JWT security with mocked
repositories and weather services. They do not connect to PostgreSQL or OpenWeather
and do not read `.env`. PostgreSQL/Flyway/JSONB must also be verified against an
isolated disposable database when changing persistence behavior.

## Configuration

`JWT_SECRET` must be standard Base64 encoding of at least 32 cryptographically
random bytes. Missing, blank, malformed or short keys fail application startup.
Never commit a real signing key. The key must stay consistent across backend
replicas and restarts. HS256 and the existing token format are preserved.

## Client compatibility

- Existing routes and successful HTTP 200 responses are preserved.
- `/api/v1/user/me` returns only `id`, `email` and `createdAt`.
- Errors retain `message`, `code`, `status`, `path` and `timestamp`.
- Missing/invalid authentication and wrong login credentials return 401
  (`UNAUTHORIZED`); authorization failures return 403 (`FORBIDDEN`). A supplied
  invalid Bearer token is rejected even on public routes.
- Invalid JSON/parameter types and missing query parameters return 400
  (`INVALID_REQUEST`). Bean Validation failures return 400 (`VALIDATION_ERROR`).
- Missing or another user's favorite returns 404 (`HTTP_404`); duplicate email
  registration remains 409 (`EMAIL_ALREADY_REGISTERED`).
- Latitude is limited to [-90, 90], longitude to [-180, 180]. Email, location
  names, state, display name and search query are limited to 255 characters;
  country is limited to 10. Required strings cannot be blank.
- Passwords remain nonblank, with no new minimum length. The maximum is 72
  UTF-8 bytes to match BCrypt, including for multibyte input. Oversized input
  now returns 400 rather than reaching the password encoder.
- Unix timestamps remain absolute UTC seconds. Clients must use timezone
  metadata for display without changing the underlying instant.
- CORS is intentionally unchanged; the planned frontend uses a same-origin proxy.

## Existing weather cache

No cache rows or user data are deleted. Cache entries produced by the old version
can still contain shifted timestamps until their existing 10-minute TTL expires.
Allow up to 10 minutes after the last old-version cache write; during a rolling
upgrade, count this from when all old writers have stopped. Newly fetched entries
preserve UTC. Expired entries are not served, even if OpenWeather is unavailable.
Cache concurrency and retention improvements belong to Stage 2B.
