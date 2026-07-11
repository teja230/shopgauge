# Runtime roles

StoreSight uses one tested backend image with three independently scalable process roles:

- `api` handles public HTTP traffic and never activates Spring scheduling.
- `scheduler` activates recurring maintenance, monitoring, discovery, retention, and cache jobs.
- `scraper-worker` activates the Redis price-refresh consumer and its scheduled polling loop.

Set `SPRING_PROFILES_ACTIVE` to `prod`, `prod,scheduler`, or `prod,worker` respectively. The
production Docker entrypoint preserves this environment value. A deployable topology is provided
in `docker-compose.roles.yml`; managed platforms should create equivalent services from the same
immutable image and route public traffic only to the API role.

Run exactly one scheduler replica unless a scheduled job has its own distributed lock. Scraper
workers may scale horizontally because refresh jobs are claimed through Redis.
