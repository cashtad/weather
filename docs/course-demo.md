# Weather Dashboard course demonstration

## Architecture

```text
Browser -> localhost:8080 -> Nginx -> backend:8080 -> postgres:5432
                                        |
                                        +----------> OpenWeather over HTTPS
```

The browser renders the dashboard and sends relative `/api/v1/` requests.
Nginx serves the compiled site and forwards those requests to Spring Boot on
the same browser origin. Spring Boot authenticates users, manages favorites,
and fetches forecasts and city search results from OpenWeather. PostgreSQL
stores users, favorites, the weather cache and Flyway migration history.

| Concept | In this project |
| --- | --- |
| Image, container, service | An image packages the runtime and its files. A container is a running instance. Compose defines three services and starts their containers together. |
| Multi-stage build | Node builds Vite's static assets and only the result enters the Nginx image. Maven builds the backend JAR, which runs in the Java 17 runtime image. |
| Reverse proxy | Nginx serves the site and proxies `/api/` without changing the API path. The browser uses one origin and needs no backend address. |
| Network and DNS | Compose joins the services to a project network. The names `backend` and `postgres` resolve there even when container IP addresses change. Only Nginx's loopback port is published. |
| Named volume | `pgdata` stores the PostgreSQL data directory across container replacement. |
| Environment variables | Compose reads local `.env` for substitution and passes selected values to each service. Keep credentials private. |
| Health and startup order | PostgreSQL reports readiness, then Spring Boot starts and verifies database access. Nginx starts once the backend is ready. Its health probe checks that Nginx can respond to HTTP. |

Separate frontend and backend images let Nginx run with static files and
Spring Boot run with Java. PostgreSQL stays on the internal network because
only the backend needs direct database access. This local demonstration uses
HTTP on localhost.

## Start and show the application

1. Follow the [Compose setup](../README.md#run-with-docker-compose) to configure
   database credentials, the JWT signing key and your OpenWeather key.
2. Run the commands below and wait for three healthy services.
3. Open [http://localhost:8080](http://localhost:8080) and search for Prague in
   the header. Point out the local time, large temperature and weather icon,
   then scroll through the hourly cards, weekly list and bottom details.
4. Register a demonstration account or sign in. Save the city using the heart
   button. Focus the empty search field to select it from **Saved places**,
   then reload the tab to show session restoration.
5. Use the Compose output to explain which port is published and why the API
   and database communicate over the internal network.

```sh
docker compose config --quiet
docker compose up --build -d
docker compose ps
docker compose logs --tail=50 backend postgres frontend
docker compose exec frontend nslookup backend 127.0.0.11
```

## Show persistence

Keep a demonstration favorite saved. From the same project, run:

```sh
docker compose down
docker compose up -d --wait
```

Sign in and show that the favorite still exists. Compose created new
containers and mounted the same project volume. Keep the same project name
and database credentials. Use plain `docker compose down` when you finish.

## Optional recovery demonstration

Use a disposable project and database for the following commands. Prepare a
private env file outside the repository using the same required variables,
temporary credentials and a free `FRONTEND_PORT`. Substitute its actual path
for `demo-test.env`. Choose an unused project name in place of `weather-demo`
and keep the same `--env-file` and `-p` on every command.

```sh
docker compose --env-file /path/to/demo-test.env -p weather-demo up --build -d --wait
docker compose --env-file /path/to/demo-test.env -p weather-demo stop postgres
docker compose --env-file /path/to/demo-test.env -p weather-demo exec backend curl -sS -i http://127.0.0.1:8080/actuator/health/readiness
docker compose --env-file /path/to/demo-test.env -p weather-demo exec backend curl -sS -i http://127.0.0.1:8080/actuator/health/liveness
docker compose --env-file /path/to/demo-test.env -p weather-demo start postgres
docker compose --env-file /path/to/demo-test.env -p weather-demo ps
```

While PostgreSQL is stopped, wait for failed health probes. Readiness should
return HTTP 503, liveness HTTP 200, and Nginx should still serve the page.
After PostgreSQL returns, check readiness and reload the favorites list.
An unhealthy status alone does not restart the backend.

For a second example, recreate only the disposable backend:

```sh
docker compose --env-file /path/to/demo-test.env -p weather-demo up -d --force-recreate --no-deps backend
docker compose --env-file /path/to/demo-test.env -p weather-demo ps
docker compose --env-file /path/to/demo-test.env -p weather-demo down
```

Before the final `down` command, wait for backend health and retry API access
in the browser. Nginx keeps running; a single backend can be unavailable
during replacement. Docker may reuse the old IP, so compare the two addresses
if you want to demonstrate DNS re-resolution specifically.

To check the proxy connection timeout, stop only the disposable backend and
request `/api/v1/user/me` through the published frontend port. The gateway
should return 502 or 504 within a few seconds while the dashboard remains
accessible. Start the backend again and use **Retry** or **Retry session** in
the dashboard. A recovered protected endpoint returns 401 without a JWT.
