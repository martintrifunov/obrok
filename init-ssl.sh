#!/bin/bash
set -e # Stops the script immediately if Docker fails to build

domains=(obrok.net docs.obrok.net)
cert_name="obrok.net"
rsa_key_size=4096
data_path="./data/certbot"
email="${CERTBOT_EMAIL:-your-email@example.com}" # or: CERTBOT_EMAIL=you@example.com ./init-ssl.sh

if [ "$email" = "your-email@example.com" ]; then
  echo "Set a real email (CERTBOT_EMAIL=you@example.com ./init-ssl.sh); Let's Encrypt rejects the placeholder." >&2
  exit 1
fi

# nginx proxies /route/ to OSRM and won't start if OSRM isn't running.
if ! ls ./data/map/*.osrm* >/dev/null 2>&1; then
  echo "No OSRM data in ./data/map. Run ./init-route-data.sh first." >&2
  exit 1
fi

backup_path=""
if [ -d "$data_path/conf" ]; then
  read -p "Existing data found for ${domains[*]}. Continue and replace existing certificate? (y/N) " decision
  if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
    exit
  fi
  # Move the old certs aside instead of deleting them, so a failed request can be undone.
  backup_path="$data_path/conf.bak-$(date +%Y%m%d%H%M%S)"
  echo "### Backing up existing certbot data to $backup_path ..."
  mv "$data_path/conf" "$backup_path"
fi

restore_backup() {
  if [ -n "$backup_path" ] && [ -d "$backup_path" ]; then
    echo "### Certificate setup failed; restoring previous certificates from $backup_path ..." >&2
    rm -rf "$data_path/conf"
    mv "$backup_path" "$data_path/conf"
    docker compose -f docker-compose.prod.yml restart nginx || true
  fi
}
trap restore_backup ERR

echo "### Downloading recommended TLS parameters ..."
mkdir -p "$data_path/conf"
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$data_path/conf/options-ssl-nginx.conf"
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$data_path/conf/ssl-dhparams.pem"

echo "### Creating dummy certificate for ${domains[*]} ..."
path="/etc/letsencrypt/live/$cert_name"
mkdir -p "$data_path/conf/live/$cert_name"
docker compose -f docker-compose.prod.yml run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:$rsa_key_size -days 1\
    -keyout '$path/privkey.pem' \
    -out '$path/fullchain.pem' \
    -subj '/CN=localhost'" certbot

echo "### Starting nginx ..."
docker compose -f docker-compose.prod.yml up --build --force-recreate -d nginx

echo "### Deleting dummy certificate for $cert_name ..."
docker compose -f docker-compose.prod.yml run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$cert_name && \
  rm -Rf /etc/letsencrypt/archive/$cert_name && \
  rm -Rf /etc/letsencrypt/renewal/$cert_name.conf" certbot

echo "### Requesting Let's Encrypt certificate for ${domains[*]} ..."
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

# Request real certs
docker compose -f docker-compose.prod.yml run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    --email $email \
    --cert-name $cert_name \
    $domain_args \
    --rsa-key-size $rsa_key_size \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    --force-renewal" certbot

trap - ERR

echo "### Reloading nginx ..."
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

if [ -n "$backup_path" ]; then
  echo "### New certificate issued; removing backup $backup_path ..."
  rm -rf "$backup_path"
fi

echo "### Booting up the rest of the application..."
docker compose -f docker-compose.prod.yml up -d