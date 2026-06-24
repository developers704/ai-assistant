import type { AppState, AppIntegrations, GoogleIntegration } from "@/types";
import { getState } from "@/lib/store/server-store";
import { isGoogleConnected, getGoogleTokens } from "./token-store";
import { getAuthenticatedClient } from "./client";
import { fetchGmailInbox } from "./gmail";
import { fetchGoogleCalendarEvents } from "./calendar";
import { sortEmails } from "@/lib/email-utils";
import { filterCalendarEvents } from "@/lib/calendar-utils";
import {
  getGoogleCache,
  setGoogleCache,
  applyGoogleCacheToState,
  invalidateGoogleCache,
} from "./cache";
import { isLLMChatConfigured } from "@/lib/ai/llm-chat";
import { getRagStats } from "@/lib/rag";
import { isNewsApiConfigured } from "@/lib/news";
import { isPlaidConfigured } from "@/lib/plaid/config";
import { getPlaidTokens, isPlaidConnected } from "@/lib/plaid/token-store";
import { fetchInvestmentSummary } from "@/lib/plaid/investments";
import { withTimeout } from "@/lib/async-utils";
import type { PortfolioSnapshot } from "@/types";

const PORTFOLIO_TIMEOUT_MS = 5000;
const GOOGLE_SYNC_TIMEOUT_MS = 12000;

export { applyGoogleCacheToState, invalidateGoogleCache, getIntegrationsMeta };

function getIntegrationsMeta(): AppIntegrations {
  const rag = getRagStats();
  const plaidTokens = getPlaidTokens();
  return {
    google: {
      connected: isGoogleConnected(),
      email: getGoogleTokens()?.email,
    },
    plaid: {
      connected: isPlaidConnected(),
      configured: isPlaidConfigured(),
      institutionName: plaidTokens?.institution_name,
      connectedAt: plaidTokens?.connected_at,
      env: process.env.PLAID_ENV ?? "sandbox",
    },
    llm: {
      configured: isLLMChatConfigured(),
      mode: isLLMChatConfigured() ? "hybrid" : "rules",
    },
    rag: {
      available: rag.available,
      chunks: rag.totalChunks,
      faqs: rag.totalFaqs,
    },
    news: {
      configured: isNewsApiConfigured(),
    },
  };
}

async function loadPortfolioSnapshot(): Promise<PortfolioSnapshot | undefined> {
  if (!isPlaidConnected()) return undefined;
  try {
    const summary = await withTimeout(
      fetchInvestmentSummary(),
      PORTFOLIO_TIMEOUT_MS,
      "Plaid portfolio sync"
    );
    if (!summary) return undefined;
    const tokens = getPlaidTokens();
    return {
      totalValue: summary.totalValue,
      institutionName: tokens?.institution_name,
      accounts: summary.accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        subtype: a.subtype,
        balance: a.balance,
      })),
      holdings: summary.holdings.map((h) => ({
        securityName: h.securityName,
        ticker: h.ticker,
        value: h.value,
        quantity: h.quantity,
        price: h.price,
        accountName: h.accountName,
      })),
      lastUpdated: summary.lastUpdated,
    };
  } catch (err) {
    console.warn("Portfolio snapshot failed:", err);
    return undefined;
  }
}

function attachPortfolio(base: AppState, portfolio?: PortfolioSnapshot): AppState {
  return portfolio ? { ...base, portfolio } : base;
}

export async function getEnrichedState(options?: {
  force?: boolean;
  quick?: boolean;
}): Promise<AppState> {
  const base = getState();
  const integrations = getIntegrationsMeta();

  const integration: GoogleIntegration = {
    connected: isGoogleConnected(),
    email: getGoogleTokens()?.email,
  };

  if (options?.quick) {
    if (!integration.connected) {
      return { ...base, integrations };
    }

    const cached = getGoogleCache();
    if (cached) {
      return {
        ...base,
        emails: cached.emails,
        events: filterCalendarEvents(cached.events),
        integrations: {
          ...integrations,
          google: cached.integration,
        },
      };
    }

    // Google connected but cache cold — do not leak demo mockEvents into live views
    return {
      ...base,
      events: [],
      emails: [],
      integrations: { ...integrations, google: integration },
    };
  }

  const portfolioPromise = loadPortfolioSnapshot();

  if (!integration.connected) {
    const portfolio = await portfolioPromise;
    return attachPortfolio({ ...base, integrations }, portfolio);
  }

  if (!options?.force) {
    const cached = getGoogleCache();
    if (cached) {
      const portfolio = await portfolioPromise;
      return attachPortfolio(
        {
          ...base,
          emails: cached.emails,
          events: filterCalendarEvents(cached.events),
          integrations: {
            ...integrations,
            google: cached.integration,
          },
        },
        portfolio
      );
    }
  }

  try {
    const client = await getAuthenticatedClient();
    if (!client) {
      const portfolio = await portfolioPromise;
      return attachPortfolio(
        {
          ...base,
          integrations: {
            ...integrations,
            google: { ...integrations.google, syncError: "Session expired — reconnect Google" },
          },
        },
        portfolio
      );
    }

    const syncGoogle = async () => {
      const [emails, events] = await Promise.all([
        fetchGmailInbox(client),
        fetchGoogleCalendarEvents(client, base.user?.timezone || "Asia/Karachi"),
      ]);
      return { emails, events };
    };

    const [portfolio, googleResult] = await Promise.all([
      portfolioPromise,
      withTimeout(syncGoogle(), GOOGLE_SYNC_TIMEOUT_MS, "Google sync"),
    ]);

    const sortedEmails = sortEmails(googleResult.emails);
    const filteredEvents = filterCalendarEvents(googleResult.events);
    setGoogleCache({ emails: sortedEmails, events: filteredEvents, integration });

    return attachPortfolio(
      {
        ...base,
        emails: sortedEmails,
        events: filteredEvents,
        integrations,
      },
      portfolio
    );
  } catch (err) {
    const portfolio = await portfolioPromise.catch(() => undefined);
    const message = err instanceof Error ? err.message : "Failed to sync Google data";
    return attachPortfolio(
      {
        ...base,
        integrations: {
          ...integrations,
          google: { ...integration, syncError: message },
        },
      },
      portfolio
    );
  }
}
