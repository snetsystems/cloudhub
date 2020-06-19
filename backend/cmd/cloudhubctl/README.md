## Cloudhubctl

Cloudhubctl is a tool to interact with an instance of a cloudhub's bolt database.

```
Available commands:
  add-superadmin  Creates a new superadmin user  (bolt specific)
  list-users      Lists users                    (bolt specific)
  migrate         Migrate db (beta)
```

### Migrate

The `migrate` command allows you to migrate your cloudhub configuration store. It is highly recommended that you make a backup of all databases involved before running a migration as there is no guarantee that there will be no data loss. When specifying an etcd endpoint, the URI must begin with `etcd://`. It is preferred that you prefix `bolt://` to an absolute path when specifying a local bolt db file, but a lone relative path is also accepted without the prefix. If there is authentication on etcd, use the standard URI format to define a username/password: `[scheme:][//[userinfo@]host][/]path`.
There is currently no cleanup for a failed migration, so keep that in mind before migrating to a db that contains other important data.

##### Usage

```
cloudhubctl migrate [OPTIONS]

OPTIONS
    -f, --from= Full path to boltDB file or etcd (e.g. 'bolt:///path/to/cloudhub-v1.db' or 'etcd://user:pass@localhost:2379 (default: cloudhub-v1.db)
    -t, --to=   Full path to boltDB file or etcd (e.g. 'bolt:///path/to/cloudhub-v1.db' or 'etcd://user:pass@localhost:2379 (default: etcd://localhost:2379)
```

##### Example

```sh
$ cloudhubctl migrate -f etcd://localhost:2379 -t bolt:///tmp/cloudhub.db
# Performing non-idempotent db migration from "etcd://localhost:2379" to "bolt:///tmp/cloudhub.db"...
#   Saved 1 organizations.
#   Saved 1 organization configs.
#   Saved 1 dashboards.
#   Saved 3 mappings.
#   Saved 0 servers.
#   Saved 1 sources.
# Migration successful!

$ cloudhubctl migrate -f ./cloudhub-v1.db -t etcd://localhost:2379
# Performing non-idempotent db migration from "./cloudhub-v1.db" to "etcd://localhost:2379"...
#   Saved 1 organizations.
#   Saved 1 organization configs.
#   Saved 1 dashboards.
#   Saved 3 mappings.
#   Saved 0 servers.
#   Saved 1 sources.
# Migration successful!
```
