# UCP Grafana Dashboard

Pre-built Grafana dashboard for monitoring UCP (Universal Communication Platform).

## Quick Start

### 1. Import the Dashboard

1. Open Grafana
2. Go to **Dashboards** → **New** → **Import**
3. Upload `ucp-dashboard.json` (or paste the JSON)
4. Select your Prometheus datasource
5. Click **Import**

### 2. Configure Prometheus

Add this scrape config to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'ucp-platform'
    scrape_interval: 30s
    metrics_path: /api/metrics
    static_configs:
      - targets: ['your-app.vercel.app']
    # Optional: add auth header if you protected /api/metrics
    # bearer_token: 'your-internal-api-token'
```

For local development:

```yaml
scrape_configs:
  - job_name: 'ucp-platform-local'
    scrape_interval: 30s
    metrics_path: /api/metrics
    static_configs:
      - targets: ['localhost:3000']
```

### 3. View the Dashboard

The dashboard includes:

- **Top row**: Key stats (notifications sent, realtime connections, gateway health, pending)
- **Middle row**: Time series (notifications by status) + Pie chart (by channel)
- **Stats row**: End users, devices, API keys, projects, online users, scheduled
- **Bottom**: Events by source (stacked bars)

## Metrics Reference

| Metric | Type | Description |
|--------|------|-------------|
| `ucp_notifications_total` | counter | Total notifications by status and channel |
| `ucp_notifications_pending` | gauge | Currently pending notifications |
| `ucp_notifications_scheduled` | gauge | Scheduled notifications awaiting delivery |
| `ucp_api_keys_total` | gauge | Total API keys by status |
| `ucp_end_users_total` | gauge | Total end users |
| `ucp_devices_total` | gauge | Total devices by platform and status |
| `ucp_projects_total` | gauge | Total projects by status |
| `ucp_tenants_total` | gauge | Total tenants by status |
| `ucp_events_total` | counter | Total events by source |
| `ucp_realtime_connections` | gauge | Active Socket.io connections |
| `ucp_realtime_presence` | gauge | Online users |
| `ucp_realtime_gateway_up` | gauge | Gateway health (1=up, 0=down) |
| `ucp_build_info` | gauge | Build information (version, node_env) |

## Alerting

You can set up alerts in Grafana based on these metrics. Examples:

- **Gateway down**: `ucp_realtime_gateway_up == 0` for 2 minutes
- **High failure rate**: `rate(ucp_notifications_total{status="failed"}[5m]) > 0.1`
- **Pending backlog**: `ucp_notifications_pending > 100`
- **No realtime connections**: `ucp_realtime_connections == 0` during business hours

## Docker Compose for Monitoring

To run Prometheus + Grafana locally:

```yaml
# monitoring-compose.yml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:latest
    ports: ['9090:9090']
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
  
  grafana:
    image: grafana/grafana:latest
    ports: ['3001:3000']
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - ./ucp-dashboard.json:/etc/grafana/provisioning/dashboards/ucp-dashboard.json
```
