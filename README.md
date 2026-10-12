[README.md](https://github.com/user-attachments/files/33316698/README.md)
# inbox-assistant# Inbox Studio

Personal Gmail inbox assistant — first working version.

Run locally: `python3 -m http.server 8080 --directory dist`, then open http://localhost:8080.

Features: manual conversation import, explicit exclusion controls, deadline-first sorting, important contacts, requests over 48 hours, editable drafts and notes, per-draft approval invalidated on edits, approved plain-text export, fictional demo, browser-local persistence, workspace deletion, responsive layout.

No live Gmail integration, AI generation, sending, or active scheduled jobs are implemented. No real inbox messages are included in the source or deployment. Draft starters are generic templates. Imported content stays in localStorage in the visitor's browser; clear the workspace when using a shared device.

The desired review schedule is weekdays at 8:00 AM America/New_York and is visibly marked inactive. Completing the connected version requires an eligible Sites Gmail connector or a separate OAuth backend, a secure AI generation service, and a scheduler. Sending must require explicit approval of each exact draft, authenticated identity, duplicate protection, and Gmail write consent.
