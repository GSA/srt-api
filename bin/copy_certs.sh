#!/bin/bash

mkdir /opt/api/server/certs/

if [ "$NODE_ENV" = "production" ]; then
    cp /opt/api/certs/prod/* /opt/api/server/certs/
elif [ "$NODE_ENV" = "staging" ]; then
    cp /opt/api/certs/staging/* /opt/api/server/certs/
else
    cp /opt/api/certs/dev/* /opt/api/server/certs/
fi

rm -rf /opt/api/certs
