const fs = require("fs");
const path = require("path");
const OpenAI = require("openai").default;

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const k = m[1].trim();
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

async function testChat(client, label, model) {
  const t0 = Date.now();
  try {
    const res = await client.chat.completions.create({
      model,
      max_completion_tokens: 60,
      messages: [
        {
          role: "system",
          content: "Answer math correctly. Keep the reply under 20 words.",
        },
        {
          role: "user",
          content: "What is 17 + 25? Reply with the number and the word OK.",
        },
      ],
    });
    const text = (res.choices[0]?.message?.content || "").trim();
    const ms = Date.now() - t0;
    const mathOk = /\b42\b/.test(text);
    console.log(
      `[${label}] OK model=${res.model || model} ms=${ms} mathOk=${mathOk} reply=${JSON.stringify(text.slice(0, 120))}`
    );
    return { ok: true, mathOk };
  } catch (e) {
    console.log(`[${label}] FAIL status=${e?.status || "?"} ${e?.message || e}`);
    return { ok: false, mathOk: false, error: e?.message || String(e) };
  }
}

async function testEmbed(client, model) {
  const t0 = Date.now();
  try {
    const res = await client.embeddings.create({
      model,
      input: "Valliani Jewelers financing Affirm 12 percent",
    });
    const dim = res.data[0]?.embedding?.length || 0;
    console.log(
      `[EMBED] OK model=${res.model || model} ms=${Date.now() - t0} dims=${dim}`
    );
    return { ok: dim > 0 };
  } catch (e) {
    console.log(`[EMBED] FAIL status=${e?.status || "?"} ${e?.message || e}`);
    return { ok: false, error: e?.message || String(e) };
  }
}

async function checkModelsExist(client, wanted) {
  try {
    const list = await client.models.list();
    const ids = new Set();
    for await (const m of list) ids.add(m.id);
    console.log("[MODEL LIST] total models visible to this key:", ids.size);
    for (const m of wanted) {
      console.log(`[MODEL LIST] ${m} exact=${ids.has(m)}`);
    }
    const related = [...ids]
      .filter(
        (id) =>
          /gpt-5|terra|sol|luna|realtime|embedding-3/i.test(id)
      )
      .sort()
      .slice(0, 40);
    if (related.length) {
      console.log("[MODEL LIST] related ids:", related.join(", "));
    }
  } catch (e) {
    console.log("[MODEL LIST] FAIL", e?.message || e);
  }
}

async function main() {
  loadEnvLocal();
  const key = process.env.OPENAI_API_KEY || "";
  const hasKey = !!key && !key.includes("REPLACE");
  console.log("API key present:", hasKey);
  const models = {
    CHAT: process.env.OPENAI_CHAT_MODEL,
    ANALYST: process.env.OPENAI_ANALYST_MODEL,
    FAST: process.env.OPENAI_FAST_MODEL,
    REALTIME: process.env.OPENAI_REALTIME_MODEL,
    RT_FALLBACK: process.env.OPENAI_REALTIME_FALLBACK_MODEL,
    EMBED: process.env.OPENAI_EMBEDDING_MODEL,
  };
  console.log("Configured:", JSON.stringify(models, null, 2));
  if (!hasKey) {
    console.log("SKIP live calls — no API key");
    process.exit(1);
  }

  const client = new OpenAI({ apiKey: key });
  await checkModelsExist(client, Object.values(models).filter(Boolean));

  const chat = await testChat(client, "CHAT", models.CHAT);
  const analyst = await testChat(client, "ANALYST", models.ANALYST);
  const fast = await testChat(client, "FAST", models.FAST);
  const embed = await testEmbed(client, models.EMBED);

  const summary = {
    chatOk: chat.ok && chat.mathOk,
    analystOk: analyst.ok && analyst.mathOk,
    fastOk: fast.ok && fast.mathOk,
    embedOk: embed.ok,
    note: "Realtime models are session-based; list/exact check above is the API availability signal.",
  };
  console.log("SUMMARY", JSON.stringify(summary, null, 2));
  const allOk = summary.chatOk && summary.analystOk && summary.fastOk && summary.embedOk;
  process.exit(allOk ? 0 : 2);
}

main().catch((e) => {
  console.error("FATAL", e?.message || e);
  process.exit(1);
});
