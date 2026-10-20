# HTTPS, SSL/TLS, and Reverse Proxy Configuration
## Target URL: `https://asset.nkbmanufacturing.com`

---

## 1. Existing Host Configuration Findings

A live probe of VPS `187.77.143.211` reveals:
- **Port 80 (HTTP)**: Active and bound by `nginx/1.26.3`.
- **Port 443 (HTTPS)**: Active and bound by `nginx/1.26.3`.
- **Existing Certificate**: Let's Encrypt certificate issued for `CN=my.nkbmanufacturing.com` (valid through Nov 2026).
- **Existing Service**: NKB Client Portal B2B Cosmetics Ordering application.

### Reverse Proxy Strategy
Rather than running an conflicting second proxy container or disturbing `my.nkbmanufacturing.com`, we integrate `asset.nkbmanufacturing.com` into the host's existing Nginx installation as an isolated virtual host (`server` block).

---

## 2. Nginx Server Configuration

On the VPS, create a dedicated Nginx configuration file:

```bash
nano /etc/nginx/sites-available/asset.nkbmanufacturing.com
# or /etc/nginx/conf.d/asset.nkbmanufacturing.com.conf (depending on Linux distribution)
```

Paste the following production reverse-proxy configuration:

```nginx
# ==============================================================================
# NGINX REVERSE PROXY: asset.nkbmanufacturing.com -> 127.0.0.1:5050
# ==============================================================================

server {
    listen 80;
    listen [::]:80;
    server_name asset.nkbmanufacturing.com;

    # Let's Encrypt HTTP-01 challenge directory
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all HTTP requests to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name asset.nkbmanufacturing.com;

    # SSL Certificates (Auto-configured by Certbot)
    ssl_certificate /etc/letsencrypt/live/asset.nkbmanufacturing.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/asset.nkbmanufacturing.com/privkey.pem;

    # Recommended Security Headers & SSL Protocol Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Allow up to 25MB for asset photo uploads
    client_max_body_size 25M;

    # Forward all traffic to the Unified Container running on 127.0.0.1:5050
    location / {
        proxy_pass http://127.0.0.1:5050;
        proxy_http_version 1.1;

        # WebSocket support (Required for notifications and real-time updates)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Forwarded Client Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;

        # Timeouts for heavy reports / exports
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }
}
```

Enable site configuration:
```bash
ln -s /etc/nginx/sites-available/asset.nkbmanufacturing.com /etc/nginx/sites-enabled/
```

---

## 3. SSL Certificate Generation via Certbot

Once the DNS `A` record has propagated (verified via `Resolve-DnsName` or `dig`):

1. **Request Let's Encrypt Certificate**:
   ```bash
   certbot --nginx -d asset.nkbmanufacturing.com
   ```
   Certbot will:
   - Validate ownership of `asset.nkbmanufacturing.com`.
   - Issue the certificate and private key to `/etc/letsencrypt/live/asset.nkbmanufacturing.com/`.
   - Update the Nginx SSL certificate paths automatically.

2. **Test Nginx Syntax & Reload Service**:
   ```bash
   nginx -t
   # Expected output: nginx: configuration file /etc/nginx/nginx.conf test is successful

   systemctl reload nginx
   ```

3. **Verify Automated Certificate Renewal**:
   ```bash
   certbot renew --dry-run
   # Expected output: Congratulations, all simulated renewals succeeded.
   ```

---

## 4. Verification & HTTPS Validation Checklist

Run the following checks from an external machine:

1. **Verify HTTP-to-HTTPS Redirection**:
   ```bash
   curl -I http://asset.nkbmanufacturing.com
   # Expected: HTTP/1.1 301 Moved Permanently -> Location: https://asset.nkbmanufacturing.com/
   ```

2. **Verify HTTPS 200 OK**:
   ```bash
   curl -I https://asset.nkbmanufacturing.com
   # Expected: HTTP/2 200 OK
   ```

3. **Verify Health Endpoint**:
   ```bash
   curl https://asset.nkbmanufacturing.com/api/health
   # Expected: {"success":true,"data":{"status":"UP",...}}
   ```
