// Currency formatting utilities
export const CURRENCY = 'AED';

export const formatCurrency = (amount: number): string => {
  return `${CURRENCY} ${amount.toFixed(2)}`;
};

export const parseCurrency = (value: string | number): number => {
  if (typeof value === 'number') return value;
  
  // Remove currency symbol and any non-numeric characters except decimal point
  const numericValue = value.replace(/[^0-9.]/g, '');
  return parseFloat(numericValue) || 0;
};

export const calculateDiscount = (price: number, discountPercentage: number): number => {
  const discount = (price * discountPercentage) / 100;
  return Number(discount.toFixed(2));
};

export const calculateTotal = (items: { price: number; quantity: number }[]): number => {
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  return Number(total.toFixed(2));
};
