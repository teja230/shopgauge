# StoreSight - E-commerce Analytics & Automation for Shopify

StoreSight is a modern Shopify app for actionable analytics, competitor price monitoring, and automated notifications.
Built for ambitious merchants who want to optimize, automate, and grow.

## Features

- **Real-time competitor price tracking**: Monitor competitor prices in real-time
- **Automated price change alerts**: Get instant notifications when prices change
- **Customizable dashboard**: Tailor your analytics view to your needs
- **Performance analytics**: Track your store's key metrics
- **Inventory management**: Keep track of your stock levels
- **Sales forecasting**: Predict future sales trends

## Pricing

### Basic Plan - $29/month

- Up to 5 competitors
- Basic analytics
- Email alerts
- 24/7 support

### Pro Plan - $79/month

- Up to 20 competitors
- Advanced analytics
- SMS & email alerts
- Priority support
- Custom reports

### Enterprise Plan - $199/month

- Unlimited competitors
- Enterprise analytics
- API access
- Dedicated support
- Custom integrations
- White-label reports

## Free Trial

- 3-day free trial
- Full access to all features
- No credit card required
- Cancel anytime

## Getting Started

1. Sign up for a free trial
2. Connect your Shopify store
3. Start getting insights immediately

## Requirements

- A Shopify store
- Admin access to your store
- Modern web browser

## Support

For support, please contact us at support@storesight.ai or visit our [help center](https://help.storesight.ai).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

We welcome contributions! Please see our [contributing guidelines](CONTRIBUTING.md) for more information.

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
