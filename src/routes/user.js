const express = require("express");
const authenticate = require("../middlewares/auth");
const User = require("../models/User");
const Avis = require("../models/Avis");
const router = express.Router();
const { Op, Sequelize } = require("sequelize");
const Reservation = require("../models/Reservation");
const PDFDocument = require("pdfkit");
const Service = require("../models/Service");

// GET /me
router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password"] }, // ne pas renvoyer le mot de passe
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/classement", async (req, res) => {
  try {
    const classement = await Avis.findAll({
      attributes: [
        "prestataire_id",
        [Sequelize.fn("AVG", Sequelize.col("note")), "average_note"],
        [Sequelize.fn("COUNT", Sequelize.col("Avis.id")), "total_avis"],
      ],
      include: [
        {
          model: User,
          as: "PrestataireUser", // ✅ must match the alias from your model
          attributes: ["id", "fullName", "email"],
        },
      ],
      group: [
        "prestataire_id",
        "PrestataireUser.id",
        "PrestataireUser.fullName",
        "PrestataireUser.email",
      ],

      order: [[Sequelize.literal("average_note"), "DESC"]],
      limit: 10,
    });

    res.json(classement);
  } catch (error) {
    console.error("Erreur classement prestataires:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.get("/prestataire/:id/export-pdf", async (req, res) => {
  const { id } = req.params;
  const { type } = req.query;

  try {
    // Validate type parameter first
    if (!["reservations", "earnings", "reviews"].includes(type)) {
      return res.status(400).json({ message: "Invalid report type" });
    }

    const doc = new PDFDocument({ margin: 50 });
    let filename = `report-${type}-${Date.now()}.pdf`;

    // ✅ Set headers BEFORE piping
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // ✅ Pipe the document to response
    doc.pipe(res);

    // Helper functions remain the same
    const addHeader = (title, icon) => {
      doc
        .fontSize(24)
        .fillColor("#2c3e50")
        .text(`${icon} ${title}`, { align: "center" });

      doc
        .moveDown(0.5)
        .strokeColor("#3498db")
        .lineWidth(2)
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .stroke();

      doc.moveDown(1);
    };

    const addFooter = () => {
      doc
        .fontSize(10)
        .fillColor("#7f8c8d")
        .text(
          `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
          50,
          doc.page.height - 50,
          { align: "center" }
        );
    };

    // Get prestataire info
    const prestataire = await User.findByPk(id, {
      attributes: ["fullName", "email"],
    });

    if (!prestataire) {
      return res.status(404).json({ message: "Prestataire not found" });
    }

    if (type === "reservations") {
      const reservations = await Reservation.findAll({
        where: { prestataire_id: id },
        include: [{ model: User, as: "Client" }, { model: Service }],
        order: [["createdAt", "DESC"]],
      });

      addHeader("Reservations Report", "[RESERVATIONS]");

      doc
        .fontSize(12)
        .fillColor("#34495e")
        .text(`Prestataire: ${prestataire.fullName || "Unknown"}`, {
          align: "left",
        })
        .text(`Email: ${prestataire.email || "Unknown"}`)
        .text(`Total Reservations: ${reservations.length}`)
        .moveDown(1);

      if (reservations.length === 0) {
        doc
          .fontSize(14)
          .fillColor("#e74c3c")
          .text("No reservations found.", { align: "center" });
      } else {
        reservations.forEach((r, i) => {
          if (doc.y > 700) {
            doc.addPage();
          }

          const status = r.status || "pending";
          const statusColor =
            status === "terminee"
              ? "#27ae60"
              : status === "annulee"
              ? "#e74c3c"
              : "#f39c12";

          doc
            .fontSize(14)
            .fillColor("#2c3e50")
            .text(`#${i + 1}`, 50, doc.y, { continued: true })
            .text(` ${r.Service?.nom || "Service"} `, { continued: true })
            .fillColor("#7f8c8d")
            .fontSize(12)
            .text(
              `booked by ${r.Client?.fullName || r.Client?.nom || "Client"}`
            );

          doc
            .fillColor("#34495e")
            .text(
              `Date: ${
                r.date ? new Date(r.date).toLocaleDateString() : "Not specified"
              }`,
              70,
              doc.y
            )
            .fillColor(statusColor)
            .text(`Status: ${status}`, 70, doc.y)
            .fillColor("#3498db")
            .text(`Price: ${r.price || 0} TND`, 70, doc.y);

          doc
            .strokeColor("#ecf0f1")
            .lineWidth(1)
            .moveTo(50, doc.y + 5)
            .lineTo(550, doc.y + 5)
            .stroke();

          doc.moveDown(1);
        });
      }
    } // Fix the earnings query - change 'status' to 'statut'
    if (type === "earnings") {
      const reservations = await Reservation.findAll({
        where: {
          prestataire_id: id,
          statut: "terminee", // ✅ Changed from 'status' to 'statut'
        },
        include: [{ model: Service }],
        order: [["createdAt", "DESC"]],
      });

      let total = 0;
      addHeader("Earnings Report", "[EARNINGS]");

      doc
        .fontSize(12)
        .fillColor("#34495e")
        .text(`Prestataire: ${prestataire?.fullName || "Unknown"}`, {
          align: "left",
        })
        .text(`Email: ${prestataire?.email || "Unknown"}`)
        .text(`Completed Reservations: ${reservations.length}`)
        .moveDown(1);

      if (reservations.length === 0) {
        doc
          .fontSize(14)
          .fillColor("#e74c3c")
          .text("No completed reservations found.", { align: "center" });
      } else {
        reservations.forEach((r, i) => {
          if (doc.y > 700) {
            doc.addPage();
          }

          // Also fix the price field if needed
          const price = r.prix_base || r.price || 0; // ✅ Check both possible price fields
          total += price;

          doc
            .fontSize(14)
            .fillColor("#2c3e50")
            .text(`#${i + 1}`, 50, doc.y, { continued: true })
            .text(` ${r.Service?.nom_service || r.Service?.nom || "Service"}`, {
              continued: true,
            }) // ✅ Fixed service name field
            .fillColor("#27ae60")
            .text(` +${price} TND`, { align: "right" });

          doc
            .fillColor("#7f8c8d")
            .fontSize(11)
            .text(
              `Date: ${
                r.date ? new Date(r.date).toLocaleDateString() : "Not specified"
              }`,
              70,
              doc.y
            );

          doc
            .strokeColor("#ecf0f1")
            .lineWidth(1)
            .moveTo(50, doc.y + 5)
            .lineTo(550, doc.y + 5)
            .stroke();

          doc.moveDown(0.8);
        });

        // Total earnings box
        doc
          .rect(50, doc.y + 10, 500, 60)
          .fillAndStroke("#3498db", "#2980b9")
          .fillColor("white")
          .fontSize(18)
          .text(`Total Earnings: ${total} TND`, 60, doc.y + 30, {
            align: "center",
          });
      }
    }

    // Also fix the reservations section
    if (type === "reservations") {
      const reservations = await Reservation.findAll({
        where: { prestataire_id: id },
        include: [{ model: User, as: "Client" }, { model: Service }],
        order: [["createdAt", "DESC"]],
      });

      addHeader("Reservations Report", "[RESERVATIONS]");

      doc
        .fontSize(12)
        .fillColor("#34495e")
        .text(`Prestataire: ${prestataire?.fullName || "Unknown"}`, {
          align: "left",
        })
        .text(`Email: ${prestataire?.email || "Unknown"}`)
        .text(`Total Reservations: ${reservations.length}`)
        .moveDown(1);

      if (reservations.length === 0) {
        doc
          .fontSize(14)
          .fillColor("#e74c3c")
          .text("No reservations found.", { align: "center" });
      } else {
        reservations.forEach((r, i) => {
          if (doc.y > 700) {
            doc.addPage();
          }

          const status = r.statut || "pending"; // ✅ Changed from 'status' to 'statut'
          const statusColor =
            status === "completed" || status === "terminé" // ✅ Handle both languages
              ? "#27ae60"
              : status === "cancelled" || status === "annulé"
              ? "#e74c3c"
              : "#f39c12";

          doc
            .fontSize(14)
            .fillColor("#2c3e50")
            .text(`#${i + 1}`, 50, doc.y, { continued: true })
            .text(
              ` ${r.Service?.nom_service || r.Service?.nom || "Service"} `,
              { continued: true }
            ) // ✅ Fixed service name
            .fillColor("#7f8c8d")
            .fontSize(12)
            .text(
              `booked by ${r.Client?.fullName || r.Client?.nom || "Client"}`
            );

          doc
            .fillColor("#34495e")
            .text(
              `Date: ${
                r.date ? new Date(r.date).toLocaleDateString() : "Not specified"
              }`,
              70,
              doc.y
            )
            .fillColor(statusColor)
            .text(`Status: ${status}`, 70, doc.y)
            .fillColor("#3498db")
            .text(`Price: ${r.prix_base || r.price || 0} TND`, 70, doc.y); // ✅ Fixed price field

          doc
            .strokeColor("#ecf0f1")
            .lineWidth(1)
            .moveTo(50, doc.y + 5)
            .lineTo(550, doc.y + 5)
            .stroke();

          doc.moveDown(1);
        });
      }
    } else if (type === "reviews") {
      const reviews = await Avis.findAll({
        where: { prestataire_id: id },
        include: [{ model: User, as: "clientAvis" }],
        order: [["createdAt", "DESC"]],
      });

      addHeader("Reviews Report", "[REVIEWS]");

      const avgRating =
        reviews.length > 0
          ? (
              reviews.reduce((sum, r) => sum + r.note, 0) / reviews.length
            ).toFixed(1)
          : 0;

      doc
        .fontSize(12)
        .fillColor("#34495e")
        .text(`Prestataire: ${prestataire.fullName || "Unknown"}`, {
          align: "left",
        })
        .text(`Email: ${prestataire.email || "Unknown"}`)
        .text(`Total Reviews: ${reviews.length}`)
        .fillColor("#f39c12")
        .text(`Average Rating: ${avgRating}/5 stars`)
        .moveDown(1);

      if (reviews.length === 0) {
        doc
          .fontSize(14)
          .fillColor("#e74c3c")
          .text("No reviews found.", { align: "center" });
      } else {
        reviews.forEach((r, i) => {
          if (doc.y > 650) {
            doc.addPage();
          }

          const rating = r.note || 0;
          const stars = "*".repeat(rating) + "-".repeat(5 - rating);
          const ratingColor =
            rating >= 4 ? "#27ae60" : rating >= 3 ? "#f39c12" : "#e74c3c";

          doc
            .fontSize(14)
            .fillColor("#2c3e50")
            .text(`#${i + 1}`, 50, doc.y, { continued: true })
            .fillColor("#7f8c8d")
            .text(
              ` ${r.clientAvis?.fullName || r.clientAvis?.nom || "Client"}`
            );

          doc
            .fillColor(ratingColor)
            .fontSize(12)
            .text(`${stars} (${rating}/5)`, 70, doc.y);

          if (r.commentaire) {
            doc
              .fillColor("#34495e")
              .fontSize(11)
              .text(`"${r.commentaire}"`, 70, doc.y, {
                width: 450,
                align: "justify",
              });
          }

          doc
            .fillColor("#bdc3c7")
            .fontSize(9)
            .text(
              `Date: ${
                r.createdAt
                  ? new Date(r.createdAt).toLocaleDateString()
                  : "Not specified"
              }`,
              70,
              doc.y
            );

          doc
            .strokeColor("#ecf0f1")
            .lineWidth(1)
            .moveTo(50, doc.y + 5)
            .lineTo(550, doc.y + 5)
            .stroke();

          doc.moveDown(1);
        });
      }
    }

    addFooter();

    // ✅ End the document properly
    doc.end();
  } catch (err) {
    console.error("PDF Generation Error:", err);
    // ✅ Only send error response if headers haven't been sent
    if (!res.headersSent) {
      res
        .status(500)
        .json({ message: "Erreur serveur lors de la génération du PDF" });
    }
  }
});
// LOGOUT (frontend only needs to remove the token)
router.post("/logout", (req, res) => {
  // No server-side action required for JWT unless you use a blacklist.
  return res.status(200).json({ message: "Déconnexion réussie." });
});
module.exports = router;
