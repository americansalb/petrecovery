- **Review hardening on the letter refresh (Codex findings, PR #228):**
  `num` is now a stable identifier, not the letter's entry number:
  regenerating the list keeps every published number (matched by name
  or aka), so ?for= links already shared in the group chats keep
  landing on the same person, and new people number from 58 up. A
  test pins the anchors. And releasing a claim acts on the person's
  whole key set (canonical plus aka), so an "I'll write for them"
  made before a rename releases cleanly instead of reappearing on
  the next refresh.
