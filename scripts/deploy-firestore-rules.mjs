import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!saJson) { console.error("FIREBASE_SERVICE_ACCOUNT_JSON not set"); process.exit(1); }

const sa = JSON.parse(saJson);
const projectId = sa.project_id;
console.log(`Deploying Firestore rules to project: ${projectId}`);

const rulesContent = readFileSync(join(__dirname, "../firestore.rules"), "utf8");

const admin = require(join(__dirname, "../artifacts/api-server/node_modules/firebase-admin/lib/index.js"));

const app = admin.initializeApp({ credential: admin.credential.cert(sa) }, "deploy-rules-" + Date.now());

async function deploy() {
  const tokenRes = await app.options.credential.getAccessToken();
  const token = tokenRes.access_token;

  const rulesetBody = JSON.stringify({
    source: { files: [{ name: "firestore.rules", content: rulesContent }] },
  });

  const createRes = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
    { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: rulesetBody }
  );
  const ruleset = await createRes.json();
  if (!ruleset.name) {
    console.error("Failed to create ruleset:", JSON.stringify(ruleset, null, 2));
    process.exit(1);
  }
  console.log("Created ruleset:", ruleset.name);

  const patchRes = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        release: { name: `projects/${projectId}/releases/cloud.firestore`, rulesetName: ruleset.name },
      }),
    }
  );
  const release = await patchRes.json();
  if (release.error) {
    console.error("Failed to update release:", JSON.stringify(release.error, null, 2));
    process.exit(1);
  }
  console.log("Release updated successfully:", release.name);
  console.log("Firestore rules deployed!");
  await app.delete();
}

deploy().catch((e) => { console.error(e); process.exit(1); });
