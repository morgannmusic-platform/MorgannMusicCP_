const nodemailer = require("nodemailer");

// Utilise ton adresse verifiee dans Amazon SES pour eviter tout rejet.
const FROM_EMAIL = process.env.SES_FROM_EMAIL;
const TO_EMAIL = process.env.SES_TEST_TO || "morgann.rachedi@icloud.com";

if (!FROM_EMAIL) {
  console.error("Erreur: defini SES_FROM_EMAIL avec ton email expediteur valide sur Amazon SES.");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: "email-smtp.eu-north-1.amazonaws.com",
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: "AKIAXFZHVBTZOHULRUXC",
    pass: "BJISQ9YsY1gfIN5HxBYyLmao26bM7XfW1GAJXYJIC4ej"
  }
});

async function sendTestEmail() {
  await transporter.verify();

  const info = await transporter.sendMail({
    from: FROM_EMAIL,
    to: TO_EMAIL,
    subject: "Test Amazon SES SMTP - Morgann Music",
    text: "Ceci est un email de test envoye via Amazon SES SMTP.",
    html: `
      <div style=\"font-family:Helvetica,Arial,sans-serif;padding:18px\">
        <h2 style=\"margin:0 0 12px\">Test Amazon SES SMTP</h2>
        <p style=\"margin:0 0 8px\">Envoi reussi depuis ton projet MMCP.</p>
        <p style=\"margin:0;color:#666\">Destinataire: ${TO_EMAIL}</p>
      </div>
    `
  });

  console.log("Email envoye avec succes.");
  console.log("MessageId:", info.messageId);
  console.log("Accepted:", info.accepted);
}

sendTestEmail().catch((err) => {
  console.error("Echec envoi SES SMTP:", err?.message || err);
  if (err?.response) {
    console.error("SMTP response:", err.response);
  }
  if (err?.code) {
    console.error("SMTP code:", err.code);
  }
  if (err?.command) {
    console.error("SMTP command:", err.command);
  }
  process.exit(1);
});
