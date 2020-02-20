#!/bin/bash

docker run --network host -v `pwd`:/opt -e PGHOST=${PGHOST} -e PGDATABASE=${PGDATABASE} -e PGUSER=${PGUSER} -e PGPASSWORD=${PGPASSWORD} -it postgres pg_dump -f /opt/db_backup.docker.sql

