#!/usr/bin/env node
/**
 * Export your Atoms agent (full config + workflow) to atoms-agent-config.json.
 * Webhook URLs are replaced with {{WEBHOOK_BASE_URL}} so others can duplicate your agent.
 *
 * Prerequisites: server/.env with SMALLEST_API_KEY and SMALLEST_RECEPTIONIST_AGENT_ID
 * Run: node scripts/export-atoms-workflow.js [agentId]
 *
 * Tip: Run node scripts/list-atoms-agents.js to find your agent ID if unsure.
 */

const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '../server/.env');
const OUTPUT_PATH = path.join(__dirname, '../atoms-agent-config.json');
const API_BASE = process.env.ATOMS_API_BASE || 'https://api.smallest.ai/atoms/v1';
const PLACEHOLDER = '{{WEBHOOK_BASE_URL}}';

function loadEnv() {
  const envPath = path.resolve(ENV_PATH);
  if (!fs.existsSync(envPath)) {
    console.error('Error: server/.env not found. Create it from .env.example and add SMALLEST_API_KEY, SMALLEST_RECEPTIONIST_AGENT_ID.');
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

function replaceUrls(obj, baseUrl) {
  const ngrokRegex = /https?:\/\/[a-zA-Z0-9-]+\.ngrok[^"'\s]*\.(dev|io|app)(\/[^"'\s]*)?/gi;
  const replaceOne = (s) => {
    if (typeof s !== 'string') return s;
    if (baseUrl) return s.split(baseUrl).join(PLACEHOLDER);
    return s.replace(ngrokRegex, (m) => {
      const slash = m.includes('/webhooks') ? m.substring(m.indexOf('/webhooks')) : '';
      return PLACEHOLDER + slash;
    });
  };
  if (typeof obj === 'string') return replaceOne(obj);
  if (Array.isArray(obj)) return obj.map((item) => replaceUrls(item, baseUrl));
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = replaceUrls(v, baseUrl);
    return out;
  }
  return obj;
}

function extractBaseUrl(obj) {
  const str = JSON.stringify(obj);
  const m = str.match(/https?:\/\/[a-zA-Z0-9-]+\.ngrok[^"'\s]*/i);
  return m ? m[0].replace(/\/webhooks\/[^"'\s]*$/, '') : null;
}

const STRIP_KEYS = ['_id', 'id', 'organization', 'createdBy', 'workflowId', 'createdAt', 'updatedAt', 'totalCalls', 'archived'];

function stripForExport(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripForExport);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (STRIP_KEYS.includes(k)) continue;
    out[k] = stripForExport(v);
  }
  return out;
}

async function main() {
  const env = loadEnv();
  const apiKey = env.SMALLEST_API_KEY;
  const agentId = process.argv[2] || env.SMALLEST_RECEPTIONIST_AGENT_ID;
  const baseUrl = env.PUBLIC_WEBHOOK_BASE_URL || '';

  if (!apiKey || !agentId) {
    console.error('Error: SMALLEST_API_KEY and SMALLEST_RECEPTIONIST_AGENT_ID must be set in server/.env');
    console.error('Or pass agent ID: node scripts/export-atoms-workflow.js <agentId>');
    process.exit(1);
  }

  const headers = { Authorization: `Bearer ${apiKey}` };

  console.log('Fetching agent', agentId, '...');
  const agentRes = await fetch(`${API_BASE}/agent/${agentId}`, { headers });
  if (!agentRes.ok) {
    const text = await agentRes.text();
    console.error('Agent API error:', agentRes.status, text);
    console.error('\nTip: Run node scripts/list-atoms-agents.js to see your agents and their IDs.');
    process.exit(1);
  }

  const agentJson = await agentRes.json();
  if (!agentJson.status || !agentJson.data) {
    console.error('Unexpected agent response:', JSON.stringify(agentJson, null, 2));
    process.exit(1);
  }

  console.log('Fetching workflow...');
  const wfRes = await fetch(`${API_BASE}/agent/${agentId}/workflow`, { headers });
  if (!wfRes.ok) {
    const text = await wfRes.text();
    console.error('Workflow API error:', wfRes.status, text);
    process.exit(1);
  }

  const wfJson = await wfRes.json();
  if (!wfJson.status || !wfJson.data) {
    console.error('Unexpected workflow response:', JSON.stringify(wfJson, null, 2));
    process.exit(1);
  }

  const agent = stripForExport(agentJson.data);
  const workflow = wfJson.data;
  const urlToReplace = baseUrl || extractBaseUrl(workflow) || extractBaseUrl(agent);

  const config = {
    agent: replaceUrls(JSON.parse(JSON.stringify(agent)), urlToReplace || null),
    workflow: replaceUrls(JSON.parse(JSON.stringify(workflow)), urlToReplace || null)
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(config, null, 2), 'utf8');
  console.log('Saved to atoms-agent-config.json');
  if (urlToReplace) console.log('Replaced', urlToReplace, 'with', PLACEHOLDER);
  console.log('\nCommitted config lets others run: node scripts/setup-atoms-agent.js <their-ngrok-url>');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
