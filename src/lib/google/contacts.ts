import { google } from "googleapis";
import type { GoogleOAuth2Client } from "./client";
import type { Contact } from "@/types";

function pickPhone(
  numbers: { value?: string | null; type?: string | null }[] | undefined
): string | undefined {
  if (!numbers?.length) return undefined;
  const mobile = numbers.find((n) => /mobile|cell|iphone/i.test(n.type ?? ""));
  return (mobile?.value ?? numbers[0]?.value)?.trim() || undefined;
}

function pickEmail(
  addresses: { value?: string | null }[] | undefined
): string | undefined {
  return addresses?.find((a) => a.value)?.value?.trim() || undefined;
}

function mapPerson(
  person: {
    resourceName?: string | null;
    names?: { displayName?: string | null; givenName?: string | null; familyName?: string | null }[] | null;
    emailAddresses?: { value?: string | null }[] | null;
    phoneNumbers?: { value?: string | null; type?: string | null }[] | null;
    organizations?: { name?: string | null; title?: string | null }[] | null;
    biographies?: { value?: string | null }[] | null;
  },
  index: number
): Contact | null {
  const name =
    person.names?.[0]?.displayName?.trim() ||
    [person.names?.[0]?.givenName, person.names?.[0]?.familyName].filter(Boolean).join(" ").trim();

  if (!name) return null;

  const phone = pickPhone(person.phoneNumbers ?? undefined);
  const email = pickEmail(person.emailAddresses ?? undefined);
  const org = person.organizations?.[0];

  return {
    id: person.resourceName ?? `google-contact-${index}`,
    name,
    role: org?.title?.trim() || "",
    company: org?.name?.trim() || "",
    email,
    phone,
    whatsapp: phone,
    notes: person.biographies?.[0]?.value?.trim() || undefined,
    isImportant: false,
  };
}

export async function fetchGoogleContacts(
  client: GoogleOAuth2Client,
  maxContacts = 500
): Promise<Contact[]> {
  const people = google.people({ version: "v1", auth: client });
  const contacts: Contact[] = [];
  let pageToken: string | undefined;
  let index = 0;

  do {
    const { data } = await people.people.connections.list({
      resourceName: "people/me",
      pageSize: 100,
      pageToken,
      personFields: "names,emailAddresses,phoneNumbers,organizations,biographies",
      sortOrder: "LAST_MODIFIED_ASCENDING",
    });

    for (const person of data.connections ?? []) {
      const mapped = mapPerson(person, index++);
      if (mapped) contacts.push(mapped);
      if (contacts.length >= maxContacts) break;
    }

    pageToken = contacts.length >= maxContacts ? undefined : data.nextPageToken ?? undefined;
  } while (pageToken);

  return contacts.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}
