import { NextRequest, NextResponse } from "next/server";

import { v4 as uuidv4 } from "uuid";

import { getState, setState } from "@/lib/store/server-store";

import { getEnrichedState } from "@/lib/google/sync";

import { getAuthenticatedClient } from "@/lib/google/client";

import { createGoogleCalendarEvent, fetchGoogleCalendarEvents } from "@/lib/google/calendar";

import { isGoogleConnected } from "@/lib/google/token-store";

import type { CalendarEvent } from "@/types";



export async function GET() {

  if (isGoogleConnected()) {

    const client = await getAuthenticatedClient();

    if (client) {

      const events = await fetchGoogleCalendarEvents(client);

      return NextResponse.json({ events, source: "google" });

    }

  }



  const state = getState();

  return NextResponse.json({ events: state.events, source: "mock" });

}



export async function POST(req: NextRequest) {

  const body = await req.json();



  if (isGoogleConnected()) {

    const client = await getAuthenticatedClient();

    if (client) {

      const event = await createGoogleCalendarEvent(client, {

        title: body.title,

        description: body.description,

        start: body.start,

        end: body.end,

        location: body.location,

        attendees: body.attendees ?? [],

        status: body.status || "confirmed",

      });



      const newState = await getEnrichedState();

      return NextResponse.json({ event, state: newState, source: "google" });

    }

  }



  const event: CalendarEvent = {

    id: uuidv4(),

    ...body,

    status: body.status || "confirmed",

  };



  const newState = setState((s) => ({

    ...s,

    events: [...s.events, event],

  }));



  return NextResponse.json({ event, state: newState, source: "mock" });

}

