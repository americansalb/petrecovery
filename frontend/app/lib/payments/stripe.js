/**
 * Stripe Payment Integration
 *
 * Handles donations, reward escrow, and subscriptions
 */

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

let stripe = null;
let stripeLoadAttempted = false;

async function getStripe() {
  if (stripe) return stripe;
  if (stripeLoadAttempted) return null;

  if (!STRIPE_SECRET_KEY) {
    stripeLoadAttempted = true;
    return null;
  }

  try {
    const stripeModule = await import(/* webpackIgnore: true */ 'stripe').catch(() => null);
    if (stripeModule) {
      const Stripe = stripeModule.default;
      stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    }
  } catch (e) {
    console.warn('Stripe module not available:', e.message);
  }

  stripeLoadAttempted = true;
  return stripe;
}

/**
 * Create a donation checkout session
 */
export async function createDonationSession(options) {
  const { amount, missionId, caseName, donorEmail, successUrl, cancelUrl } = options;
  const stripeClient = await getStripe();

  if (!stripeClient) {
    throw new Error('Stripe not configured');
  }

  const session = await stripeClient.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: donorEmail,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: missionId ? `Donation for ${caseName}'s Search` : 'PetRecovery Donation',
            description: missionId
              ? 'Support the search effort'
              : 'Support PetRecovery.org operations',
          },
          unit_amount: Math.round(amount * 100), // Stripe uses cents
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: 'donation',
      missionId: missionId || '',
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return {
    sessionId: session.id,
    url: session.url,
  };
}

/**
 * Create reward escrow (hold funds until reunion)
 */
export async function createRewardEscrow(options) {
  const { amount, missionId, caseName, ownerEmail, successUrl, cancelUrl } = options;
  const stripeClient = await getStripe();

  if (!stripeClient) {
    throw new Error('Stripe not configured');
  }

  // Create a payment intent with capture_method: manual for escrow
  const session = await stripeClient.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: ownerEmail,
    payment_intent_data: {
      capture_method: 'manual', // Authorization only, capture later
      metadata: {
        type: 'reward_escrow',
        missionId,
      },
    },
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Reward for Finding ${caseName}`,
            description: 'Funds held in escrow until pet is found. Fully refundable if case closes without reunion.',
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: 'reward_escrow',
      missionId,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return {
    sessionId: session.id,
    url: session.url,
  };
}

/**
 * Capture escrow funds (when pet is found)
 */
export async function captureEscrow(paymentIntentId) {
  const stripeClient = await getStripe();

  if (!stripeClient) {
    throw new Error('Stripe not configured');
  }

  const paymentIntent = await stripeClient.paymentIntents.capture(paymentIntentId);

  return {
    success: paymentIntent.status === 'succeeded',
    amount: paymentIntent.amount / 100,
  };
}

/**
 * Release escrow (refund if case closes without finding pet)
 */
export async function releaseEscrow(paymentIntentId) {
  const stripeClient = await getStripe();

  if (!stripeClient) {
    throw new Error('Stripe not configured');
  }

  // Cancel the uncaptured payment intent
  const paymentIntent = await stripeClient.paymentIntents.cancel(paymentIntentId);

  return {
    success: paymentIntent.status === 'canceled',
  };
}

/**
 * Create subscription checkout session
 */
export async function createSubscriptionSession(options) {
  const { priceId, customerEmail, userId, successUrl, cancelUrl } = options;
  const stripeClient = await getStripe();

  if (!stripeClient) {
    throw new Error('Stripe not configured');
  }

  const session = await stripeClient.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'subscription',
    customer_email: customerEmail,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: {
      type: 'subscription',
      userId,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: {
        userId,
      },
    },
  });

  return {
    sessionId: session.id,
    url: session.url,
  };
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(subscriptionId) {
  const stripeClient = await getStripe();

  if (!stripeClient) {
    throw new Error('Stripe not configured');
  }

  const subscription = await stripeClient.subscriptions.cancel(subscriptionId);

  return {
    success: subscription.status === 'canceled',
  };
}

/**
 * Get subscription status
 */
export async function getSubscription(subscriptionId) {
  const stripeClient = await getStripe();

  if (!stripeClient) {
    throw new Error('Stripe not configured');
  }

  const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);

  return {
    id: subscription.id,
    status: subscription.status,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}

/**
 * Create payout to finder (Stripe Connect)
 */
export async function createPayout(options) {
  const { amount, recipientAccountId, missionId, description } = options;
  const stripeClient = await getStripe();

  if (!stripeClient) {
    throw new Error('Stripe not configured');
  }

  const transfer = await stripeClient.transfers.create({
    amount: Math.round(amount * 100),
    currency: 'usd',
    destination: recipientAccountId,
    description: description || `Reward payout for case ${missionId}`,
    metadata: {
      missionId,
      type: 'reward_payout',
    },
  });

  return {
    transferId: transfer.id,
    amount: transfer.amount / 100,
  };
}

/**
 * Create Stripe Connect account for reward recipient
 */
export async function createConnectAccount(options) {
  const { email, userId } = options;
  const stripeClient = await getStripe();

  if (!stripeClient) {
    throw new Error('Stripe not configured');
  }

  const account = await stripeClient.accounts.create({
    type: 'express',
    email,
    metadata: {
      userId,
    },
    capabilities: {
      transfers: { requested: true },
    },
  });

  return {
    accountId: account.id,
  };
}

/**
 * Create account link for Connect onboarding
 */
export async function createAccountLink(accountId, refreshUrl, returnUrl) {
  const stripeClient = await getStripe();

  if (!stripeClient) {
    throw new Error('Stripe not configured');
  }

  const accountLink = await stripeClient.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });

  return {
    url: accountLink.url,
  };
}

/**
 * Verify webhook signature
 */
export async function verifyWebhook(payload, signature) {
  const stripeClient = await getStripe();

  if (!stripeClient || !STRIPE_WEBHOOK_SECRET) {
    throw new Error('Stripe webhook not configured');
  }

  return stripeClient.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
}

/**
 * Subscription tiers
 */
export const SUBSCRIPTION_TIERS = {
  FREE: {
    name: 'Free',
    price: 0,
    features: [
      'Report lost/found pets',
      'Basic search tools',
      'Join rescue forces',
      'Community access',
    ],
  },
  SUPPORTER: {
    name: 'Supporter',
    priceId: process.env.STRIPE_SUPPORTER_PRICE_ID,
    price: 5,
    features: [
      'All Free features',
      'Priority case visibility',
      'Advanced analytics',
      'Ad-free experience',
      'Support badge',
    ],
  },
  PRO: {
    name: 'Pro Rescue Force',
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    price: 15,
    features: [
      'All Supporter features',
      'Rescue Force management tools',
      'Shelter API access',
      'Advanced mapping',
      'Priority support',
      'Custom integrations',
    ],
  },
};
