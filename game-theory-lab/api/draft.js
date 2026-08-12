import Anthropic from "@anthropic-ai/sdk";
import { createHash, timingSafeEqual } from "node:crypto";

/* Prompt lives server-side so the client can't alter model instructions. */
const DRAFT_PROMPT =
  "You convert a plain-language scenario into JSON for a game theory app. " +
  "Respond with ONLY valid JSON, no markdown fences, no commentary. Schema: " +
  '{"name":"short title","tree":{...},"matrix":{...}}. ' +
  'Tree node: {"type":"decision"|"chance"|"terminal","label":"short","prob":number|null,"payoff":number,"children":[...]}. ' +
  "Rules: root is usually a decision node; children of a chance node each need prob, and probs must sum to 1; " +
  "terminal nodes need payoff (net value, negative for costs/losses) and empty children; keep labels under 5 words; " +
  "keep the tree compact — about 12 nodes at most; " +
  "never create a node with exactly one child — a decision's children are the chance nodes or outcomes themselves; " +
  "estimate sensible probabilities and payoffs when the user does not give them. " +
  'Include "matrix" only if the scenario is a strategic game between two players: ' +
  '{"rows":["strategy",...],"cols":[...],"cells":[[{"a":rowPayoff,"b":colPayoff},...],...]} (2-4 strategies each, cells[row][col]). ' +
  "Include tree, matrix, or both as appropriate. Scenario: ";

const digest = (s) => createHash("sha256").update(String(s), "utf8").digest();
const passphraseOk = (given, expected) =>
  typeof given === "string" && given.length > 0 && timingSafeEqual(digest(given), digest(expected));

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  const expected = process.env.DRAFT_PASSPHRASE;
  if (!expected || !process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "not_configured" });
    return;
  }
  const { scenario, passphrase } = req.body ?? {};
  if (!passphraseOk(passphrase, expected)) {
    res.status(401).json({ error: "bad_passphrase" });
    return;
  }
  if (typeof scenario !== "string" || !scenario.trim() || scenario.length > 2000) {
    res.status(400).json({ error: "bad_scenario" });
    return;
  }

  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
  try {
    const message = await client.messages.create({
      model: "claude-opus-5",
      /* max_tokens caps thinking + text together on Opus 5; leave headroom */
      max_tokens: 6000,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: DRAFT_PROMPT + scenario.trim() }],
    });
    if (message.stop_reason === "refusal") {
      res.status(502).json({ error: "upstream_error" });
      return;
    }
    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    res.status(200).json({ text });
  } catch (e) {
    res.status(502).json({ error: "upstream_error" });
  }
}
