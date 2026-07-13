#!/usr/bin/env python3
"""
ML Training Pipeline for Vanguard CRM Email Scanner

Trains a classifier head (LogisticRegression) on top of sentence-transformers/all-MiniLM-L6-v2
embeddings to categorize emails into: actionable, record, ack, uncertain.

Usage:
    # Generate mock training data and train
    python3 train_ml_head.py --generate-mock --samples 300

    # Train from existing JSONL logs (when available)
    python3 train_ml_head.py --input logs.jsonl

    # Interactive labeling mode (exports CSV, you label, reimport)
    python3 train_ml_head.py --label-mode --input logs.jsonl
"""

import argparse
import json
import os
import pickle
import random
import re
import sys
from pathlib import Path
from typing import Optional

# Add project root to path
PROJECT_ROOT = Path(__file__).parent
ML_MODEL_DIR = PROJECT_ROOT / "data" / "mail_scanner" / "ml_models"


# Classification mapping: rule engine labels → ML categories
RULE_TO_ML_CATEGORY = {
    # actionable
    "jobnimbus_task": "actionable",
    "jobnimbus_new_job": "actionable",
    "jobnimbus_mention_est": "actionable",
    "jobnimbus_mention": "actionable",
    "supplement_update": "actionable",
    "check_claimant": "actionable",
    "reconciliation_task": "actionable",
    "adjuster_action": "actionable",
    "carrier_adjuster_email": "actionable",
    "supplement_discussion": "actionable",
    # record
    "claim_code_only": "record",
    "acculynx_other": "record",
    # ack
    "ack_delay": "ack",
    "ack_delay_review_task": "ack",
    # uncertain
    "uncertain": "uncertain",
    "jobnimbus_mention_ambiguous": "uncertain",
}


def generate_mock_data(num_samples: int = 300, seed: int = 42) -> list[dict]:
    """Generate synthetic email training data for bootstrapping."""
    random.seed(seed)
    samples = []

    # Actionable templates (requesting action, real work)
    actionable_templates = [
        {
            "subject": "New task assigned in JobNimbus: {claim}",
            "body": "You have been assigned a new task for claim {claim}. Please review and take action.",
            "weight": 3,
        },
        {
            "subject": "{name} assigned you a new job: {claim}",
            "body": "New job created for {name}. Claim: {claim}. Address: {addr}. Please review.",
            "weight": 3,
        },
        {
            "subject": "Job Supplement Notification: {claim} CA - {claim2}",
            "body": "Supplement submitted for claim {claim}. Carrier review pending.",
            "weight": 4,
        },
        {
            "subject": "Job Notification: {claim}: {name}",
            "body": "New job notification for {claim}. Customer: {name}. Please process.",
            "weight": 3,
        },
        {
            "subject": "Adjuster requested inspection for {claim}",
            "body": "The adjuster has requested an inspection. Please schedule with the customer.",
            "weight": 3,
        },
        {
            "subject": "Reconciliation needed for {claim}",
            "body": "Reconciliation is required for this claim. Please review the estimate and resolve discrepancies.",
            "weight": 2,
        },
        {
            "subject": "Supplement discussion: {claim}",
            "body": "We need to discuss the supplement for {claim}. Please review the attached documents.",
            "weight": 2,
        },
        {
            "subject": "Urgent: {claim} needs attention",
            "body": "This claim requires immediate attention. Customer is waiting for update.",
            "weight": 2,
        },
        {
            "subject": "Review needed: {name} - {claim}",
            "body": "Please review the following: Customer {name}, Claim {claim}. Estimate needs revision.",
            "weight": 2,
        },
    ]

    # Acknowledgment/delay templates (not actionable)
    ack_templates = [
        {
            "subject": "Re: {claim}",
            "body": "Thank you for your email. We have received your message and will get back to you within 2-3 business days.",
            "weight": 4,
        },
        {
            "subject": "Out of Office",
            "body": "I am currently out of the office and will return on Monday. I will respond to your email when I return.",
            "weight": 3,
        },
        {
            "subject": "Acknowledgment: {claim}",
            "body": "This is an automated acknowledgment. Your request has been received and is being processed.",
            "weight": 3,
        },
        {
            "subject": "Re: Supplement Update",
            "body": "We acknowledge receipt of your supplement update. It will be reviewed in due course.",
            "weight": 2,
        },
        {
            "subject": "Thank you",
            "body": "Thank you for your email. We appreciate you reaching out. We will review and respond shortly.",
            "weight": 2,
        },
        {
            "subject": "Delay Notice",
            "body": "Due to high volume, there may be a delay in our response. We appreciate your patience.",
            "weight": 2,
        },
    ]

    # Record-only templates (claim codes, Acculynx, just data)
    record_templates = [
        {
            "subject": "{claim}",
            "body": "See attached documents.",
            "weight": 3,
        },
        {
            "subject": "Acculynx notification for {claim}",
            "body": "Acculynx has updated the status for claim {claim}.",
            "weight": 2,
        },
        {
            "subject": "Claim {claim} - Documents",
            "body": "Please find the documents for claim {claim} attached.",
            "weight": 2,
        },
    ]

    # Uncertain templates (vague, unclear action)
    uncertain_templates = [
        {
            "subject": "FYI",
            "body": "Just wanted to let you know about this.",
            "weight": 2,
        },
        {
            "subject": "Update",
            "body": "There's been an update. Please review.",
            "weight": 2,
        },
        {
            "subject": "Question",
            "body": "Do we have an update on this?",
            "weight": 1,
        },
    ]

    names = [
        "John Smith", "Jane Doe", "Robert Johnson", "Maria Garcia", "David Wilson",
        "Sarah Brown", "Michael Lee", "Jennifer Davis", "James Miller", "Linda Martinez",
    ]
    claims = ["39978", "961", "872", "1136", "5566", "7788", "9900", "1234", "5678", "9012"]
    addrs = [
        "123 Main St, Springfield, IL", "456 Oak Ave, Chicago, IL", "789 Pine Rd, Milwaukee, WI",
        "321 Elm St, Madison, WI", "654 Maple Dr, Indianapolis, IN",
    ]

    def fill_template(template: dict, category: str) -> dict:
        subject = template["subject"].format(
            claim=random.choice(claims),
            name=random.choice(names),
            claim2=random.randint(1000, 9999),
        )
        body = template["body"].format(
            claim=random.choice(claims),
            name=random.choice(names),
            addr=random.choice(addrs),
        )
        return {
            "subject": subject,
            "body": body,
            "category": category,
        }

    # Generate samples
    for _ in range(num_samples):
        roll = random.random()
        if roll < 0.5:  # 50% actionable
            template = random.choices(actionable_templates, weights=[t["weight"] for t in actionable_templates])[0]
            samples.append(fill_template(template, "actionable"))
        elif roll < 0.75:  # 25% ack
            template = random.choices(ack_templates, weights=[t["weight"] for t in ack_templates])[0]
            samples.append(fill_template(template, "ack"))
        elif roll < 0.9:  # 15% record
            template = random.choices(record_templates, weights=[t["weight"] for t in record_templates])[0]
            samples.append(fill_template(template, "record"))
        else:  # 10% uncertain
            template = random.choices(uncertain_templates, weights=[t["weight"] for t in uncertain_templates])[0]
            samples.append(fill_template(template, "uncertain"))

    random.shuffle(samples)
    return samples


def load_jsonl_logs(input_path: str) -> list[dict]:
    """Load exported scanner logs and extract training data."""
    samples = []
    with open(input_path, "r") as f:
        for line in f:
            try:
                entry = json.loads(line.strip())
                classification = entry.get("classification")
                if classification and classification in RULE_TO_ML_CATEGORY:
                    # Extract subject and body from log entry
                    subject = entry.get("subject", "")
                    body = entry.get("body_text", "")[:1500]  # Truncate for embedding
                    if subject or body:
                        samples.append({
                            "subject": subject,
                            "body": body,
                            "category": RULE_TO_ML_CATEGORY[classification],
                            "rule_classification": classification,
                            "normalized_claim": entry.get("normalized_claim"),
                        })
            except json.JSONDecodeError:
                continue
    return samples


# User feedback corrections → ML categories
CORRECTION_TO_ML_CATEGORY = {
    "actionable": "actionable",
    "ack_suppress": "ack",
    "owner_name_title": "record",
    "note_only": "record",
    "wrong_rule": None,  # handled via correct_classification field
    "wrong_deal": None,  # linking error, not a classification change
    "should_notify": "actionable",  # adjuster update → needs action
}


def load_feedback_entries(feedback_path: Optional[str] = None) -> list[dict]:
    """Load user feedback entries and convert to labeled training samples.

    - verdict == 'correct' → reinforce the bot's original classification
    - verdict == 'wrong' + correct_classification → use the user's rule as label (preferred)
    - verdict == 'wrong' + user_correction → fall back to correction-based category
    """
    if feedback_path is None:
        feedback_path = str(PROJECT_ROOT / "data" / "mail_scanner" / "feedback.jsonl")
    samples = []
    if not os.path.exists(feedback_path):
        return samples
    with open(feedback_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            verdict = (entry.get("user_verdict") or "").lower()
            if verdict not in ("correct", "wrong"):
                continue
            subject = entry.get("subject") or ""
            body = (entry.get("email_text") or "")[:1500]
            if not subject and not body:
                continue
            category = None
            if verdict == "correct":
                classification = entry.get("classification")
                if classification in RULE_TO_ML_CATEGORY:
                    category = RULE_TO_ML_CATEGORY[classification]
            else:  # wrong
                # Prefer correct_classification (the rule the user says should have matched)
                correct_class = entry.get("correct_classification")
                if correct_class and correct_class in RULE_TO_ML_CATEGORY:
                    category = RULE_TO_ML_CATEGORY[correct_class]
                else:
                    # Fall back to user_correction-based category
                    correction = (entry.get("user_correction") or "").lower()
                    category = CORRECTION_TO_ML_CATEGORY.get(correction)
            if category:
                samples.append({
                    "subject": subject,
                    "body": body,
                    "category": category,
                    "source": "feedback",
                    "conversation_id": entry.get("conversation_id"),
                })
    return samples


def export_for_labeling(samples: list[dict], output_path: str):
    """Export samples to CSV for manual labeling."""
    with open(output_path, "w") as f:
        f.write("idx,subject,body,auto_category,label\n")
        for i, s in enumerate(samples):
            # Escape CSV properly
            subject = s["subject"].replace('"', '""')
            body = s["body"][:200].replace('"', '""')  # Truncate body for readability
            f.write(f'{i},"{subject}","{body}",{s["category"]},\n')
    print(f"Exported {len(samples)} samples to {output_path}")
    print("Fill in the 'label' column with: actionable, record, ack, uncertain")
    print("Then run: python3 train_ml_head.py --import-labels <labeled.csv>")


def import_labels(csv_path: str) -> list[dict]:
    """Import labeled CSV and return samples with labels."""
    samples = []
    with open(csv_path, "r") as f:
        import csv
        reader = csv.DictReader(f)
        for row in reader:
            label = row.get("label", "").strip()
            if label in ("actionable", "record", "ack", "uncertain"):
                samples.append({
                    "subject": row["subject"],
                    "body": row["body"],
                    "category": label,
                })
    return samples


def train_head(samples: list[dict], output_path: str, test_size: float = 0.2):
    """Train LogisticRegression head on embeddings."""
    try:
        from sentence_transformers import SentenceTransformer
        import numpy as np
        from sklearn.linear_model import LogisticRegression
        from sklearn.metrics import classification_report, confusion_matrix
        from sklearn.model_selection import train_test_split
    except ImportError as e:
        print(f"Missing ML dependencies: {e}")
        print("Install with: pip install sentence-transformers scikit-learn numpy torch")
        sys.exit(1)

    print(f"Training on {len(samples)} samples...")

    # Load embedding model
    model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

    # Create embeddings
    texts = [f"{s['subject']}\n\n{s['body'][:1500]}" for s in samples]
    y = np.array([s["category"] for s in samples])

    print("Generating embeddings...")
    X = model.encode(texts, normalize_embeddings=True, show_progress_bar=True)

    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=y
    )

    # Train classifier
    print("Training LogisticRegression head...")
    clf = LogisticRegression(
        max_iter=1000,
        random_state=42,
        class_weight="balanced",  # Handle class imbalance
        C=1.0,
    )
    clf.fit(X_train, y_train)

    # Evaluate
    y_pred = clf.predict(X_test)
    print("\n" + "=" * 60)
    print("Classification Report:")
    print("=" * 60)
    print(classification_report(y_test, y_pred))

    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, y_pred))

    # Save model
    ML_MODEL_DIR.mkdir(parents=True, exist_ok=True)
    output_path = Path(output_path)
    with open(output_path, "wb") as f:
        pickle.dump(clf, f)
    print(f"\nSaved classifier head to {output_path}")

    # Also save a summary
    summary_path = ML_MODEL_DIR / "training_summary.json"
    with open(summary_path, "w") as f:
        json.dump({
            "num_samples": len(samples),
            "categories": list(set(s["category"] for s in samples)),
            "test_accuracy": float(clf.score(X_test, y_test)),
            "model_type": "LogisticRegression",
            "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
        }, f, indent=2)
    print(f"Training summary saved to {summary_path}")

    return clf


def main():
    parser = argparse.ArgumentParser(description="Train ML classifier head for email scanner")
    parser.add_argument("--input", help="Input JSONL file with exported scanner logs")
    parser.add_argument("--output", default=str(ML_MODEL_DIR / "classifier_head.pkl"),
                        help="Output path for classifier head pickle")
    parser.add_argument("--generate-mock", action="store_true",
                        help="Generate synthetic training data")
    parser.add_argument("--samples", type=int, default=300,
                        help="Number of mock samples to generate (default: 300)")
    parser.add_argument("--label-mode", action="store_true",
                        help="Export CSV for manual labeling")
    parser.add_argument("--import-labels", help="Import labeled CSV file")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--feedback", action="store_true",
                        help="Include data/mail_scanner/feedback.jsonl as labeled training data")
    parser.add_argument("--mock-and-feedback", action="store_true",
                        help="Combine generated mock data with feedback entries")
    args = parser.parse_args()

    ML_MODEL_DIR.mkdir(parents=True, exist_ok=True)

    if args.import_labels:
        # Import labeled data
        samples = import_labels(args.import_labels)
        if not samples:
            print("No valid labeled samples found.")
            sys.exit(1)
        print(f"Imported {len(samples)} labeled samples")
        train_head(samples, args.output)
    elif args.label_mode:
        # Export for labeling
        if not args.input:
            # Generate mock data for labeling
            samples = generate_mock_data(args.samples, args.seed)
        else:
            samples = load_jsonl_logs(args.input)
        csv_path = str(ML_MODEL_DIR / "training_data_for_labeling.csv")
        export_for_labeling(samples, csv_path)
    elif args.generate_mock or args.input or args.feedback or args.mock_and_feedback:
        # Generate or load data and train
        samples = []
        if args.generate_mock or args.mock_and_feedback:
            mock_samples = generate_mock_data(args.samples, args.seed)
            print(f"Generated {len(mock_samples)} mock samples")
            samples.extend(mock_samples)
        if args.input:
            log_samples = load_jsonl_logs(args.input)
            print(f"Loaded {len(log_samples)} samples from logs")
            samples.extend(log_samples)
        if args.feedback or args.mock_and_feedback:
            feedback_samples = load_feedback_entries()
            print(f"Loaded {len(feedback_samples)} samples from feedback")
            samples.extend(feedback_samples)

        if len(samples) < 50:
            print("Warning: Very few samples. Results may be poor. Consider --generate-mock with more samples.")

        if samples:
            train_head(samples, args.output)
        else:
            print("No training samples available.")
            sys.exit(1)
    else:
        parser.print_help()
        print("\nExamples:")
        print("  # Generate mock data and train")
        print("  python3 train_ml_head.py --generate-mock --samples 300")
        print("\n  # Train from exported logs")
        print("  python3 train_ml_head.py --input scanner_logs.jsonl")
        print("\n  # Train from feedback + mock data")
        print("  python3 train_ml_head.py --mock-and-feedback --samples 300")
        print("\n  # Export for manual labeling")
        print("  python3 train_ml_head.py --label-mode --input logs.jsonl")


if __name__ == "__main__":
    main()
