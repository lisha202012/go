-- Enforce one student claim per school registration link.
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolRegistrationLinkClaim_linkId_key"
  ON "SchoolRegistrationLinkClaim"("linkId");
