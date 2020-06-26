#!/bin/bash

sudo docker stop srt-db
sudo docker rm srt-db
echo "Starting Postgres version 9.5.15"
sudo docker run --name srt-db -e POSTGRES_DB=srt -e POSTGRES_USER=circleci -e POSTGRES_PASSWORD=srtpass -v $PWD/sql:/docker-entrypoint-initdb.d -p 5432:5432 --restart unless-stopped -d postgres:9.5.15
while ! curl http://localhost:5432/ 2>&1 | grep '52'
do
  sleep 1
  echo "waiting for postgres startup"
done
sleep 1
psql < ./sql/srt-database-export.sql
