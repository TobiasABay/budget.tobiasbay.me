// Currency utility functions

export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

export const CURRENCIES: Currency[] = [
  { code: 'NONE', symbol: '', name: 'No Currency' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
];

const CURRENCY_STORAGE_KEY = 'budget_currency';

export function getDefaultCurrency(): Currency {
  return CURRENCIES[0]; // USD by default
}

export function getStoredCurrency(): Currency {
  if (typeof window === 'undefined') {
    return getDefaultCurrency();
  }

  const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
  if (!stored) {
    return getDefaultCurrency();
  }

  const currency = CURRENCIES.find(c => c.code === stored);
  if (currency) {
    return currency;
  }

  // If stored value is 'NONE' but not in CURRENCIES (shouldn't happen), return NONE currency
  if (stored === 'NONE') {
    return { code: 'NONE', symbol: '', name: 'No Currency' };
  }

  return getDefaultCurrency();
}

export function setStoredCurrency(currencyCode: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const currency = CURRENCIES.find(c => c.code === currencyCode);
  if (currency || currencyCode === 'NONE') {
    localStorage.setItem(CURRENCY_STORAGE_KEY, currencyCode);
  }
}

export function formatCurrency(amount: number, currency: Currency): string {
  if (amount === 0) {
    return '';
  }

  // Check if the number is a whole number (no decimal part)
  const isWholeNumber = amount % 1 === 0;

  // For no currency, show number without decimals if it's a whole number
  if (currency.code === 'NONE') {
    return isWholeNumber ? amount.toString() : amount.toFixed(2);
  }

  // For JPY, don't show decimals
  if (currency.code === 'JPY') {
    return `${currency.symbol}${Math.round(amount).toLocaleString()}`;
  }

  // For other currencies, show without decimals if whole number, otherwise 2 decimal places
  if (isWholeNumber) {
    return `${currency.symbol}${Math.round(amount).toLocaleString()}`;
  }
  return `${currency.symbol}${amount.toFixed(2)}`;
}
