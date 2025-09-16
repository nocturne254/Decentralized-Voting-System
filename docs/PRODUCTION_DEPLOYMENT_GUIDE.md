# Production Deployment Guide

This comprehensive guide covers deploying the Decentralized Voting System to production environments with best practices for security, scalability, and monitoring.

## Prerequisites

### System Requirements
- **Node.js**: 18.x or higher
- **Python**: 3.9 or higher
- **MySQL**: 8.0 or higher
- **Docker**: 20.10 or higher (optional)
- **Nginx**: 1.18 or higher (recommended)

### Infrastructure Requirements
- **Minimum**: 2 CPU cores, 4GB RAM, 50GB storage
- **Recommended**: 4 CPU cores, 8GB RAM, 100GB SSD storage
- **Load Balancer**: For high availability deployments
- **SSL Certificate**: Required for HTTPS

## Quick Start Deployment

### 1. Environment Setup

```bash
# Clone the repository
git clone https://github.com/your-org/decentralized-voting-system.git
cd decentralized-voting-system

# Copy environment template
cp .env.example .env

# Install dependencies
npm install
cd Database_API && pip install -r requirements.txt && cd ..
```

### 2. Configure Environment Variables

Edit `.env` with your production values:

```bash
# Institution Configuration
VITE_INSTITUTION_NAME="Your Organization"
VITE_INSTITUTION_SHORT_NAME="YO"
VITE_PRIMARY_COLOR="#1e40af"
VITE_SECONDARY_COLOR="#3b82f6"
VITE_ACCENT_COLOR="#f59e0b"

# API Configuration
API_PORT=3000
API_BASE_URL=https://api.yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com,https://portal.yourdomain.com

# Database Configuration
DATABASE_URL=mysql://username:password@localhost:3306/voting_db
REDIS_URL=redis://localhost:6379

# Blockchain Configuration
BLOCKCHAIN_NETWORK=mainnet
INFURA_PROJECT_ID=your_infura_project_id
PRIVATE_KEY=your_ethereum_private_key

# Security
JWT_SECRET=your_super_secure_jwt_secret_here
API_KEY_SECRET=your_api_key_secret_here
ENCRYPTION_KEY=your_32_character_encryption_key

# Email Configuration
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your_smtp_password

# Monitoring
LOG_LEVEL=info
ELASTICSEARCH_URL=https://your-elasticsearch-cluster
SLACK_WEBHOOK_URL=https://hooks.slack.com/your-webhook
```

### 3. Database Setup

```bash
# Create database
mysql -u root -p -e "CREATE DATABASE voting_db;"
mysql -u root -p -e "CREATE USER 'voting_user'@'localhost' IDENTIFIED BY 'secure_password';"
mysql -u root -p -e "GRANT ALL PRIVILEGES ON voting_db.* TO 'voting_user'@'localhost';"

# Run migrations
cd Database_API
python manage.py migrate
cd ..
```

### 4. Build and Deploy

```bash
# Build the application
npm run build

# Deploy using the deployment script
chmod +x scripts/deploy.sh
./scripts/deploy.sh production
```

## Docker Deployment

### 1. Using Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  voting-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mysql://voting_user:${DB_PASSWORD}@mysql:3306/voting_db
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mysql
      - redis
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs

  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - MYSQL_DATABASE=voting_db
      - MYSQL_USER=voting_user
      - MYSQL_PASSWORD=${DB_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
      - ./backups:/backups
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
      - ./dist:/usr/share/nginx/html
    depends_on:
      - voting-api
    restart: unless-stopped

volumes:
  mysql_data:
  redis_data:
```

### 2. Deploy with Docker

```bash
# Create environment file
echo "DB_PASSWORD=your_secure_password" > .env.docker
echo "MYSQL_ROOT_PASSWORD=your_root_password" >> .env.docker

# Deploy
docker-compose -f docker-compose.prod.yml --env-file .env.docker up -d
```

## Kubernetes Deployment

### 1. Create Kubernetes Manifests

`k8s/namespace.yaml`:
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: voting-system
```

`k8s/configmap.yaml`:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: voting-config
  namespace: voting-system
data:
  NODE_ENV: "production"
  API_PORT: "3000"
  LOG_LEVEL: "info"
```

`k8s/secret.yaml`:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: voting-secrets
  namespace: voting-system
type: Opaque
data:
  database-url: <base64-encoded-database-url>
  jwt-secret: <base64-encoded-jwt-secret>
  api-key-secret: <base64-encoded-api-key-secret>
```

`k8s/deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: voting-api
  namespace: voting-system
spec:
  replicas: 3
  selector:
    matchLabels:
      app: voting-api
  template:
    metadata:
      labels:
        app: voting-api
    spec:
      containers:
      - name: voting-api
        image: voting-system:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: voting-config
        - secretRef:
            name: voting-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/v1/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/v1/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 2. Deploy to Kubernetes

```bash
# Apply manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n voting-system
kubectl get services -n voting-system
```

## Nginx Configuration

Create `/etc/nginx/sites-available/voting-system`:

```nginx
upstream voting_api {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001 backup;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=widget:10m rate=30r/s;

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Serve static files
    location / {
        root /var/www/voting-system/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API endpoints
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://voting_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Widget endpoints
    location /embed/ {
        limit_req zone=widget burst=50 nodelay;
        
        proxy_pass http://voting_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS for widget embedding
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, Authorization";
    }

    # Metrics endpoint (restrict access)
    location /metrics {
        allow 10.0.0.0/8;
        allow 172.16.0.0/12;
        allow 192.168.0.0/16;
        deny all;
        
        proxy_pass http://voting_api;
        proxy_set_header Host $host;
    }
}
```

## SSL Certificate Setup

### Using Let's Encrypt (Certbot)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Database Optimization

### MySQL Configuration

Add to `/etc/mysql/mysql.conf.d/mysqld.cnf`:

```ini
[mysqld]
# Performance tuning
innodb_buffer_pool_size = 2G
innodb_log_file_size = 256M
innodb_flush_log_at_trx_commit = 2
innodb_flush_method = O_DIRECT

# Connection limits
max_connections = 200
max_user_connections = 180

# Query cache
query_cache_type = 1
query_cache_size = 128M

# Slow query log
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2
```

### Database Backups

Create backup script `/opt/voting-system/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/backups/mysql"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="voting_db"

# Create backup
mysqldump -u voting_user -p$DB_PASSWORD $DB_NAME | gzip > $BACKUP_DIR/voting_db_$DATE.sql.gz

# Keep only last 7 days of backups
find $BACKUP_DIR -name "voting_db_*.sql.gz" -mtime +7 -delete

# Upload to S3 (optional)
# aws s3 cp $BACKUP_DIR/voting_db_$DATE.sql.gz s3://your-backup-bucket/
```

Add to crontab:
```bash
# Daily backup at 2 AM
0 2 * * * /opt/voting-system/backup.sh
```

## Monitoring Setup

### Prometheus Configuration

`prometheus.yml`:
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'voting-system'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']

rule_files:
  - "voting_system_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### Grafana Dashboard

Import the provided dashboard JSON or create custom dashboards monitoring:
- API response times
- Error rates
- Vote counts
- Active elections
- System resources

### Log Aggregation

Configure Elasticsearch and Kibana for centralized logging:

```bash
# Install Elasticsearch
wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo apt-key add -
echo "deb https://artifacts.elastic.co/packages/7.x/apt stable main" | sudo tee /etc/apt/sources.list.d/elastic-7.x.list
sudo apt update && sudo apt install elasticsearch

# Configure Elasticsearch
sudo systemctl enable elasticsearch
sudo systemctl start elasticsearch

# Install Kibana
sudo apt install kibana
sudo systemctl enable kibana
sudo systemctl start kibana
```

## Security Hardening

### System Security

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban

# Configure firewall
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# Disable root login
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

### Application Security

1. **Environment Variables**: Never commit secrets to version control
2. **API Keys**: Rotate regularly and use different keys per environment
3. **Database**: Use read-only replicas for reporting
4. **HTTPS**: Enforce HTTPS everywhere with HSTS headers
5. **Rate Limiting**: Implement aggressive rate limiting for public endpoints

## Performance Optimization

### Application Level

1. **Caching**: Implement Redis caching for frequently accessed data
2. **Database Indexing**: Add indexes on frequently queried columns
3. **Connection Pooling**: Use connection pools for database connections
4. **CDN**: Use CloudFlare or similar CDN for static assets

### Infrastructure Level

1. **Load Balancing**: Use multiple application instances behind a load balancer
2. **Auto Scaling**: Configure auto-scaling based on CPU/memory usage
3. **Database Clustering**: Set up MySQL master-slave replication
4. **Monitoring**: Set up comprehensive monitoring and alerting

## Troubleshooting

### Common Issues

1. **High Memory Usage**:
   ```bash
   # Check memory usage
   free -h
   # Restart application
   pm2 restart voting-api
   ```

2. **Database Connection Issues**:
   ```bash
   # Check MySQL status
   sudo systemctl status mysql
   # Check connections
   mysql -e "SHOW PROCESSLIST;"
   ```

3. **SSL Certificate Issues**:
   ```bash
   # Check certificate expiry
   openssl x509 -in /path/to/cert.crt -text -noout | grep "Not After"
   # Renew Let's Encrypt certificate
   sudo certbot renew
   ```

### Log Locations

- Application logs: `/var/log/voting-system/`
- Nginx logs: `/var/log/nginx/`
- MySQL logs: `/var/log/mysql/`
- System logs: `/var/log/syslog`

## Maintenance

### Regular Tasks

1. **Weekly**: Review logs for errors and security issues
2. **Monthly**: Update dependencies and security patches
3. **Quarterly**: Review and rotate API keys and secrets
4. **Annually**: Review and update SSL certificates

### Health Checks

Monitor these endpoints regularly:
- `GET /api/v1/health` - Application health
- `GET /metrics` - System metrics
- `GET /api/v1/elections` - API functionality

## Support and Documentation

- **API Documentation**: `/docs/API_DOCUMENTATION.md`
- **Integration Examples**: `/examples/integration-examples.md`
- **Monitoring Dashboard**: `https://grafana.yourdomain.com`
- **Log Analysis**: `https://kibana.yourdomain.com`

For additional support, contact the development team or refer to the project repository for the latest updates and documentation.
