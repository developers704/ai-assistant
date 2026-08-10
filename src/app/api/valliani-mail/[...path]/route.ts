import { NextRequest, NextResponse } from "next/server";

const DEFAULT_BASE = "https://mail-api.valliani.app/api";

function baseUrl(): string {
  const raw = (process.env.MAIL_API_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
  return raw;
}

async function proxy(req: NextRequest, pathParts: string[]) {
  const path = pathParts.map(encodeURIComponent).join("/");
  const url = new URL(`${baseUrl()}/${path}`);
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const auth = req.headers.get("authorization");
  if (auth) headers.set("authorization", auth);
  const mailToken = req.headers.get("x-mail-token");
  if (mailToken) headers.set("x-mail-token", mailToken);

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: "no-store",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    const buf = await req.arrayBuffer();
    if (buf.byteLength > 0) init.body = buf;
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch (err) {
    return NextResponse.json(
      {
        message:
          err instanceof Error
            ? err.message
            : "Mail server is temporarily unavailable",
      },
      { status: 502 }
    );
  }

  const outHeaders = new Headers();
  const upstreamType = upstream.headers.get("content-type");
  if (upstreamType) outHeaders.set("content-type", upstreamType);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: outHeaders,
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}
