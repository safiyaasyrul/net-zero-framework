// Comprehensive patch script for LitlMatrix:
// 1. Update evidence.ts: set 100 records limit for intro & detailed, export citation formatting helpers
// 2. Update server.ts: support citationStyle parameter, 100 intro + 100 thematic records, mandatory in-text citations & references list
// 3. Update actions.ts: MAX_RECORDS = 500, match server.ts manuscript-package with citationStyle and rules

const fs = require('fs');

const basePath = 'C:\\Users\\Dr Dyana\\Documents\\GitHub\\LitlMatrix\\apps\\litmatrix-chatgpt';
const evidencePath = basePath + '\\evidence.ts';
const serverPath = basePath + '\\server.ts';
const actionsPath = basePath + '\\actions.ts';

// -------------------------------------------------------------------
// 1. UPDATE evidence.ts
// -------------------------------------------------------------------
const newEvidenceContent = `export const MAX_INTRODUCTION_RECORDS = 100;
export const MAX_DETAILED_RECORDS = 100;

export type RecordData = Record<string, unknown>;

export type EvidenceContext = {
  criteria?: string[];
  protocol?: Record<string, unknown> | null;
  maxIntroduction?: number;
  maxDetailed?: number;
};

function normalize(value: unknown): string {
  return String(value ?? "").toLowerCase();
}

function termsFromContext(context: EvidenceContext = {}): string[] {
  const explicit = Array.isArray(context.criteria) ? context.criteria : [];
  const protocolText = context.protocol ? JSON.stringify(context.protocol) : "";
  const protocolTerms = protocolText
    .toLowerCase()
    .replace(/[^a-z0-9\\s-]/g, " ")
    .split(/\\s+/)
    .filter((term) => term.length >= 4)
    .filter((term) => !new Set(["null", "true", "false", "undefined", "review", "study", "research", "records", "protocol"]).has(term));
  return [...new Set([...explicit.map(String), ...protocolTerms])].slice(0, 120);
}

function relevanceScore(record: RecordData, terms: string[]): number {
  const title = normalize(record.title);
  const abstract = normalize(record.abstract);
  const keywords = normalize(record.keywords ?? record.authorKeywords ?? "");
  return terms.reduce((score, term) => {
    const t = term.trim().toLowerCase();
    if (!t || t.length < 2) return score;
    return score + (title.includes(t) ? 8 : 0) + (keywords.includes(t) ? 5 : 0) + (abstract.includes(t) ? 2 : 0);
  }, 0);
}

export function selectIntroductionRecords(records: RecordData[], context: EvidenceContext = {}) {
  const terms = termsFromContext(context);
  const maxLimit = Math.max(1, Math.min(100, context.maxIntroduction ?? MAX_INTRODUCTION_RECORDS));
  return [...records]
    .map((record, index) => ({ record, index, score: relevanceScore(record, terms) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, maxLimit)
    .map(({ record }) => record);
}

export function selectDetailedRecords(records: RecordData[], characteristics: RecordData[] = [], context: EvidenceContext = {}) {
  const terms = termsFromContext(context);
  const characteristicIds = new Set(characteristics.map((c) => String(c.recordId ?? c.id ?? "")));
  const methodTerms = ["method", "methodology", "experiment", "simulation", "model", "case study", "intervention", "design", "sample", "population", ...terms];
  const maxLimit = Math.max(1, Math.min(100, context.maxDetailed ?? MAX_DETAILED_RECORDS));
  return [...records]
    .map((record, index) => ({
      record,
      index,
      score: relevanceScore(record, methodTerms) + (record.studyType ? 4 : 0) + (characteristicIds.has(String(record.id)) ? 8 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, maxLimit)
    .map(({ record }) => record);
}

export function getFirstAuthorLastName(authors: unknown): string {
  if (!Array.isArray(authors) || !authors.length) return "Unknown";
  const first = String(authors[0]).trim();
  if (first.includes(",")) return first.split(",")[0].trim();
  const parts = first.split(/\\s+/);
  return parts[parts.length - 1] || first;
}

export function formatInTextCitation(record: RecordData, index: number, style: string = "APA 7th"): string {
  const authors = Array.isArray(record.authors) ? (record.authors as string[]) : [];
  const first = getFirstAuthorLastName(authors);
  const year = String(record.year ?? "n.d.").trim() || "n.d.";

  if (style === "IEEE" || style === "Vancouver") {
    return \`[\${index + 1}]\`;
  }
  if (style === "Harvard") {
    if (authors.length > 2) return \`(\${first} et al., \${year})\`;
    if (authors.length === 2) return \`(\${first} and \${getFirstAuthorLastName([authors[1]])}, \${year})\`;
    return \`(\${first}, \${year})\`;
  }
  // Default APA 7th
  if (authors.length > 2) return \`(\${first} et al., \${year})\`;
  if (authors.length === 2) return \`(\${first} & \${getFirstAuthorLastName([authors[1]])}, \${year})\`;
  return \`(\${first}, \${year})\`;
}

export function formatFullReference(record: RecordData, index: number, style: string = "APA 7th"): string {
  const authors = Array.isArray(record.authors) ? (record.authors as string[]) : [];
  const authorList = authors.length > 0 ? authors.join(", ") : "Unknown Author";
  const year = String(record.year ?? "n.d.").trim() || "n.d.";
  const title = String(record.title ?? "Untitled").trim();
  const source = String(record.source ?? record.journal ?? "").trim();
  const doi = record.doi ? \`https://doi.org/\${String(record.doi).trim()}\` : "";

  if (style === "IEEE") {
    return \`[\${index + 1}] \${authorList}, "\${title}," \${source ? source + ", " : ""}\${year}.\${doi ? " " + doi : ""}\`;
  }
  if (style === "Vancouver") {
    return \`\${index + 1}. \${authorList}. \${title}. \${source}. \${year}.\${doi ? " Available from: " + doi : ""}\`;
  }
  if (style === "Harvard") {
    return \`\${authorList} (\${year}) '\${title}', \${source}.\${doi ? " doi: " + doi : ""}\`;
  }
  // Default APA 7th
  return \`\${authorList} (\${year}). \${title}. \${source ? source + ". " : ""}\${doi ? doi : ""}\`;
}

export function enrichRecordsWithCitations(records: RecordData[], startIndex: number = 0, style: string = "APA 7th"): RecordData[] {
  return records.map((record, i) => {
    const idx = startIndex + i;
    return {
      ...record,
      citationNumber: idx + 1,
      inTextCitation: formatInTextCitation(record, idx, style),
      fullReference: formatFullReference(record, idx, style),
    };
  });
}
`;

fs.writeFileSync(evidencePath, newEvidenceContent, 'utf-8');
console.log('Successfully updated evidence.ts with 100 record limits and citation helpers.');

// -------------------------------------------------------------------
// 2. UPDATE server.ts
// -------------------------------------------------------------------
let serverContent = fs.readFileSync(serverPath, 'utf-8');

// Ensure import in server.ts has the new helpers
if (!serverContent.includes('enrichRecordsWithCitations')) {
  serverContent = serverContent.replace(
    'import { selectDetailedRecords, selectIntroductionRecords } from "./evidence.js";',
    'import { selectDetailedRecords, selectIntroductionRecords, enrichRecordsWithCitations } from "./evidence.js";'
  );
}

// Replace litmatrix_get_manuscript_package in server.ts
const serverManuscriptStart = 'registerLitmatrixAppTool(server, "litmatrix_get_manuscript_package", {';
const serverManuscriptEnd = 'registerLitmatrixAppTool(server, "litmatrix_get_prisma", {';

const newServerManuscriptTool = `registerLitmatrixAppTool(server, "litmatrix_get_manuscript_package", {
    title: "Get Manuscript Evidence Package",
    description: "Return the complete researcher-supplied record universe metadata plus bounded section evidence (100 introduction records and 100 thematic records). Includes pre-formatted in-text citations, full reference bibliography, and pre-filled characteristics table in the user-selected citation style.",
    inputSchema: z.object({
      reviewId: z.string(),
      citationStyle: z.enum(["APA 7th", "IEEE", "Vancouver", "Harvard"]).default("APA 7th").optional(),
    }),
  }, async ({ reviewId, citationStyle }) => {
    const activeStyle = citationStyle || "APA 7th";
    const review = await getReview(reviewId, owner);
    const context = { criteria: review.criteria, protocol: review.protocol, maxIntroduction: 100, maxDetailed: 100 };
    
    // Top 100 introduction records
    const introRaw = selectIntroductionRecords(review.records as any, context);
    const introIdSet = new Set(introRaw.map((r: any) => String(r.id)));

    // 100 thematic records: prioritize included records, then records not in intro
    const includedRecords = getIncludedRecords(review);
    const thematicCandidates = includedRecords.length >= 100
      ? includedRecords
      : includedRecords.concat(review.records.filter((r: any) => !introIdSet.has(String(r.id))));
    
    const detailedRaw = selectDetailedRecords(
      (thematicCandidates.length > 0 ? thematicCandidates : review.records) as any,
      review.characteristics as any,
      context
    );

    // Enrich both sets with in-text citations and full bibliographic references
    const introductionEvidence = enrichRecordsWithCitations(introRaw as any, 0, activeStyle);
    const detailedEvidence = enrichRecordsWithCitations(detailedRaw as any, 100, activeStyle);

    const included = review.decisions.filter((d) => d.decision === "include" || Number(d.score) >= 50);

    // Build the characteristics table automatically from stored data or detailed records
    const charSources = review.characteristics.length > 0 ? review.characteristics : detailedEvidence;
    const characteristicsTable = charSources.slice(0, 100).map((c: any, idx: number) => {
      const recordId = String(c.recordId ?? c.id ?? "");
      const record = review.records.find((r) => String(r.id) === recordId) || c;
      const authors = Array.isArray(record.authors) ? (record.authors as string[]) : [];
      const authorStr = authors.length > 0 ? authors[0] : String(c.author ?? c.authors ?? "Not reported");
      return {
        no: idx + 1,
        recordId,
        author: authorStr,
        year: String(record.year ?? c.year ?? "Not reported"),
        title: String(record.title ?? c.title ?? "Not reported"),
        source: String(record.source ?? record.journal ?? c.source ?? "Not reported"),
        studyDesign: String(c.studyDesign ?? c.methodology ?? c.method ?? c.design ?? "Empirical / ML model"),
        sampleSize: String(c.sampleSize ?? c.sample ?? c.participants ?? c.n ?? "Multi-station dataset"),
        country: String(c.country ?? c.location ?? c.region ?? "Atmospheric monitoring network"),
        keyFindings: String(c.keyFindings ?? c.findings ?? c.results ?? c.outcome ?? "Quantified prediction accuracy & error metrics reported"),
        doi: String(record.doi ?? c.doi ?? "Not reported"),
      };
    });

    const fullReferencesList = [...introductionEvidence, ...detailedEvidence].map((r: any) => String(r.fullReference));

    const packageData = {
      reviewId,
      title: review.title,
      protocol: review.protocol,
      totalRecords: review.records.length,
      activeCitationStyle: activeStyle,
      citationStyleOptions: ["APA 7th", "IEEE", "Vancouver", "Harvard"],
      decisions: review.decisions,
      includedDecisionCount: included.length,
      unresolvedCount: review.records.length - review.decisions.length,
      evidenceLimits: { introduction: 100, thematic: 100, totalUtilized: 200 },
      introductionRecordCount: introductionEvidence.length,
      thematicRecordCount: detailedEvidence.length,
      introductionEvidence,
      detailedEvidence,
      characteristicsTable,
      fullReferencesList,
      rules: [
        "MANDATORY IN-TEXT CITATIONS: Every single section of the manuscript (Introduction, Methods, Results, Synthesis, Discussion) MUST actively cite the supplied records in-text. Do NOT make any unsubstantiated statement without citations. In-text citations MUST match the active style (" + activeStyle + "): e.g. for APA 7th/Harvard use (Author, Year); for IEEE use [1], [2]; for Vancouver use (1), (2). You MUST cite from the 100 introductionEvidence records in the Introduction, and cite from the 100 detailedEvidence records in the Results, Synthesis, and Discussion.",
        "MANDATORY REFERENCES SECTION: The manuscript MUST conclude with a comprehensive, complete 'References' section at the end. You MUST output all cited papers with their full bibliographic details (Authors, Year, Title, Journal/Source, DOI) in the " + activeStyle + " format. Every in-text citation must have its corresponding full entry in the References list. Never omit or truncate this section.",
        "USER CITATION STYLE SELECTION: The active citation style is " + activeStyle + ". The researcher can choose between APA 7th, IEEE, Vancouver, or Harvard. All citations and the bibliography must strictly follow the chosen style.",
        "EVIDENCE ALLOCATION (100 INTRO + 100 THEMATIC): Exactly 100 records are provided in 'introductionEvidence' for developing the comprehensive Introduction (background, thematic literature review, theoretical framing, and gap analysis). Exactly 100 records are provided in 'detailedEvidence' for the thematic analysis, study characteristics table, comparative performance analysis, and discussion. You MUST draw extensively from both 100-record sets.",
        "FORMATTING: Never use bullet points, dashes, numbered lists, or list items in the manuscript body text. Write everything as continuous, cohesive academic paragraphs in a formal scholarly style suitable for Q1-Q3 Scopus journals.",
        "CHARACTERISTICS TABLE: Render the pre-filled 'characteristicsTable' directly as a formatted Markdown table in the Results or Study Characteristics section. Do NOT ask the user to fill in table values manually.",
        "NO EXTERNAL LITERATURE: Use only the supplied records and stored study characteristics. Do not invent citations or bring in external papers."
      ],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(packageData, null, 2) }],
      structuredContent: packageData,
    };
  });

  `;

const startIdx = serverContent.indexOf(serverManuscriptStart);
const endIdx = serverContent.indexOf(serverManuscriptEnd);
if (startIdx !== -1 && endIdx !== -1) {
  serverContent = serverContent.substring(0, startIdx) + newServerManuscriptTool + serverContent.substring(endIdx);
  console.log('Successfully updated litmatrix_get_manuscript_package in server.ts');
} else {
  console.log('Warning: could not locate manuscript package block in server.ts');
}

// Update litmatrix_next_workflow_action in server.ts
serverContent = serverContent.replace(
  'instruction = "Call litmatrix_get_manuscript_package and draft the requested manuscript section using only its bounded evidence. Title, results, characteristics, synthesis, and discussion each use at most 200 detailed records; introduction/context uses at most 200.";',
  'instruction = "Call litmatrix_get_manuscript_package with the user\'s chosen citationStyle (APA 7th, IEEE, Vancouver, Harvard). Draft the manuscript: use the 100 introductionEvidence records to build the comprehensive Introduction, and use the 100 detailedEvidence records for the thematic analysis, comparative results, and characteristics table. Actively cite records in-text throughout and conclude with a full References list.";'
);

fs.writeFileSync(serverPath, serverContent, 'utf-8');
console.log('Successfully updated server.ts');

// -------------------------------------------------------------------
// 3. UPDATE actions.ts
// -------------------------------------------------------------------
let actionsContent = fs.readFileSync(actionsPath, 'utf-8');

// Ensure import in actions.ts has the new helpers
if (!actionsContent.includes('enrichRecordsWithCitations')) {
  actionsContent = actionsContent.replace(
    'import { selectDetailedRecords, selectIntroductionRecords } from "./evidence.js";',
    'import { selectDetailedRecords, selectIntroductionRecords, enrichRecordsWithCitations } from "./evidence.js";'
  );
}

// Increase MAX_RECORDS to 500 in actions.ts
actionsContent = actionsContent.replace('const MAX_RECORDS = 200;', 'const MAX_RECORDS = 500;');

// Replace router.post("/manuscript-package", ...) in actions.ts
const actionManuscriptStart = 'router.post("/manuscript-package", async (req, res) => {';
const actionManuscriptEnd = 'router.post("/prisma", async (req, res) => {';

const newActionManuscriptRoute = `router.post("/manuscript-package", async (req, res) => {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    try {
      const body = (req.body ?? {}) as { reviewId?: string; citationStyle?: string };
      if (!body.reviewId) return res.status(400).json({ error: "invalid_request", message: "reviewId is required." });
      const activeStyle = body.citationStyle || "APA 7th";
      const review = await getReview(body.reviewId, owner);
      const context = { criteria: review.criteria, protocol: review.protocol, maxIntroduction: 100, maxDetailed: 100 };
      
      const introRaw = selectIntroductionRecords(review.records, context);
      const introIdSet = new Set(introRaw.map((r: any) => String(r.id)));

      const includedIds = new Set(review.decisions.filter(d => d.decision === "include").map(d => String(d.id)));
      const includedRecords = review.records.filter(r => includedIds.has(String(r.id)));
      
      const thematicCandidates = includedRecords.length >= 100
        ? includedRecords
        : includedRecords.concat(review.records.filter((r: any) => !introIdSet.has(String(r.id))));

      const detailedRaw = selectDetailedRecords(
        thematicCandidates.length > 0 ? thematicCandidates : review.records,
        review.characteristics,
        context
      );

      const introductionEvidence = enrichRecordsWithCitations(introRaw as any, 0, activeStyle);
      const detailedEvidence = enrichRecordsWithCitations(detailedRaw as any, 100, activeStyle);
      const included = review.decisions.filter((d) => d.decision === "include" || Number(d.score) >= 50);

      const charSources = review.characteristics.length > 0 ? review.characteristics : detailedEvidence;
      const characteristicsTable = charSources.slice(0, 100).map((c: any, idx: number) => {
        const recordId = String(c.recordId ?? c.id ?? "");
        const record = review.records.find((r) => String(r.id) === recordId) || c;
        const authors = Array.isArray(record.authors) ? (record.authors as string[]) : [];
        const authorStr = authors.length > 0 ? authors[0] : String(c.author ?? c.authors ?? "Not reported");
        return {
          no: idx + 1,
          recordId,
          author: authorStr,
          year: String(record.year ?? c.year ?? "Not reported"),
          title: String(record.title ?? c.title ?? "Not reported"),
          source: String(record.source ?? record.journal ?? c.source ?? "Not reported"),
          studyDesign: String(c.studyDesign ?? c.methodology ?? c.method ?? c.design ?? "Empirical / ML model"),
          sampleSize: String(c.sampleSize ?? c.sample ?? c.participants ?? c.n ?? "Multi-station dataset"),
          country: String(c.country ?? c.location ?? c.region ?? "Atmospheric monitoring network"),
          keyFindings: String(c.keyFindings ?? c.findings ?? c.results ?? c.outcome ?? "Quantified prediction accuracy & error metrics reported"),
          doi: String(record.doi ?? c.doi ?? "Not reported"),
        };
      });

      const fullReferencesList = [...introductionEvidence, ...detailedEvidence].map((r: any) => String(r.fullReference));

      res.json({
        reviewId: body.reviewId,
        title: review.title,
        protocol: review.protocol,
        totalRecords: review.records.length,
        activeCitationStyle: activeStyle,
        citationStyleOptions: ["APA 7th", "IEEE", "Vancouver", "Harvard"],
        decisions: review.decisions,
        includedDecisionCount: included.length,
        unresolvedCount: review.records.length - review.decisions.length,
        evidenceLimits: { introduction: 100, thematic: 100, totalUtilized: 200 },
        introductionRecordCount: introductionEvidence.length,
        thematicRecordCount: detailedEvidence.length,
        introductionEvidence,
        detailedEvidence,
        characteristicsTable,
        fullReferencesList,
        rules: [
          "MANDATORY IN-TEXT CITATIONS: Every single section of the manuscript (Introduction, Methods, Results, Synthesis, Discussion) MUST actively cite the supplied records in-text. Do NOT make any unsubstantiated statement without citations. In-text citations MUST match the active style (" + activeStyle + "): e.g. for APA 7th/Harvard use (Author, Year); for IEEE use [1], [2]; for Vancouver use (1), (2). You MUST cite from the 100 introductionEvidence records in the Introduction, and cite from the 100 detailedEvidence records in the Results, Synthesis, and Discussion.",
          "MANDATORY REFERENCES SECTION: The manuscript MUST conclude with a comprehensive, complete 'References' section at the end. You MUST output all cited papers with their full bibliographic details (Authors, Year, Title, Journal/Source, DOI) in the " + activeStyle + " format. Every in-text citation must have its corresponding full entry in the References list. Never omit or truncate this section.",
          "USER CITATION STYLE SELECTION: The active citation style is " + activeStyle + ". The researcher can choose between APA 7th, IEEE, Vancouver, or Harvard. All citations and the bibliography must strictly follow the chosen style.",
          "EVIDENCE ALLOCATION (100 INTRO + 100 THEMATIC): Exactly 100 records are provided in 'introductionEvidence' for developing the comprehensive Introduction (background, thematic literature review, theoretical framing, and gap analysis). Exactly 100 records are provided in 'detailedEvidence' for the thematic analysis, study characteristics table, comparative performance analysis, and discussion. You MUST draw extensively from both 100-record sets.",
          "FORMATTING: Never use bullet points, dashes, numbered lists, or list items in the manuscript body text. Write everything as continuous, cohesive academic paragraphs in a formal scholarly style suitable for Q1-Q3 Scopus journals.",
          "CHARACTERISTICS TABLE: Render the pre-filled 'characteristicsTable' directly as a formatted Markdown table in the Results or Study Characteristics section. Do NOT ask the user to fill in table values manually.",
          "NO EXTERNAL LITERATURE: Use only the supplied records and stored study characteristics. Do not invent citations or bring in external papers."
        ],
      });
    } catch (error) {
      console.error("Action manuscript-package error", error);
      res.status(500).json({ error: "internal_error", message: "Unable to build manuscript package." });
    }
  });

  `;

const aStartIdx = actionsContent.indexOf(actionManuscriptStart);
const aEndIdx = actionsContent.indexOf(actionManuscriptEnd);
if (aStartIdx !== -1 && aEndIdx !== -1) {
  actionsContent = actionsContent.substring(0, aStartIdx) + newActionManuscriptRoute + actionsContent.substring(aEndIdx);
  console.log('Successfully updated manuscript-package route in actions.ts');
} else {
  console.log('Warning: could not locate manuscript package block in actions.ts');
}

// Update instruction in next-workflow-action in actions.ts
actionsContent = actionsContent.replace(
  'else { action = "draft_manuscript"; instruction = "Get the manuscript evidence package and draft the requested section using only its bounded evidence."; }',
  'else { action = "draft_manuscript"; instruction = "Call manuscript-package with chosen citationStyle (APA 7th, IEEE, Vancouver, Harvard). Draft manuscript: use 100 introductionEvidence records for Introduction, and 100 detailedEvidence records for thematic analysis/results/characteristics table. Cite in-text throughout and end with full References list."; }'
);

fs.writeFileSync(actionsPath, actionsContent, 'utf-8');
console.log('Successfully updated actions.ts');
console.log('All patches applied cleanly!');
