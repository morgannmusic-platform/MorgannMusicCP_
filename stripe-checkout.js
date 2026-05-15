const express = require("express");
const Stripe = require("stripe");
const router = express.Router();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_xxx"); // Remplace par ta clé prod

router.post("/create-checkout-session", async (req, res) => {
  try {
    const { priceId } = req.body;
    if (!priceId) return res.status(400).json({ error: "priceId manquant" });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: "https://mm-cp.uk/dash/?checkout=success",
      cancel_url: "https://mm-cp.uk/dash/?checkout=cancel",
    });
    return res.json({ url: session.url });
  } catch (e) {
    console.error("Stripe error:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
