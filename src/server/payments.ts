/**
 * Payment, behind one interface.
 *
 * Nothing real is charged yet: `mock` approves everything so the whole flow can
 * be exercised end to end. The shape is deliberately Stripe's — the venue is in
 * Miami, so Stripe is the target, and it is the only major processor where the
 * Apple Pay and Google Pay tabs in the design work without compromise.
 *
 * To go live: implement `stripeProvider` below, set STRIPE_SECRET_KEY, and move
 * card entry to Stripe Elements so the card number never touches our server.
 * Today the card fields are display-only — they are never sent anywhere and
 * never stored.
 */

export type PayMethod = "card" | "apple" | "google";

export interface PaymentIntent {
  id: string;
  status: "succeeded" | "requires_action" | "failed";
  clientSecret?: string;
  error?: string;
}

export interface CreateIntentInput {
  /** Cents. */
  amount: number;
  currency: string;
  method: PayMethod;
  metadata: Record<string, string>;
}

export interface PaymentProvider {
  name: string;
  createIntent(input: CreateIntentInput): Promise<PaymentIntent>;
}

const mockProvider: PaymentProvider = {
  name: "mock",
  async createIntent({ amount }) {
    if (amount <= 0) {
      return { id: "", status: "failed", error: "Nothing to charge." };
    }
    return {
      id: `mock_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      status: "succeeded",
    };
  },
};

const stripeProvider: PaymentProvider = {
  name: "stripe",
  async createIntent() {
    throw new Error(
      "Stripe is selected but not implemented yet. Install `stripe`, create a " +
        "PaymentIntent here, and confirm it client-side with Stripe Elements.",
    );
  },
};

export function paymentProvider(): PaymentProvider {
  return process.env.STRIPE_SECRET_KEY ? stripeProvider : mockProvider;
}
