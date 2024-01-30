#!/bin/bash

if [ "$NODE_ENV" = "production" ]; then
    cp /app/certs/prod/* /app/server/certs/
elif [ "$NODE_ENV" = "staging" ]; then
    cp /app/certs/staging/* /app/server/certs/
else
    cp /app/certs/dev/* /app/server/certs/
fi