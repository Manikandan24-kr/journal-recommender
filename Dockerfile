# Unified Dockerfile for Journal Recommender
# Includes: Frontend (nginx) + Backend (Node.js) + PostgreSQL
# Managed by supervisord

# ============================================
# Stage 1: Build Frontend
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

# Build with API pointing to local backend
ENV VITE_API_URL=http://localhost:3001
RUN npm run build

# ============================================
# Stage 2: Build Backend
# ============================================
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci

COPY backend/ ./
RUN npm run build

# ============================================
# Stage 3: Production Image
# ============================================
FROM ubuntu:22.04

# Avoid prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gnupg2 \
    lsb-release \
    nginx \
    supervisor \
    postgresql-14 \
    postgresql-contrib-14 \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ============================================
# Setup PostgreSQL
# ============================================
USER postgres
RUN /etc/init.d/postgresql start && \
    psql --command "CREATE USER journal_user WITH PASSWORD 'journal_pass_2024';" && \
    createdb -O journal_user journal_recommender && \
    psql --command "GRANT ALL PRIVILEGES ON DATABASE journal_recommender TO journal_user;"

USER root

# Copy PostgreSQL init script
COPY backend/database/init.sql /docker-entrypoint-initdb.d/

# ============================================
# Setup Backend
# ============================================
WORKDIR /app/backend

# Copy package files and install production dependencies
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy built backend
COPY --from=backend-builder /app/backend/dist ./dist

# Copy data directory for seeding
COPY data/ /app/data/

# Create uploads directory
RUN mkdir -p uploads && chown -R nobody:nogroup uploads

# ============================================
# Setup Frontend (Nginx)
# ============================================
# Copy built frontend to nginx
COPY --from=frontend-builder /app/frontend/dist /var/www/html

# Configure nginx
COPY frontend/nginx.conf /etc/nginx/sites-available/default

# Update nginx config to also proxy API requests
RUN cat > /etc/nginx/sites-available/default << 'EOF'
server {
    listen 80;
    server_name localhost;
    root /var/www/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # SPA routing - serve index.html for all other routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

# ============================================
# Setup Supervisord
# ============================================
RUN mkdir -p /var/log/supervisor

COPY <<'EOF' /etc/supervisor/conf.d/supervisord.conf
[supervisord]
nodaemon=true
logfile=/var/log/supervisor/supervisord.log
pidfile=/var/run/supervisord.pid
user=root

[program:postgresql]
command=/usr/lib/postgresql/14/bin/postgres -D /var/lib/postgresql/14/main -c config_file=/etc/postgresql/14/main/postgresql.conf
user=postgres
autostart=true
autorestart=true
priority=1
stdout_logfile=/var/log/supervisor/postgresql.log
stderr_logfile=/var/log/supervisor/postgresql_err.log

[program:backend]
command=node /app/backend/dist/index.js
directory=/app/backend
environment=NODE_ENV="production",PORT="3001",DATABASE_URL="postgresql://journal_user:journal_pass_2024@localhost:5432/journal_recommender"
autostart=true
autorestart=true
priority=2
startsecs=5
stdout_logfile=/var/log/supervisor/backend.log
stderr_logfile=/var/log/supervisor/backend_err.log

[program:nginx]
command=/usr/sbin/nginx -g "daemon off;"
autostart=true
autorestart=true
priority=3
stdout_logfile=/var/log/supervisor/nginx.log
stderr_logfile=/var/log/supervisor/nginx_err.log
EOF

# ============================================
# Configure PostgreSQL to accept local connections
# ============================================
RUN echo "host all all 127.0.0.1/32 md5" >> /etc/postgresql/14/main/pg_hba.conf && \
    echo "listen_addresses = 'localhost'" >> /etc/postgresql/14/main/postgresql.conf

# ============================================
# Startup script
# ============================================
COPY <<'EOF' /start.sh
#!/bin/bash
set -e

# Initialize database if needed
if [ ! -f /var/lib/postgresql/14/main/initialized ]; then
    echo "Initializing database..."
    service postgresql start
    sleep 3

    # Run init script
    if [ -f /docker-entrypoint-initdb.d/init.sql ]; then
        su - postgres -c "psql -d journal_recommender -f /docker-entrypoint-initdb.d/init.sql" || true
    fi

    # Seed database if data exists
    if [ -d /app/data ]; then
        cd /app/backend
        DATABASE_URL="postgresql://journal_user:journal_pass_2024@localhost:5432/journal_recommender" \
        node -e "
          const { seedDatabase } = require('./dist/scripts/seedDatabase.js');
          seedDatabase().catch(console.error);
        " 2>/dev/null || echo "Seeding skipped or failed"
    fi

    touch /var/lib/postgresql/14/main/initialized
    service postgresql stop
fi

# Start all services via supervisord
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
EOF

RUN chmod +x /start.sh

# Expose ports
EXPOSE 80 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost/health && curl -f http://localhost:3001/api/health || exit 1

# Start
CMD ["/start.sh"]
