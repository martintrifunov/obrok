#!/bin/bash
set -e # Stop at the first failing step instead of processing stale data

map_dir="./data/map"
pbf="macedonia-latest.osm.pbf"
mkdir -p "$map_dir"

# -O overwrites the previous download; -P would save a refresh as "$pbf.1"
# and the steps below would keep processing the old file.
wget -O "$map_dir/$pbf" "https://download.geofabrik.de/europe/$pbf"

# Preprocess the data
docker run -t -v "$(pwd)/data/map:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua "/data/$pbf"
docker run -t -v "$(pwd)/data/map:/data" osrm/osrm-backend osrm-partition /data/macedonia-latest.osrm
docker run -t -v "$(pwd)/data/map:/data" osrm/osrm-backend osrm-customize /data/macedonia-latest.osrm
