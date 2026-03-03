#!/usr/bin/env node
/**
 * List your Atoms agents. Use this to find the agent ID for export.
 *
 * Prerequisites: server/.env with SMALLEST_API_KEY
 * Run: node scripts/list-atoms-agents.js
 */

const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '../server/.env');
const API_BASE = process.env.ATOMS_API_BASE || 'https://api.smallest.ai/atoms/v1';

function loadEnv() {
  const envPath = path.resolve(ENV_PATH);
  if (!fs.existsSync(envPath)) {
    console.error('Error: server/.env not found.');
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

async function main() {
  const env = loadEnv();
  const apiKey = env.SMALLEST_API_KEY;
  if (!apiKey) {
    console.error('Error: SMALLEST_API_KEY must be set in server/.env');
    process.exit(1);
  }

  const res = await fetch(`${API_BASE}/agent?offset=50`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });

  if (!res.ok) {
    console.error('API error:', res.status, await res.text());
    process.exit(1);
  }

  const json = await res.json();
  const agents = json.data?.agents || [];
  if (agents.length === 0) {
    console.log('No agents found.');
    return;
  }

  console.log('Your Atoms agents:\n');
  for (const a of agents) {
    console.log(`  ${a._id}  ${a.name || '(unnamed)'}`);
    if (a.description) console.log(`      ${a.description.substring(0, 60)}...`);
  }
  console.log('\nUse an _id with: node scripts/export-atoms-workflow.js <agentId>');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
