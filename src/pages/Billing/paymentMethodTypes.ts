export type CardBrand = "visa" | "mastercard" | "amex" | "discover";

export interface PaymentMethodItem {
  id: string;
  brand: CardBrand;
  brandLabel: string;
  last4: string;
  maskedNumber: string;
  expiryMonth: string;
  expiryYear: string;
  expiryFormatted: string;
  isDefault: boolean;
  createdAt: string;
}
