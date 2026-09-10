#!/bin/bash
#
# Selects the Login.gov signing certificate for the environment being built.
#
# This used to be a plain if/elif that tested NODE_ENV against the exact strings
# "production" and "staging", and quietly fell through to the dev certificates
# for anything else. A production image built with environment=prod therefore
# shipped dev certs: the app still read the correct production Login.gov
# settings at runtime, because cloud.gov sets NODE_ENV=production there, but the
# client assertion was signed with a key Login.gov does not hold for this client.
# Sign-in bounced everyone back to the auth page, and nothing in the build failed.
#
# Now an unrecognised value stops the build instead, and the chosen set is
# printed so the build log records which certificates went in.

set -euo pipefail

mkdir -p /opt/api/server/certs/

case "${NODE_ENV:-}" in
  production|prod)
    CERT_SRC=/opt/api/certs/prod
    ;;
  staging|cloudstaging)
    CERT_SRC=/opt/api/certs/staging
    ;;
  development|dev|clouddev|test|circle|"")
    CERT_SRC=/opt/api/certs/dev
    # Local and CI builds may inject a key rather than use the committed one.
    if [ -n "${LOGIN_PRIVATE_KEY:-}" ]; then
      echo "$LOGIN_PRIVATE_KEY" > /opt/api/server/certs/private.pem
      chmod 600 /opt/api/server/certs/private.pem
    fi
    ;;
  *)
    echo "copy_certs.sh: refusing to build, unrecognised NODE_ENV '${NODE_ENV}'." >&2
    echo "  Expected one of: production, prod, staging, cloudstaging," >&2
    echo "                   development, dev, clouddev, test, circle" >&2
    exit 1
    ;;
esac

cp "$CERT_SRC"/* /opt/api/server/certs/
echo "copy_certs.sh: NODE_ENV='${NODE_ENV:-}' -> using $(basename "$CERT_SRC") certificates"
sha256sum /opt/api/server/certs/public.crt /opt/api/server/certs/private.pem 2>/dev/null || true

rm -rf /opt/api/certs
