# Stage 4 Docker Compose handoff

Stage 4A implemented the three-container stack. Stage 4B completed the
verification checklist below, including database recovery, volume persistence
and Nginx recovery after a change to the backend IP. This document records the
historical handoff. See the [release notes](releases/course-compose-v1.0.0.md)
for the submitted snapshot. The root
[Compose guide](../README.md#run-with-docker-compose) covers setup, health checks,
configuration and safe shutdown.

```text
Browser -> Nginx frontend -> Spring Boot -> PostgreSQL
                                 |
                                 +-------> OpenWeather
```

## Stage 4B verification checklist (completed)

1. Follow the README on a clean environment with an isolated Compose project.
   Confirm image pulls, health-aware startup and the frontend address.
2. Exercise the complete browser journeys through Nginx. Include guest
   location fallbacks, city search, forecasts, account registration, session
   restoration, favorites and logout. Use controlled provider responses for
   failure cases and avoid unnecessary live weather calls.
3. Recreate the stack with the same disposable volume and confirm that
   accounts, favorites and cached forecasts remain available.
4. Stop PostgreSQL and observe backend readiness and API behavior. Restore
   PostgreSQL and verify recovery. Recreate the backend while Nginx stays up
   and verify that Nginx resolves the replacement on the project network.
5. Validate the README commands and safe shutdown. Browser geolocation
   requires localhost or HTTPS.
