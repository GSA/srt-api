#!/bin/bash

mkdir /opt/api/server/certs/

if [ "$NODE_ENV" = "production" ]; then
    cp /opt/api/certs/prod/* /opt/api/server/certs/
elif [ "$NODE_ENV" = "staging" ]; then
    cp /opt/api/certs/staging/* /opt/api/server/certs/
else
    if [ -z "${LOGIN_PRIVATE_KEY}"]; then
        echo $LOGIN_PRIVATE_KEY > /opt/api/server/certs/private.pem
    fi
    cp /opt/api/certs/dev/* /opt/api/server/certs/
fi

rm -rf /opt/api/certs
