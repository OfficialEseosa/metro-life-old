#!/bin/sh
# Hosted volumes (Fly, Render, Koyeb) mount over /data owned by root. Start as root, hand the
# save directory to the unprivileged user, then run the server as that user.
set -e
if [ "$(id -u)" = "0" ]; then
  data_dir="$(dirname "${METRO_DATA:-/data/metro-life.json}")"
  mkdir -p "$data_dir"
  chown -R metro "$data_dir"
  exec setpriv --reuid=metro --regid=metro --init-groups "$@"
fi
exec "$@"
