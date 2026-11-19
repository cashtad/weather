# Stage 2B: reliability and infrastructure readiness

## Provider integration

`OpenWeatherClient` shares HTTP/JSON error handling between the existing weather
and geo services. It uses RestTemplate with explicit configurable connect/read
timeouts (3s/10s). URI template values are strictly encoded before the URI overload
is called, so spaces, Unicode and reserved characters cannot inject query parameters.
Metric units, English language and existing endpoint paths remain unchanged.
No application retries, circuit breakers or alternative providers are added.

Connection errors/timeouts, HTTP 429 and upstream 5xx map to 503. Provider 401/403
and other failed HTTP responses map to 502. Invalid/empty JSON, trailing tokens,
wrong shapes and missing required weather/geo data map to 502. Logs contain only
the operation and category/status, never the URL, API key, raw response or upstream
exception message. API errors retain the Stage 2A ErrorResponse structure.

Geocoding requires an array (empty is a valid no-result response) with nonblank
name/country and numeric in-range coordinates. Weather requires numeric in-range
coordinates, timezone metadata and the requested blocks: positive integral Unix
`dt`, numeric temperature (daily min/max), nonempty weather arrays with integral
IDs, and nonempty forecast arrays where requested. Optional fields remain optional;
unknown provider fields remain ignored by the existing DTOs. Validation and mapping
finish before a cache write; invalid provider data cannot replace a cached row.

## Cache integrity

V1 is unchanged. V2 briefly locks only `weather_cache` against concurrent writes,
then ranks exact `(lat, lon, type)` groups by `updated_at DESC, id DESC`. The newest
row is kept; greatest UUID is the deterministic tie-breaker. Only redundant cache
rows are deleted. Users, favorites and other logical cache keys are preserved.
V2 adds `uq_weather_cache_coords_type` and removes the redundant nonunique index.
PostgreSQL/Flyway executes this migration transactionally.

`CacheService.saveCache` uses one transactional native INSERT ... ON CONFLICT
statement. Updates preserve the original row UUID and replace JSONB and update
time without deleting the old row. The modifying query flushes pending changes
and clears managed snapshots so native SQL cannot leave stale cached entities in
the persistence context. Read transactions retain the original freshness rule;
TTL defaults to 10 minutes and can be configured. No cleanup scheduler is added:
rows for coordinates that are never requested again can accumulate.

The database constraint guarantees at most one row per exact key across threads
and processes. Last successful database writer wins. This does not serialize
external fetches: simultaneous misses may call OpenWeather more than once, and
that is accepted for this milestone. No in-memory/distributed lock is presented
as a solution to provider request deduplication. Coordinates are not rounded.

Old shifted timestamp entries from before Stage 2A can survive until their TTL
expires; this stage does not clear the cache or alter user data.

## Health and verification

Only `/actuator/health`, `/actuator/health/liveness` and
`/actuator/health/readiness` are public. Liveness includes only `livenessState`;
readiness explicitly includes `readinessState,db`. Details/components are hidden.
OpenWeather is not a health dependency. No Kubernetes manifests are added.

Unit and MVC tests use mock HTTP and a controlled database health indicator.
`PostgresCacheIT` is explicitly enabled with `-Ppostgres-it verify` and requires
real disposable PostgreSQL; it does not use H2 or claim mocked SQL verification.
See the README for environment variables and commands. Runtime verification also
checks the built Java 17 container, actual PostgreSQL shutdown/recovery and health,
API regressions, encoded geocoding, weather mapping and JSONB cache reads against
a local mock provider. No real OpenWeather quota is required.

### Executed verification

- Maven compile, ordinary tests and package: successful; 91 tests, zero failures,
  errors or skips. All 51 Stage 2A regression cases remain included.
- `mvnw -Ppostgres-it verify`: successful; four additional tests on PostgreSQL
  16.16, including V1-to-V2 deduplication, constraints, JSONB and 32 concurrent
  service writes using independent transactions. Total executed suite: 95 tests.
- The updated image was built and started with Temurin Java 17.0.21. The primary
  isolated runtime suite passed 26 HTTP checks; the final image also passed six
  smoke checks and three provider-offline checks.
- Actual temporary PostgreSQL shutdown produced readiness 503/DOWN while liveness
  stayed 200/UP; restarting PostgreSQL restored readiness. With the local mock
  provider stopped, both probes stayed UP and geocoding returned 503.
- Real OpenWeather requests: zero. Real `.env` and pre-existing databases/volumes
  were not changed. Verification used disposable containers, volume and credentials.

Timeout classification was verified with mocked socket exceptions and timeout
values were inspected directly; no slow real-network timeout experiment was used.
The database outage runtime test used a temporary Hikari connection timeout of
1000 ms to bound the check; production pool defaults were not changed.
Concurrency verification used independent PostgreSQL transactions/connections,
not multiple backend deployments and not a claim of upstream request deduplication.
