#!/usr/bin/env node
/**
 * Duplicate the Calendar Receptionist agent: create a new agent with the same
 * config (voice, prompt, etc.) and workflow. Replaces {{WEBHOOK_BASE_URL}} with your URL.
 *
 * Prerequisites:
 *   - atoms-agent-config.json (from export-atoms-workflow.js) OR atoms-agent-workflow.json
 *   - server/.env with SMALLEST_API_KEY
 *   - WEBHOOK_BASE_URL in server/.env or pass as arg
 *
 * Run: node scripts/setup-atoms-agent.js [WEBHOOK_BASE_URL]
 */

const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '../server/.env');
const CONFIG_PATH = path.join(__dirname, '../atoms-agent-config.json');
const WORKFLOW_PATH = path.join(__dirname, '../atoms-agent-workflow.json');
const API_BASE = process.env.ATOMS_API_BASE || 'https://api.smallest.ai/atoms/v1';
const PLACEHOLDER = '{{WEBHOOK_BASE_URL}}';

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

function replacePlaceholder(obj, webhookBaseUrl) {
  if (typeof obj === 'string') return obj.split(PLACEHOLDER).join(webhookBaseUrl);
  if (Array.isArray(obj)) return obj.map((item) => replacePlaceholder(item, webhookBaseUrl));
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = replacePlaceholder(v, webhookBaseUrl);
    return out;
  }
  return obj;
}

function buildCreateAgentBody(agent) {
  const body = {
    name: agent.name || 'Calendar Receptionist',
    description: agent.description || 'AI receptionist for scheduling meetings via voice',
    workflowType: agent.workflowType || 'workflow_graph'
  };
  if (agent.globalPrompt) body.globalPrompt = agent.globalPrompt;
  if (agent.synthesizer) body.synthesizer = agent.synthesizer;
  if (agent.language) body.language = agent.language;
  if (agent.slmModel) body.slmModel = agent.slmModel;
  if (agent.backgroundSound) body.backgroundSound = agent.backgroundSound;
  if (agent.defaultVariables && Object.keys(agent.defaultVariables).length) body.defaultVariables = agent.defaultVariables;
  return body;
}

async function main() {
  const env = loadEnv();
  const apiKey = env.SMALLEST_API_KEY;
  let webhookBaseUrl = process.argv[2] || env.PUBLIC_WEBHOOK_BASE_URL || env.WEBHOOK_BASE_URL;

  if (!apiKey) {
    console.error('Error: SMALLEST_API_KEY must be set in server/.env');
    process.exit(1);
  }

  if (!webhookBaseUrl) {
    console.error('Error: WEBHOOK_BASE_URL required.');
    console.error('Usage: node scripts/setup-atoms-agent.js https://your-ngrok.ngrok-free.dev');
    process.exit(1);
  }
  webhookBaseUrl = webhookBaseUrl.replace(/\/$/, '');

  let config;
  if (fs.existsSync(CONFIG_PATH)) {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    config.agent = replacePlaceholder(config.agent || {}, webhookBaseUrl);
    config.workflow = replacePlaceholder(config.workflow || {}, webhookBaseUrl);
  } else if (fs.existsSync(WORKFLOW_PATH)) {
    const wf = replacePlaceholder(JSON.parse(fs.readFileSync(WORKFLOW_PATH, 'utf8')), webhookBaseUrl);
    config = { agent: {}, workflow: wf };
  } else {
    console.error('Error: atoms-agent-config.json or atoms-agent-workflow.json not found.');
    console.error('Repo owner should run: node scripts/export-atoms-workflow.js');
    process.exit(1);
  }

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };

  console.log('Creating agent with your config...');
  const createBody = buildCreateAgentBody(config.agent);
  const createRes = await fetch(`${API_BASE}/agent`, {
    method: 'POST',
    headers,
    body: JSON.stringify(createBody)
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    console.error('Create agent failed:', createRes.status, text);
    process.exit(1);
  }

  const createJson = await createRes.json();
  const agentId = createJson.data;
  if (!agentId) {
    console.error('Unexpected create response:', JSON.stringify(createJson, null, 2));
    process.exit(1);
  }

  console.log('Agent created:', agentId);
  console.log('Applying workflow...');

  const wf = config.workflow;
  const wfType = wf.type || 'workflow_graph';
  const wfData = wf.data || wf;
  const workflowPayload = { type: wfType };

  if (wfType === 'single_prompt') {
    workflowPayload.singlePromptConfig = wfData;
  } else {
    workflowPayload.workflowGraph = wfData;
  }

  const updateRes = await fetch(`${API_BASE}/workflow/${agentId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(workflowPayload)
  });

  if (!updateRes.ok) {
    const text = await updateRes.text();
    console.error('Update workflow failed:', updateRes.status, text);
    console.error('Agent created but workflow may be incomplete. Agent ID:', agentId);
    process.exit(1);
  }

  console.log('\n=== Duplicate complete ===');
  console.log('Add to client/.env:');
  console.log(`VITE_SMALLEST_ASSISTANT_ID=${agentId}`);
  console.log('\nAdd to server/.env:');
  console.log(`SMALLEST_RECEPTIONIST_AGENT_ID=${agentId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
