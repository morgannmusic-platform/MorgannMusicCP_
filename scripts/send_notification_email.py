import resend

resend.api_key = "re_HgA8T82a_NtjKSVci8LWLjv2LF37KEkv9"

def send_notification_email(to_email):
    params = {
        "from": "Morgann Music CP <notifiction-noreply@mm-cp.uk>",
        "to": [to_email],
        "subject": "Nouvelle notification disponible",
        "html": "<h1>Bonjour</h1><p>Vous avez une nouvelle notification sur votre espace Morgann Music CP.</p>"
    }
    email = resend.Emails.send(params)
    print(email)

# Exemple d'utilisation :
# send_notification_email("destinataire@email.com")
