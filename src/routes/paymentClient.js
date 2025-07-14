const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const Service = require("../models/Service");
const Reservation = require("../models/Reservation");

const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid token" });
  }
};

// Helper function to check if a string is a valid UUID
const isValidUUID = (str) => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// Create Stripe checkout session
router.post("/create-checkout-session", authenticateToken, async (req, res) => {
  const { service_id, date, heure } = req.body;

  try {
    // Validate input
    if (!service_id || !date || !heure) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const client_id = req.user.id;

    // Get service info
    const service = await Service.findByPk(service_id);
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    console.log("📄 Creating session for:", {
      client_id,
      service_id,
      service_name: service.nom_service,
      price: service.prix_base,
      date,
      heure,
      prestataire_id: service.prestataire_id, // ✅ Log prestataire_id
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: service.nom_service,
              description: service.description,
            },
            unit_amount: Math.round(service.prix_base * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      // In your backend payment router
      success_url: `${
        process.env.CLIENT_URL || "http://localhost:5173"
      }/reservation-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${
        process.env.CLIENT_URL || "http://localhost:5173"
      }/reservation-cancel`,
      metadata: {
        client_id: client_id.toString(),
        service_id: service_id.toString(),
        date,
        heure,
        prestataire_id: service.prestataire_id.toString(), // ✅ Add prestataire_id to metadata
      },
    });

    console.log("✅ Session created:", session.id);
    res.json({ id: session.id });
  } catch (error) {
    console.error("❌ Error creating checkout session:", error.message);
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
});

// Stripe webhook for post-payment reservation
router.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const endpointSecret =
      process.env.STRIPE_WEBHOOK_SECRET ||
      "whsec_2575715a8b8fe3156b58e1c8d45dd599c4601a03e3e2df97f775db9d6791cfe6";

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error("❌ Webhook verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const { client_id, service_id, date, heure, prestataire_id } =
        session.metadata; // ✅ Extract prestataire_id

      console.log("💰 Payment completed for:", {
        client_id,
        service_id,
        date,
        heure,
        prestataire_id, // ✅ Log prestataire_id
        amount: session.amount_total / 100,
      });

      try {
        // Create reservation after successful payment
        const reservation = await Reservation.create({
          client_id: client_id,
          service_id: service_id,
          date,
          heure,
          mode_paiement: "en_ligne",
          statut: "confirmée",
          prestataire_id: prestataire_id, // ✅ Include prestataire_id
        });

        console.log(
          "✅ Reservation saved after Stripe payment:",
          reservation.id
        );
      } catch (err) {
        console.error("❌ Error saving reservation:", err.message);
      }
    }

    res.status(200).json({ received: true });
  }
);

// Verify payment route with proper UUID handling
router.post("/verify-payment", authenticateToken, async (req, res) => {
  const { session_id } = req.body;

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    console.log("💳 Payment session:", {
      id: session.id,
      payment_status: session.payment_status,
      metadata: session.metadata,
    });

    if (session.payment_status === "paid") {
      const { client_id, service_id, date, heure, prestataire_id } =
        session.metadata;

      // ✅ Check for missing metadata fields
      if (!client_id || !service_id || !date || !heure) {
        return res.status(400).json({
          success: false,
          message: "❌ Missing metadata from Stripe session",
          metadata: session.metadata,
        });
      }

      console.log("🔍 Processing payment verification:", {
        client_id,
        service_id,
        date,
        heure,
        prestataire_id,
        client_id_type: typeof client_id,
        service_id_type: typeof service_id,
      });

      // 🔎 Check if reservation already exists
      const existingReservation = await Reservation.findOne({
        where: {
          client_id,
          service_id,
          date,
          heure,
          mode_paiement: "en_ligne",
        },
      });

      if (existingReservation) {
        console.log("✅ Reservation already exists:", existingReservation.id);
        return res.json({
          success: true,
          message: "Reservation already exists",
          reservation: existingReservation,
        });
      }

      // 💾 Create new reservation
      const reservation = await Reservation.create({
        client_id,
        service_id,
        date,
        heure,
        mode_paiement: "en_ligne",
        statut: "confirmée",
        prestataire_id,
      });

      console.log("✅ Reservation created:", reservation.toJSON());

      res.json({
        success: true,
        message: "Reservation created successfully",
        reservation,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Payment not completed",
      });
    }
  } catch (error) {
    console.error("❌ Error verifying payment:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying payment",
      error: error.message,
    });
  }
});

// Debug route to check data types and database schema
router.post("/debug-payment", authenticateToken, async (req, res) => {
  const { session_id } = req.body;

  try {
    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);

    console.log("🔍 Session metadata:", session.metadata);
    console.log("🔍 User from token:", req.user);

    if (session.payment_status === "paid") {
      const { client_id, service_id, date, heure, prestataire_id } =
        session.metadata; // ✅ Extract prestataire_id

      // Debug data types
      console.log("🔍 Debug info:");
      console.log(
        "client_id:",
        client_id,
        "type:",
        typeof client_id,
        "isUUID:",
        isValidUUID(client_id)
      );
      console.log(
        "service_id:",
        service_id,
        "type:",
        typeof service_id,
        "isUUID:",
        isValidUUID(service_id)
      );
      console.log(
        "prestataire_id:",
        prestataire_id,
        "type:",
        typeof prestataire_id,
        "isUUID:",
        isValidUUID(prestataire_id)
      ); // ✅ Debug prestataire_id
      console.log("date:", date, "type:", typeof date);
      console.log("heure:", heure, "type:", typeof heure);

      // Try to find existing records to understand the format
      const sampleReservation = await Reservation.findOne({
        limit: 1,
        raw: true,
      });

      console.log("🔍 Sample reservation:", sampleReservation);

      res.json({
        success: true,
        debug: {
          metadata: session.metadata,
          dataTypes: {
            client_id: {
              value: client_id,
              type: typeof client_id,
              isUUID: isValidUUID(client_id),
            },
            service_id: {
              value: service_id,
              type: typeof service_id,
              isUUID: isValidUUID(service_id),
            },
            prestataire_id: {
              value: prestataire_id,
              type: typeof prestataire_id,
              isUUID: isValidUUID(prestataire_id),
            }, // ✅ Debug prestataire_id
          },
          sampleReservation,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Payment not completed",
      });
    }
  } catch (error) {
    console.error("Error debugging payment:", error);
    res.status(500).json({
      success: false,
      message: "Error debugging payment",
      error: error.message,
    });
  }
});
// Add this route to your payment router (before module.exports = router;)

// Get payments for a prestataire
// Get payments for a prestataire
router.get("/prestataire", authenticateToken, async (req, res) => {
  try {
    const prestataire_id = req.user.id;

    // Get all reservations for this prestataire with payment info
    const reservations = await Reservation.findAll({
      where: {
        prestataire_id,
        statut: "confirmée", // Only confirmed reservations
      },
      include: [
        {
          model: Service,
          attributes: ["nom_service", "prix_base"],
        },
        {
          model: Client, // Make sure this association exists in your models
          attributes: ["fullName", "email"],
        },
      ],
      order: [["date", "DESC"]],
    });

    // Transform reservations into payment format
    const paiements = reservations.map((reservation) => ({
      id: reservation.id,
      date: reservation.date,
      montant: reservation.Service ? reservation.Service.prix_base : 0,
      client_nom: reservation.Client
        ? reservation.Client.fullName
        : "Client inconnu",
      reservation_id: reservation.id,
      mode_paiement: reservation.mode_paiement || "en_ligne", // ✅ Use actual value from DB
      payment_mode:
        reservation.mode_paiement === "en_ligne"
          ? "stripe"
          : reservation.mode_paiement,
      statut: "payé", // Since these are confirmed reservations
      prestataire_id: reservation.prestataire_id,
    }));

    res.json(paiements);
  } catch (error) {
    console.error("Error fetching prestataire payments:", error);
    res.status(500).json({
      error: "Error fetching payments",
      details: error.message,
    });
  }
});
module.exports = router;
