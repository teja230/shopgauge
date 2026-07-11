import {
  BellRing,
  ChartNoAxesCombined,
  CircleGauge,
  History,
  PackageSearch,
  ShieldCheck,
  Store,
  Target,
} from 'lucide-react';

export const features = [
  'Track competitor prices and stock status from one workspace',
  'Associate each competitor listing with the matching Shopify product',
  'Review price history before changing a product price',
  'Receive alerts when a monitored price or stock status changes',
  'Discover possible competitors and approve matches before tracking them',
  'See whether each product is priced below, near, or above monitored listings',
  'Export operational charts and price-history data',
  'Keep each connected Shopify store and session isolated',
  'Use a demo workspace before connecting a store',
];

export const featureCategories = [
  {
    icon: PackageSearch,
    title: 'Competitor matching',
    accent: '#2f5bea',
    tint: '#e7ecff',
    items: [
      'Connect monitored listings to the correct Shopify product',
      'Review discovered suggestions before adding them',
      'Keep unmatched URLs visible for follow-up',
    ],
  },
  {
    icon: CircleGauge,
    title: 'Market position',
    accent: '#15b87a',
    tint: '#dff8ea',
    items: [
      'Compare your price with the latest verified competitor price',
      'Spot products that have moved out of their intended price position',
      'Review price and stock freshness before acting',
    ],
  },
  {
    icon: BellRing,
    title: 'Actionable alerts',
    accent: '#f59e0b',
    tint: '#fff1cf',
    items: [
      'Surface meaningful price and availability changes',
      'Prioritize products that need a merchandising decision',
      'Keep a notification history for the connected store',
    ],
  },
  {
    icon: History,
    title: 'Price history',
    accent: '#f9734d',
    tint: '#ffe4d8',
    items: [
      'Inspect historical competitor prices before reacting',
      'Distinguish current values from older out-of-stock prices',
      'Export evidence for merchandising reviews',
    ],
  },
  {
    icon: ChartNoAxesCombined,
    title: 'Store context',
    accent: '#2f5bea',
    tint: '#e7ecff',
    items: [
      'View Shopify product, order, inventory, and revenue context',
      'Use descriptive trends without presenting them as guaranteed forecasts',
      'Move from a signal to the relevant Shopify admin record',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Privacy controls',
    accent: '#101820',
    tint: '#eef1f4',
    items: [
      'Minimize stored Shopify data',
      'Support merchant export and deletion requests',
      'Record security- and privacy-relevant actions',
    ],
  },
];

export const productPrinciples = [
  {
    quote:
      'Every monitored value should show when it was checked and whether the result is reliable enough to use.',
    name: 'Freshness before urgency',
    stat: 'Product principle',
  },
  {
    quote:
      'Competitor suggestions remain suggestions until a merchant confirms that the products actually match.',
    name: 'Merchant-controlled matching',
    stat: 'Product principle',
  },
  {
    quote:
      'The useful outcome is a pricing decision, not another dashboard metric or an unverified AI claim.',
    name: 'Decisions over decoration',
    stat: 'Product principle',
  },
];

export const productStats = [
  {
    value: '10',
    label: 'monitored listings',
    description: 'current per-store application limit',
    icon: Store,
  },
  {
    value: '24h',
    label: 'freshness target',
    description: 'for scheduled competitor checks',
    icon: Target,
  },
  {
    value: '0',
    label: 'automatic charges',
    description: 'pricing is being validated; billing is not active',
    icon: ShieldCheck,
  },
];

export const faqs = [
  {
    question: 'What does ShopGauge do today?',
    answer:
      'ShopGauge connects Shopify product context with monitored competitor listings, price history, stock status, and change alerts. Discovery results require merchant review before they become tracked competitors.',
  },
  {
    question: 'Does ShopGauge automatically change my Shopify prices?',
    answer:
      'No. The current product supports monitoring and decision support. Automatic repricing will only be introduced with explicit merchant rules, margin guardrails, approvals, and audit history.',
  },
  {
    question: 'Are the trend lines guaranteed forecasts?',
    answer:
      'No. Current projections are experimental planning aids based on recent store history. They are not machine-learning forecasts, guarantees, or calibrated confidence probabilities.',
  },
  {
    question: 'Is billing active?',
    answer:
      'No. ShopGauge is validating monitoring limits and willingness to pay. Selecting a preferred plan records anonymous product interest and does not create a charge or subscription.',
  },
  {
    question: 'How is Shopify data handled?',
    answer:
      'The application limits Shopify access to the scopes needed for its features, isolates connected stores, and provides merchant export and deletion workflows. Shopify compliance webhook requests are verified before processing.',
  },
  {
    question: 'Can every website be monitored reliably?',
    answer:
      'No. Retail sites change frequently and some block automated requests. ShopGauge reports freshness and failures so an unavailable or stale value is not presented as a verified current price.',
  },
];
