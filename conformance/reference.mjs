// The reference decision, built on the package's verifier. It exists to show that the vectors are
// consistent with the spec; your agent doesn't need to be written like this, it needs to reach the
// same decisions.

/** @param spec the @authorizedretailers/spec module */
export async function referenceDecide(spec, input) {
  const now = Date.parse(input.now);
  const { answer, jwks, feed } = input;
  if (!answer) return { decision: "unconfirmed" };

  // Signature, key set and freshness (sections 8 and 10.1). A stale answer is usable only when the
  // verify API is unreachable, and only with a feed issued at or after it (10.2, 10.3).
  const check = await spec.verifyDocument(answer, jwks, { now, allowStale: input.verify_api === "unreachable", ...(feed ? { revocationFeed: feed } : {}) });
  if (!check.valid) return { decision: "unconfirmed" };

  // Anything but `authorized`, including a status this agent has never seen, is not authorized (section 9).
  if (answer.status !== "authorized") return { decision: "not_authorized" };

  // An end date ends the authorization at that instant, whatever `valid_until` says (section 10.1).
  if (typeof answer.expires === "string" && now >= Date.parse(answer.expires)) return { decision: "not_authorized" };

  // `observed: null` is not looked at: it is never a negative signal (section 7).
  return check.stale ? { decision: "authorized", stale: true } : { decision: "authorized" };
}
