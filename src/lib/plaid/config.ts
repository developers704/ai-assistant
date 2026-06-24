import { PlaidEnvironments } from "plaid";

export type PlaidEnvName = "sandbox" | "development" | "production";

export function getPlaidConfig() {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const envName = (process.env.PLAID_ENV ?? "sandbox") as PlaidEnvName;

  if (!clientId || !secret) {
    return null;
  }

  const basePath =
    envName === "production"
      ? PlaidEnvironments.production
      : envName === "development"
        ? PlaidEnvironments.development
        : PlaidEnvironments.sandbox;

  return { clientId, secret, envName, basePath };
}

export function isPlaidConfigured(): boolean {
  return getPlaidConfig() !== null;
}
