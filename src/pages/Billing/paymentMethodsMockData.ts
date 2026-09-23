import { PaymentMethodItem } from "./paymentMethodTypes";

export function getInitialDemoPaymentMethods(): PaymentMethodItem[] {
  return [
    {
      id: "pm-001",
      brand: "visa",
      brandLabel: "Visa",
      last4: "4242",
      maskedNumber: "•••• •••• •••• 4242",
      expiryMonth: "12",
      expiryYear: "2028",
      expiryFormatted: "12/28",
      isDefault: true,
      createdAt: "15 Jan 2025"
    },
    {
      id: "pm-002",
      brand: "mastercard",
      brandLabel: "Mastercard",
      last4: "8821",
      maskedNumber: "•••• •••• •••• 8821",
      expiryMonth: "09",
      expiryYear: "2027",
      expiryFormatted: "09/27",
      isDefault: false,
      createdAt: "04 May 2025"
    },
    {
      id: "pm-003",
      brand: "amex",
      brandLabel: "American Express",
      last4: "1005",
      maskedNumber: "•••• •••••• •1005",
      expiryMonth: "04",
      expiryYear: "2029",
      expiryFormatted: "04/29",
      isDefault: false,
      createdAt: "10 Dec 2025"
    }
  ];
}
