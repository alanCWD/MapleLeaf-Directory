import { getUncachableStripeClient } from '../server/stripeClient.ts';

async function seedSovereignPlan() {
  try {
    const stripe = await getUncachableStripeClient();

    console.log('Checking for existing Sovereign Site product...');
    const existing = await stripe.products.search({
      query: "name:'Sovereign Site' AND active:'true'",
    });

    if (existing.data.length > 0) {
      console.log('Sovereign Site product already exists:', existing.data[0].id);
      const prices = await stripe.prices.list({ product: existing.data[0].id, active: true, limit: 10 });
      console.log('Prices:', prices.data.map(p => `${p.id} — $${(p.unit_amount || 0) / 100}/${(p.recurring as any)?.interval}`));
      return;
    }

    console.log('Creating Sovereign Site product...');
    const product = await stripe.products.create({
      name: 'Sovereign Site',
      description: 'Branded sovereign microsite on your own custom domain with full colour, font, and content control.',
    });
    console.log('Created product:', product.id);

    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 2900,
      currency: 'cad',
      recurring: { interval: 'month' },
    });
    console.log('Created monthly price:', monthlyPrice.id, '— $29.00 CAD/month');

    console.log('Done! Sovereign Site plan ready.');
  } catch (err: any) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

seedSovereignPlan();
