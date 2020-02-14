#!/bin/bash

docker run --network host -e PGHOST=${PGHOST} -e PGDATABASE=${PGDATABASE} -e PGUSER=${PGUSER} -e PGPASSWORD=${PGPASSWORD} -it postgres psql
