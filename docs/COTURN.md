# STUN/TURN setup guide

NexusDrop includes a public STUN fallback but no TURN server, account, or TURN credential issuer. Production deployments should configure a TURN service (self-hosted coturn or a managed provider) because direct ICE paths fail on some NATs and restrictive networks.

## Coturn responsibilities

Provide UDP relay and TLS/TCP relay as required by the networks you need to support. Configure a public DNS name and trusted TLS certificate for TLS, a dedicated realm, relay address/range, firewall/network rules for the listener and relay ports, monitoring, capacity limits, and abuse/bandwidth controls. Do not expose an unauthenticated relay. Review the current coturn manual and your hosting firewall requirements rather than copying a one-size-fits-all port recipe.

A typical coturn deployment uses long-term REST authentication with a private `static-auth-secret` held only on the TURN server and a separate credential-issuing backend. Conceptually:

```ini
# Illustrative only — replace endpoints/cert paths, protect secrets, and test your firewall.
listening-port=3478
fingerprint
use-auth-secret
static-auth-secret=REPLACE_WITH_RANDOM_SERVER_ONLY_SECRET
realm=turn.example.net
# For TLS, configure certificate/key paths and expose the chosen TLS listener.
# Restrict relay port ranges and bind addresses to your deployment environment.
```

Do not commit this secret. A credential service creates a time-limited username/password using the TURN provider's documented REST HMAC scheme and returns only the short-lived ICE credential to an authenticated browser/session. Scope expiry and quotas; rotate server secrets.

## NexusDrop integration status

The frontend accepts ICE configuration through `VITE_ICE_SERVERS_JSON`, which is public browser configuration. The included example contains only STUN. The app does **not** implement a protected endpoint for minting ephemeral TURN credentials. Do not place the coturn shared secret or a long-lived credential in this Vite variable. Before using private/paid TURN, add a protected short-lived credential API (or integrate a provider's authorized issuance mechanism), fetch ICE configuration before peer creation, and test that relay candidates actually succeed. TURN forwards encrypted WebRTC traffic temporarily and can incur significant egress costs.
