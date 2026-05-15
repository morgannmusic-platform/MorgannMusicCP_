import resend

resend.api_key = "re_HgA8T82a_NtjKSVci8LWLjv2LF37KEkv9"

params = {
    "from": "Morgann Music CP <notifiction-noreply@mm-cp.uk>",
    "to": ["ADRESSE_EMAIL_CIBLE"],  # Remplace par l'email de l'artiste
    "subject": "Nouvelle notification disponible",
    "html": "<h1>Bonjour</h1><p>Vous avez une nouvelle notification sur votre espace Morgann Music CP.</p>"
}

email = resend.Emails.send(params)
print(email)
