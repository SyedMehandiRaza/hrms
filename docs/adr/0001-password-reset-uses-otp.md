# 1. Password reset uses a 6-digit OTP, not a link

Date: 2026-10-19 · Status: Accepted

## Context
The planning default was a 30-minute single-use reset link. The UI is already built as
Forgot (email) → Verify OTP (6 digits, resend timer) → Reset, and `password_reset_otps` is migrated.
Changing to a link would mean redesigning three screens.

## Decision
Keep the OTP flow:
- Forgot always answers "If an account exists for this email, you'll receive a reset code." with the same timing.
- Code: 6 random digits, hashed, valid **10 minutes**, max **5 wrong attempts**. A new code voids the old one.
- Resend after 60 s, max 5 per email per hour.
- Verify returns a reset token (single use, hashed, 15 min) that the Reset screen sends with the new password.
- A successful reset revokes all sessions and clears the lockout.

## Consequences
- 10 minutes instead of 30 because a 6-digit code is far easier to guess than a link token.
- No new screens. The setup link for admin-created logins reuses the Reset screen (ADR 3).
