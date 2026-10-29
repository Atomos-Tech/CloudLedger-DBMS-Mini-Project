"""
CloudLedger — embed and seed support tickets into PostgreSQL + pgvector.

Usage:
    pip install -r requirements.txt   (see db/vector/requirements.txt)
    export PGVECTOR_URL="postgresql://user:password@localhost:5432/cloudledger_vectors"
    python db/vector/embed_and_seed.py

This generates a 384-dim embedding for each ticket's "subject + body" using
the free, local `all-MiniLM-L6-v2` sentence-transformer model, then inserts
the tickets into the `support_tickets` table (schema.sql must already have
been applied).
"""

import os
import sys

import psycopg2
from psycopg2.extras import execute_values
from sentence_transformers import SentenceTransformer

PGVECTOR_URL = os.environ.get(
    "PGVECTOR_URL", "postgresql://postgres:postgres@localhost:5432/cloudledger_vectors"
)

MODEL_NAME = "all-MiniLM-L6-v2"

# client_id values line up with db/mysql/seed.sql (1=Initech, 2=Globex, 3=Umbrella, 4=Hooli)
SAMPLE_TICKETS = [
    (1, "Server still billing after shutdown",
     "I stopped my instance yesterday but the dashboard shows it's still "
     "accumulating charges. Can you confirm the meter has actually stopped?"),
    (1, "Instance won't stop accruing cost",
     "We powered down instance-2 hours ago and the usage log start_time never "
     "got an end_time. Billing keeps ticking even though the server is off."),
    (2, "Cannot access admin dashboard",
     "Our billing lead gets a 403 error when trying to open the admin "
     "dashboard even though her role should have access."),
    (2, "Login fails with correct password",
     "Multiple team members report that logging in with the right email and "
     "password just redirects back to the login page with no error message."),
    (3, "Account suspended unexpectedly",
     "Our account status changed to Suspended overnight and now we can't "
     "provision new servers. We didn't request this change."),
    (3, "Why was my account frozen",
     "All our attempts to launch new compute instances are being rejected. "
     "Support said the account is suspended but we have no idea why."),
    (4, "Invoice total looks wrong",
     "This month's invoice total is much higher than our estimated usage. "
     "Can someone double check how the total_amount was calculated?"),
    (4, "Billing amount does not match usage logs",
     "When I sum up the hours in the usage log manually I get a different "
     "number than what appears on the invoice PDF."),
    (2, "Feature request: usage export",
     "It would help a lot if we could export raw usage logs as CSV instead "
     "of only seeing the aggregated monthly view."),
    (1, "Request to add CSV export for usage data",
     "Our finance team wants to reconcile cloud spend in a spreadsheet, so a "
     "raw usage-log CSV export would be very useful."),
    (4, "Data center maintenance downtime",
     "Is the Frankfurt facility still in Maintenance status? One of our "
     "planned deployments there keeps failing."),
    (3, "Slow instance provisioning",
     "Launching a new server in us-west-2 has been stuck in 'Stopped' status "
     "for over 20 minutes without transitioning to Running."),
]


def main() -> None:
    print(f"Loading model {MODEL_NAME} ...")
    model = SentenceTransformer(MODEL_NAME)

    texts = [f"{subject}\n\n{body}" for _, subject, body in SAMPLE_TICKETS]
    print(f"Embedding {len(texts)} tickets ...")
    embeddings = model.encode(texts, normalize_embeddings=True)

    rows = [
        (client_id, subject, body, embedding.tolist())
        for (client_id, subject, body), embedding in zip(SAMPLE_TICKETS, embeddings)
    ]

    print("Connecting to PostgreSQL ...")
    conn = psycopg2.connect(PGVECTOR_URL)
    try:
        with conn.cursor() as cur:
            execute_values(
                cur,
                """
                INSERT INTO support_tickets (client_id, subject, body, embedding)
                VALUES %s
                """,
                rows,
                template="(%s, %s, %s, %s::vector)",
            )
        conn.commit()
        print(f"Inserted {len(rows)} tickets into support_tickets.")
    finally:
        conn.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print(f"Failed to seed support tickets: {exc}", file=sys.stderr)
        sys.exit(1)
