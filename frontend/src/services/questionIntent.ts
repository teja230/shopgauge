export type QuestionIntent =
  | 'revenue'
  | 'products'
  | 'orders'
  | 'competitors'
  | 'costs'
  | 'recommendations'
  | 'summary';

export type InsightDataType = 'revenue' | 'products' | 'orders' | 'competitors' | 'costs';

export interface DetectedIntent {
  intent: QuestionIntent;
  dataTypes: InsightDataType[];
}

const ALL_DATA_TYPES: InsightDataType[] = ['revenue', 'products', 'orders', 'competitors', 'costs'];

// Ordered: the first matching rule wins. Competitor/market phrasing is checked
// before generic pricing/stock words so "who is out of stock" reads as a
// competitor question, not an inventory one.
const INTENT_RULES: Array<{ pattern: RegExp; intent: QuestionIntent; dataTypes: InsightDataType[] }> = [
  {
    pattern:
      /\b(monitoring cost|monitoring budget|cost|costs|budget|spend|spending|expense|expenses|roi|subscription)\b/,
    intent: 'costs',
    dataTypes: ['costs', 'competitors'],
  },
  {
    pattern:
      /\b(competitors?|competition|competitive|rivals?|versus|vs\.?|compare|comparison|overpriced|underpriced|undercut|cheaper than|price gap|price difference|market (?:position|share|price|prices|pricing)|pricing strateg\w*|who (?:is|'s) out of stock|out of stock)\b/,
    intent: 'competitors',
    dataTypes: ['competitors', 'products'],
  },
  {
    pattern: /\b(market|pricing|priced?|price)\b/,
    intent: 'competitors',
    dataTypes: ['competitors', 'products'],
  },
  {
    pattern: /\b(revenue|sales|sell(?:ing)?|earnings?|income|trend(?:s|ing)?|growth|growing|performance|performing)\b/,
    intent: 'revenue',
    dataTypes: ['revenue', 'orders', 'products'],
  },
  {
    pattern: /\b(products?|inventory|stock|restock|catalog|bestsellers?|items?|skus?)\b/,
    intent: 'products',
    dataTypes: ['products'],
  },
  {
    pattern: /\b(orders?|carts?|checkout|conversion|abandon\w*|fulfillment|customers?)\b/,
    intent: 'orders',
    dataTypes: ['orders', 'revenue'],
  },
  {
    pattern: /\b(recommend\w*|should|improve|optimi[sz]e|advice|suggest\w*|focus|next steps?|what to do|how (?:do|can) i)\b/,
    intent: 'recommendations',
    dataTypes: ALL_DATA_TYPES,
  },
];

/**
 * Classify a merchant question so the right data slices are pulled into the
 * prompt. Falls back to a whole-store summary when nothing specific matches.
 */
export const detectQuestionIntent = (question: string): DetectedIntent => {
  const normalized = question.toLowerCase();

  for (const rule of INTENT_RULES) {
    if (rule.pattern.test(normalized)) {
      return { intent: rule.intent, dataTypes: [...rule.dataTypes] };
    }
  }

  return { intent: 'summary', dataTypes: [...ALL_DATA_TYPES] };
};

export default detectQuestionIntent;
