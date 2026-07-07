import { describe, it, expect } from 'vitest';
import { detectQuestionIntent } from '../questionIntent';

describe('detectQuestionIntent', () => {
  it('detects competitor comparison questions', () => {
    const result = detectQuestionIntent('How do I compare to competitors?');
    expect(result.intent).toBe('competitors');
    expect(result.dataTypes).toContain('competitors');
  });

  it('detects overpricing questions as competitor intent', () => {
    const result = detectQuestionIntent('Am I overpriced?');
    expect(result.intent).toBe('competitors');
    expect(result.dataTypes).toContain('competitors');
  });

  it('detects competitor stock questions', () => {
    const result = detectQuestionIntent('Who is out of stock right now?');
    expect(result.intent).toBe('competitors');
  });

  it('detects pricing strategy questions as competitor intent', () => {
    const result = detectQuestionIntent('What pricing strategy should I use?');
    expect(result.intent).toBe('competitors');
  });

  it('detects market questions as competitor intent', () => {
    expect(detectQuestionIntent('What is my market position?').intent).toBe('competitors');
  });

  it('detects revenue and trend questions', () => {
    expect(detectQuestionIntent('How is my revenue trending this week?').intent).toBe('revenue');
    expect(detectQuestionIntent('Show me my sales growth').intent).toBe('revenue');
    expect(detectQuestionIntent('How is my performance?').intent).toBe('revenue');
  });

  it('detects product questions', () => {
    const result = detectQuestionIntent('Which products need restocking?');
    expect(result.intent).toBe('products');
    expect(result.dataTypes).toContain('products');
  });

  it('detects order questions', () => {
    expect(detectQuestionIntent('How many abandoned carts do I have?').intent).toBe('orders');
    expect(detectQuestionIntent('What is my checkout conversion?').intent).toBe('orders');
  });

  it('detects cost questions and includes competitor context for monitoring spend', () => {
    const result = detectQuestionIntent('How much am I spending on my monitoring budget?');
    expect(result.intent).toBe('costs');
    expect(result.dataTypes).toContain('costs');
    expect(result.dataTypes).toContain('competitors');
  });

  it('detects recommendation questions and pulls all data types', () => {
    const result = detectQuestionIntent('What should I do next?');
    expect(result.intent).toBe('recommendations');
    expect(result.dataTypes).toEqual(
      expect.arrayContaining(['revenue', 'products', 'orders', 'competitors', 'costs'])
    );
  });

  it('falls back to summary for unmatched questions', () => {
    const result = detectQuestionIntent('Tell me about my business');
    expect(result.intent).toBe('summary');
    expect(result.dataTypes).toHaveLength(5);
  });
});
