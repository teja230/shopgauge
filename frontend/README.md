# StoreSight Frontend

StoreSight is a modern analytics and competitor price tracking platform for Shopify merchants. Built with React,
TypeScript, and Vite, it provides real-time insights, automated alerts, and a beautiful, conversion-focused dashboard.

## Features

- Real-time competitor price tracking
- Automated price change alerts (email/SMS)
- Customizable analytics dashboard
- Inventory and sales performance analytics
- Modern, responsive UI inspired by leading SaaS tools
- Simple pricing: Pro plan at $9.99/month with all features included

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- Yarn or npm

### Installation

```bash
cd frontend
npm install
# or
yarn install
```

### Development

```bash
npm run dev
# or
yarn dev
```

The app will be available at [http://localhost:5173](http://localhost:5173).

### Build for Production

```bash
npm run build
# or
yarn build
```

## Project Structure

- `src/pages/` — Main pages (Dashboard, Competitors, Home, Profile)
- `src/components/` — UI components (cards, tables, banners)
- `src/api/` — API utilities
- `src/contexts/` — React context for authentication

## Customization

- Edit `src/pages/HomePage.tsx` for homepage/pricing changes
- Edit `src/pages/DashboardPage.tsx` for dashboard analytics UI
- Edit `src/pages/CompetitorsPage.tsx` for competitor tracking UI

## License

Apache License 2.0

---
Inspired by modern SaaS analytics tools like Heap and ZIK Analytics.
