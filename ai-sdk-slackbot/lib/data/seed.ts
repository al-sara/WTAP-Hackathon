/**
 * Mock knowledge base for the MVP. In production each list is pulled from a
 * real RBC source (see the "Pulled from" comment on each); here it's static so
 * the demo is predictable. Edit freely — the tools only read from this file.
 */

// Themes the LLM classifies a question into. This is the ONLY thing that ever
// leaves a student's chat when they choose "share anonymously" (plus week + hub)
// — never names or free text. Keep in sync with `allowed_themes` in
// policies/decision.rego.
export const THEMES = [
  "tooling-access",
  "scope-unclear",
  "who-to-ask",
  "no-work-idle",
  "role-mismatch",
  "social-connection",
  "career-growth",
  "onboarding",
] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = {
  "tooling-access": "Tooling access",
  "scope-unclear": "Scope unclear",
  "who-to-ask": "Don't know who to ask",
  "no-work-idle": "No work / idle",
  "role-mismatch": "Role ≠ job description",
  "social-connection": "Wants to meet people",
  "career-growth": "Career growth",
  onboarding: "Onboarding",
};

// Pulled from: Slack API, public support channels only.
export const supportChannels = [
  {
    channel: "#ansible-support",
    topics: ["ansible", "playbook", "automation", "config", "inventory"],
    owners: ["Marcus Lee"],
    responseRate: "9/10 questions answered, median 25 min",
    pastThread: "“Playbook can't reach UAT hosts” — fixed by requesting the ansible-uat AD group",
  },
  {
    channel: "#pipeline-help",
    topics: ["pipeline", "jenkins", "ci", "cd", "build", "deploy", "tekton"],
    owners: ["Sana Qureshi"],
    responseRate: "9/10 questions answered, median 40 min",
    pastThread: "“Build stuck on artifact upload” — needs an Artifactory service account",
  },
  {
    channel: "#cloud-azure",
    topics: ["azure", "cloud", "aks", "subscription", "resource group", "openai", "ai foundry"],
    owners: ["Daniel Okafor"],
    responseRate: "8/10 questions answered, median 1 h",
    pastThread: "“How do I get access to Azure OpenAI in dev?” — request via the Cloud Access form, ~2 days",
  },
  {
    channel: "#cloud-aws",
    topics: ["aws", "s3", "lambda", "bedrock", "iam"],
    owners: ["Priyanka Shah"],
    responseRate: "9/10 questions answered, median 30 min",
    pastThread: "“Bedrock model access denied” — IAM role needs the genai-sandbox policy",
  },
  {
    channel: "#borealis-llm-platform",
    topics: ["llm", "ai", "genai", "copilot", "claude", "gpt", "gemini", "rag", "embedding", "agent", "borealis"],
    owners: ["Elena Petrova"],
    responseRate: "9/10 questions answered, median 45 min",
    pastThread: "“Team only has old Copilot — how do we get an LLM API?” — onboard via the Borealis platform intake form; sandbox keys in ~1 day",
  },
  {
    channel: "#data-platform",
    topics: ["sql", "databricks", "spark", "data", "etl", "warehouse", "snowflake", "python"],
    owners: ["Kevin Tran"],
    responseRate: "9/10 questions answered, median 35 min",
    pastThread: "“Databricks workspace access for co-ops” — manager approves in ServiceNow, same day",
  },
];

// Pulled from: GitHub repo metadata (CODEOWNERS + commit history).
export const codeOwners = [
  { repo: "tno/ansible-playbooks", topics: ["ansible", "automation"], owners: ["Marcus Lee", "Ravi Patel"], lastCommit: "2026-11-14", stillHere: true },
  { repo: "tno/genai-gateway", topics: ["llm", "ai", "genai", "rag", "agent", "borealis"], owners: ["Elena Petrova", "Tom Becker"], lastCommit: "2026-11-18", stillHere: true },
  { repo: "tno/legacy-chatbot", topics: ["llm", "ai", "chatbot"], owners: ["Greg Whitman"], lastCommit: "2024-03-02", stillHere: false },
  { repo: "tno/infra-pipelines", topics: ["pipeline", "jenkins", "ci", "tekton"], owners: ["Sana Qureshi"], lastCommit: "2026-11-12", stillHere: true },
  { repo: "data/etl-jobs", topics: ["databricks", "spark", "etl", "python", "sql"], owners: ["Kevin Tran", "Mei Lin"], lastCommit: "2026-11-10", stillHere: true },
];

// Pulled from: project briefs / docs of shipped intern projects.
export const pastProjects = [
  {
    year: 2024,
    title: "Incident summarizer with RAG over runbooks",
    stack: ["python", "llm", "rag", "borealis", "azure"],
    team: "Ops Intelligence",
    internNow: "Jordan Kim (returned as co-op, 2026)",
    doc: "TNO Confluence › Intern Projects › 2024 › Incident Summarizer",
    lesson: "LLM access took 2 weeks — request Borealis sandbox on day 1.",
  },
  {
    year: 2025,
    title: "Ansible drift detector",
    stack: ["ansible", "python", "pipeline"],
    team: "Platform Engineering",
    internNow: "Graduated",
    doc: "TNO Confluence › Intern Projects › 2025 › Drift Detector",
    lesson: "Ask #ansible-support for UAT inventory access early.",
  },
  {
    year: 2025,
    title: "Databricks cost dashboard",
    stack: ["databricks", "sql", "python", "data"],
    team: "Data Platform",
    internNow: "Aisha Rahman (new grad, Data Platform)",
    doc: "TNO Confluence › Intern Projects › 2025 › Cost Dashboard",
    lesson: "Workspace access is same-day if your manager files the ServiceNow ticket.",
  },
  {
    year: 2024,
    title: "Self-serve AWS sandbox provisioning",
    stack: ["aws", "iam", "pipeline", "terraform"],
    team: "Cloud Enablement",
    internNow: "Graduated",
    doc: "TNO Confluence › Intern Projects › 2024 › AWS Sandbox",
    lesson: "Pair with #cloud-aws owners for IAM reviews.",
  },
];

// Pulled from: opt-in peer index (students choose to be findable).
export const peers = [
  {
    name: "Jordan Kim",
    role: "AI/ML co-op",
    team: "Ops Intelligence",
    hub: "Toronto – WaterPark Place",
    skills: ["python", "llm", "rag", "borealis", "azure"],
    interests: ["bouldering", "matcha", "board games"],
    hasCapacity: true,
    optedIn: true,
  },
  {
    name: "Aisha Rahman",
    role: "Data Engineer (new grad)",
    team: "Data Platform",
    hub: "Toronto – RBC Centre",
    skills: ["databricks", "sql", "spark", "python"],
    interests: ["running", "matcha", "photography"],
    hasCapacity: false,
    optedIn: true,
  },
  {
    name: "Leo Martins",
    role: "Technical Systems Analyst co-op",
    team: "Platform Engineering",
    hub: "Toronto – WaterPark Place",
    skills: ["ansible", "pipeline", "jenkins", "linux"],
    interests: ["basketball", "cooking"],
    hasCapacity: true,
    optedIn: true,
  },
  {
    name: "Chloe Nguyen",
    role: "Software Developer co-op",
    team: "Digital Banking",
    hub: "Montreal",
    skills: ["typescript", "react", "aws"],
    interests: ["matcha", "k-dramas", "hiking"],
    hasCapacity: false,
    optedIn: true,
  },
  {
    name: "Sam Patel",
    role: "Data Engineer co-op",
    team: "Risk Analytics",
    hub: "Toronto – RBC Centre",
    skills: ["sql", "python", "databricks"],
    interests: ["chess", "coffee"],
    hasCapacity: true,
    optedIn: true,
  },
  {
    name: "Hidden Student",
    role: "Co-op",
    team: "—",
    hub: "Toronto – RBC Centre",
    skills: ["llm", "python"],
    interests: ["matcha"],
    hasCapacity: true,
    optedIn: false, // never surfaced — proves the opt-in filter works
  },
];

// Pulled from: RBC Connect public page.
export const events = [
  { title: "Welcome to Tech: Navigating TNO", date: "Every Monday, 12:00", topics: ["onboarding", "who-to-ask"], where: "Hybrid" },
  { title: "GenAI 101 on the Borealis platform", date: "Nov 26, 14:00", topics: ["llm", "ai", "genai", "career-growth"], where: "WaterPark Place + Webex" },
  { title: "Co-op Matcha Social", date: "Nov 27, 15:30", topics: ["social", "matcha", "social-connection"], where: "RBC Centre, 3rd floor café" },
  { title: "Databricks upskilling sprint", date: "Dec 2–4", topics: ["databricks", "data", "sql", "career-growth"], where: "Virtual" },
  { title: "How to run your own 1:1 (for co-ops)", date: "Dec 3, 11:00", topics: ["career-growth", "scope-unclear", "role-mismatch"], where: "Virtual" },
];

// Pulled from: Quest team-matching form + posted job descriptions.
export const jobDescriptions = [
  {
    role: "Data Engineer co-op",
    expected: ["Build and maintain ETL pipelines", "Write SQL / PySpark transformations", "Data quality checks", "Document data lineage"],
    whatPastStudentsSaid: "Mostly SQL + dashboarding on some teams; Spark only on Data Platform.",
  },
  {
    role: "AI/ML co-op",
    expected: ["Prototype ML / LLM solutions", "Evaluate models", "Build data pipelines for training/eval", "Present findings to stakeholders"],
    whatPastStudentsSaid: "First 2–3 weeks often blocked on LLM platform access.",
  },
  {
    role: "Technical Systems Analyst co-op",
    expected: ["Gather requirements", "Automate operational tasks (Ansible/scripts)", "Support incident triage", "Write runbooks"],
    whatPastStudentsSaid: "More automation than analysis on Platform teams.",
  },
  {
    role: "Software Developer co-op",
    expected: ["Ship features in an agile team", "Write tests", "Code reviews", "On-call shadowing"],
    whatPastStudentsSaid: "Matches JD on most teams.",
  },
];

// Demo identity for whoever is chatting. In production this comes from the
// Quest record for the Slack user.
export const defaultStudentProfile = {
  role: "AI/ML co-op",
  team: "Enterprise AI Group",
  hub: "Toronto – WaterPark Place",
};
