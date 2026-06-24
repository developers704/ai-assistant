import { Configuration, PlaidApi } from "plaid";
import { getPlaidConfig } from "./config";

let plaidClient: PlaidApi | null = null;

export function getPlaidClient(): PlaidApi | null {
  const config = getPlaidConfig();
  if (!config) return null;

  if (!plaidClient) {
    const configuration = new Configuration({
      basePath: config.basePath,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": config.clientId,
          "PLAID-SECRET": config.secret,
        },
      },
    });
    plaidClient = new PlaidApi(configuration);
  }

  return plaidClient;
}
