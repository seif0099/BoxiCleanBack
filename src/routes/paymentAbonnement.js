const express = require("express");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const Abonnement = require("../models/Abonnement");
const router = express.Router();

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid token" });
  }
};

// Helper function to activate subscription (idempotent)
const activateSubscription = async (sessionId, userId) => {
  try {
    // Find the subscription by session ID
    const subscription = await Abonnement.findOne({
      where: {
        stripe_session_id: sessionId,
        utilisateur_id: userId,
      },
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // If already active, return success (idempotent)
    if (subscription.statut === "actif") {
      return {
        success: true,
        message: "Subscription already active",
        subscription,
      };
    }

    // Start transaction to avoid race conditions
    const { Sequelize } = require("sequelize");
    const sequelize = subscription.sequelize;

    await sequelize.transaction(async (t) => {
      // Deactivate other active subscriptions for this user
      await Abonnement.update(
        { statut: "inactif" },
        {
          where: {
            utilisateur_id: userId,
            statut: "actif",
          },
          transaction: t,
        }
      );

      // Activate this subscription
      await subscription.update({ statut: "actif" }, { transaction: t });
    });

    return { success: true, message: "Subscription activated", subscription };
  } catch (error) {
    console.error("Error activating subscription:", error);
    throw error;
  }
};

// ✅ Create Stripe checkout session
router.post("/create-checkout-session", authenticateToken, async (req, res) => {
  const { type_abonnement, montant, date_fin } = req.body;

  if (!type_abonnement || !montant || !date_fin) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const utilisateur_id = req.user.id;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Abonnement ${type_abonnement}`,
              description: `Formule ${type_abonnement} pour 1 mois`,
            },
            unit_amount: Math.round(montant * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url:
        "http://localhost:5173/abonnement-success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "http://localhost:5173/abonnement-cancel",
      metadata: {
        utilisateur_id,
        type_abonnement,
        montant,
        date_fin,
      },
    });

    // Store pending subscription
    await Abonnement.create({
      utilisateur_id,
      type_abonnement,
      montant,
      date_fin,
      statut: "en_attente",
      stripe_session_id: session.id,
    });

    res.json({ id: session.id });
  } catch (err) {
    console.error("Stripe error:", err.message);
    res.status(500).json({ error: "Failed to create session" });
  }
});

// ✅ Stripe webhook (PRIMARY activation method)
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error("Webhook error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const { utilisateur_id } = session.metadata;

      try {
        await activateSubscription(session.id, utilisateur_id);
        console.log(
          "✅ Subscription activated via webhook for:",
          utilisateur_id
        );
      } catch (error) {
        console.error("❌ Webhook processing failed:", error.message);
      }
    }

    res.json({ received: true });
  }
);

// ✅ Verify subscription status (FALLBACK method with polling)
router.post("/verify-abonnement", authenticateToken, async (req, res) => {
  const { session_id } = req.body;
  const maxRetries = 10;
  const retryDelay = 1000; // 1 second

  const pollForActivation = async (attempt = 1) => {
    try {
      // Check Stripe session status
      const session = await stripe.checkout.sessions.retrieve(session_id);

      if (session.payment_status !== "paid") {
        return {
          success: false,
          message: "Payment not confirmed",
          needsRetry: attempt < maxRetries,
        };
      }

      // Check if subscription is already activated
      const subscription = await Abonnement.findOne({
        where: {
          stripe_session_id: session_id,
          utilisateur_id: req.user.id,
        },
      });

      if (!subscription) {
        return {
          success: false,
          message: "Subscription not found",
          needsRetry: attempt < maxRetries,
        };
      }

      if (subscription.statut === "actif") {
        return {
          success: true,
          message: "Subscription already active",
          subscription,
        };
      }

      // If webhook hasn't processed yet, try to activate
      if (subscription.statut === "en_attente") {
        try {
          const result = await activateSubscription(session_id, req.user.id);
          return result;
        } catch (error) {
          console.error("Manual activation failed:", error);
          return {
            success: false,
            message: "Activation failed",
            needsRetry: attempt < maxRetries,
          };
        }
      }

      return {
        success: false,
        message: "Subscription in invalid state",
        needsRetry: false,
      };
    } catch (error) {
      console.error(`Verification attempt ${attempt} failed:`, error);
      return {
        success: false,
        message: error.message,
        needsRetry: attempt < maxRetries,
      };
    }
  };

  // Poll with exponential backoff
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await pollForActivation(attempt);

    if (result.success) {
      return res.json(result);
    }

    if (!result.needsRetry) {
      return res.status(400).json(result);
    }

    // Wait before next attempt (exponential backoff)
    if (attempt < maxRetries) {
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1))
      );
    }
  }

  // All attempts failed
  res.status(500).json({
    success: false,
    message:
      "Verification failed after multiple attempts. Please contact support.",
  });
});

module.exports = router;
