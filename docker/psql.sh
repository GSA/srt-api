#!/bin/bash

echo "Starting Postgres version 9"
docker run --network host -e PGHOST=${PGHOST} -e PGDATABASE=${PGDATABASE} -e PGUSER=${PGUSER} -e PGPASSWORD=${PGPASSWORD} -it postgres:9 psql
