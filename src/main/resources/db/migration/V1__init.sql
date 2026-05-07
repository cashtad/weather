create
extension if not exists "uuid-ossp";

create table users
(
    id            uuid primary key default uuid_generate_v4(),
    email         varchar(255) not null unique,
    password_hash varchar(255) not null,
    created_at    timestamp    not null
);

create table favorite_locations
(
    id           uuid primary key default uuid_generate_v4(),
    user_id      uuid             not null references users (id) on delete cascade,
    name         varchar(255)     not null,
    country      varchar(10),
    state        varchar(255),
    lat          double precision not null,
    lon          double precision not null,
    display_name varchar(255)     not null,
    created_at   timestamp        not null
);

create table weather_cache
(
    id         uuid primary key default uuid_generate_v4(),
    lat        double precision not null,
    lon        double precision not null,
    type       varchar(20)      not null,
    data_json  jsonb            not null,
    updated_at timestamp        not null
);

create index idx_weather_cache_coords_type
    on weather_cache (lat, lon, type);