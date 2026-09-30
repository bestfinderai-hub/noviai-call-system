#!/bin/bash
# NoviAi Call System — Oracle Cloud Always Free ARM setup
# Ubuntu 22.04 LTS, aarch64
# Run as: sudo bash setup-oracle.sh

set -euo pipefail

DOMAIN="${DOMAIN:-calls.noviai.se}"
APP_DIR="/opt/noviai"
LOG_DIR="/var/log/noviai"
SERVICE_USER="noviai"

echo "=== NoviAi Call System — Oracle Cloud Setup ==="
echo "Domain: $DOMAIN"
echo "App dir: $APP_DIR"

# 1. System packages
apt-get update -y
apt-get install -y curl git nginx certbot python3-certbot-nginx ufw

# 2. Node.js 20 LTS
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "Node: $(node -v)"

# 3. PM2
npm install -g pm2

# 4. Service user
if ! id "$SERVICE_USER" &>/dev/null; then
  useradd -r -m -s /bin/bash "$SERVICE_USER"
fi

# 5. App directory
mkdir -p "$APP_DIR" "$LOG_DIR"
chown "$SERVICE_USER:$SERVICE_USER" "$APP_DIR" "$LOG_DIR"

echo ""
echo "=== Upload your code ==="
echo "From your local machine, run:"
echo "  scp -r C:/claude-pro/noviaivapi/* ubuntu@<YOUR_IP>:$APP_DIR/"
echo "  scp C:/claude-pro/noviaivapi/.env ubuntu@<YOUR_IP>:$APP_DIR/.env"
echo ""
echo "Then press ENTER to continue..."
read -r

# 6. Install dependencies
cd "$APP_DIR"
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"
sudo -u "$SERVICE_USER" npm ci --omit=dev

# 7. nginx config
cp "$APP_DIR/nginx/noviai-call-system.conf" /etc/nginx/sites-available/noviai-call-system
ln -sf /etc/nginx/sites-available/noviai-call-system /etc/nginx/sites-enabled/noviai-call-system
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

# 8. SSL certificate
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m admin@noviai.se
systemctl enable certbot.timer

# 9. Firewall — open 80, 443, 22 only
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# 10. Start with PM2
sudo -u "$SERVICE_USER" pm2 start "$APP_DIR/ecosystem.config.js"
sudo -u "$SERVICE_USER" pm2 save
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$SERVICE_USER" --hp "/home/$SERVICE_USER"

echo ""
echo "=== Done! ==="
echo "Health check: https://$DOMAIN/health"
echo ""
echo "Next steps:"
echo "  1. Copy your .env to $APP_DIR/.env"
echo "  2. Update SERVER_DOMAIN=$DOMAIN in .env"
echo "  3. Update Telnyx webhook URL to https://$DOMAIN/webhooks/telnyx"
echo "  4. pm2 restart noviai-call-system"
