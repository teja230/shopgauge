# StoreSight - Shopify Analytics Dashboard

StoreSight is a modern analytics dashboard for Shopify stores that provides real-time insights, competitor tracking, and
automated reporting.

## Features

### Core Features

- Real-time revenue tracking
- Order analytics and trends
- Product performance metrics
- Inventory management
- Sales funnel visualization
- Abandoned cart tracking
- Automated reporting

### Premium Features

- Competitor price tracking
- Market trend analysis
- Advanced inventory forecasting
- Custom report scheduling
- Email/Slack/SMS alerts
- API access for custom integrations

## Pricing

### Pro Tier ($9.99/month)

- Real-time revenue tracking
- Order analytics and trends
- Product performance metrics
- Inventory management
- Sales funnel visualization
- Abandoned cart tracking
- Automated reporting
- Competitor price tracking
- Market trend analysis
- Advanced inventory forecasting
- Custom report scheduling
- Email/Slack/SMS alerts
- API access for custom integrations
- Priority support

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   # Backend
   cd backend
   ./mvnw clean install

   # Frontend
   cd frontend
   npm install
   ```
3. Configure environment variables:
   ```bash
   # Backend
   cp backend/src/main/resources/application.example.properties backend/src/main/resources/application.properties
   
   # Frontend
   cp frontend/.env.example frontend/.env
   ```
4. Start the development servers:
   ```bash
   # Backend
   cd backend
   ./mvnw spring-boot:run

   # Frontend
   cd frontend
   npm run dev
   ```

## Technology Stack

- Frontend: React, TypeScript, Material-UI
- Backend: Spring Boot, Java
- Database: PostgreSQL
- Authentication: OAuth 2.0
- API: RESTful

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email support@storesight.com or join our Slack channel.

## Analytics & Automation

- **Revenue & Orders**: Time series, metrics, and CSV export
- **Product Analytics**: Top products, low inventory, new products
- **Cohort/Funnel**: Retention and funnel drop-off analysis (Pro/Enterprise)
- **Event-driven Automations**: Alerts for price changes, low inventory, sales milestones, new products
- **Export/Reporting**: Download CSV, schedule email reports (Pro/Enterprise)

## API Endpoints

- `/api/insights` — Actionable metrics for the dashboard
- `/api/competitors` — Competitor URLs and price data
- `/api/analytics/revenue`, `/api/analytics/orders` — Revenue and order analytics
- `/api/analytics/products` — Top products by sales
- `/api/analytics/abandoned_carts` — Abandoned cart count
- `/api/analytics/new_products` — New products in last 30 days
- `/api/analytics/inventory/low` — Low inventory products
- `/api/analytics/revenue/timeseries`, `/api/analytics/orders/timeseries` — Time series data for charts
- `/api/analytics/export/csv` — Download analytics as CSV
- `/api/analytics/report/schedule` — Get/set scheduled report frequency
- `/api/analytics/cohort` — Cohort retention analysis
- `/api/notifications/settings` — Get/set notification preferences (email, Slack, SMS)
- `/api/notifications/test` — Trigger test notifications

---

For setup and deployment, see the documentation in each subdirectory.
