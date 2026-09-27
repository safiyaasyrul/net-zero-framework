// Patch script for LitlMatrix server.ts
// Run with: node patch_litmatrix.js
// This patches the litmatrix_get_manuscript_package tool to:
// 1. Remove bullet points from manuscript output
// 2. Make Introduction comprehensive for Q3 Scopus journal
// 3. Auto-fill characteristics table from records

const fs = require('fs');
const path = 'C:\\Users\\Dr Dyana\\Documents\\GitHub\\LitlMatrix\\apps\\litmatrix-chatgpt\\server.ts';

let content = fs.readFileSync(path, 'utf-8');

// Find and replace the rules block and add characteristicsTable
const oldBlock = `    const included = review.decisions.filter((d) => d.decision === "include" || Number(d.score) >= 50);
    const packageData = {
      reviewId,
      title: review.title,
      protocol: review.protocol,
      totalRecords: review.records.length,
      decisions: review.decisions,
      includedDecisionCount: included.length,
      unresolvedCount: review.records.length - review.decisions.length,
      introductionEvidence: introduction,
      detailedEvidence: detailed,
      characteristics: review.characteristics,
      citationStyleOptions: ["APA 7th", "IEEE", "Vancouver", "Harvard"],
      evidenceLimits: { introduction: 200, title: 200, results: 200, characteristics: 200, synthesis: 200, discussion: 200 },
      rules: [
        "Use only the supplied records and stored study characteristics.",
        "Do not introduce external papers, citations, authors, findings, statistics, or facts.",
        "Do not claim to have analyzed records that were not supplied to the current operation.",
        "If evidence is insufficient, say that it is insufficient rather than inventing support.",
        "You MUST write an incredibly detailed and expansive manuscript. Ensure every section (Introduction, Methods, Results, Synthesis, Discussion) is comprehensively elaborated.",
        "The complete manuscript MUST be extremely lengthy (targeting 4000-6000 words minimum) to guarantee a final comprehensive length of at least 12-15 pages.",
        "DO NOT output brief summaries. Expand each thematic narrative and discussion point with exhaustive substantive synthesis and deep methodological analysis."
      ],
    };`;

const newBlock = `    const included = review.decisions.filter((d) => d.decision === "include" || Number(d.score) >= 50);

    // Build the characteristics table automatically from stored data
    const characteristicsTable = review.characteristics.map((c: CharacteristicData, idx: number) => {
      const recordId = String(c.recordId ?? c.id ?? "");
      const record = review.records.find((r) => String(r.id) === recordId);
      return {
        no: idx + 1,
        recordId,
        author: record ? (Array.isArray(record.authors) ? (record.authors as string[])[0] ?? "" : "") : String(c.author ?? c.authors ?? ""),
        year: record ? String(record.year ?? "") : String(c.year ?? ""),
        title: record ? String(record.title ?? "") : String(c.title ?? ""),
        source: record ? String(record.source ?? record.journal ?? "") : String(c.source ?? c.journal ?? ""),
        studyDesign: String(c.studyDesign ?? c.methodology ?? c.method ?? c.design ?? ""),
        sampleSize: String(c.sampleSize ?? c.sample ?? c.participants ?? c.n ?? ""),
        country: String(c.country ?? c.location ?? c.region ?? ""),
        keyFindings: String(c.keyFindings ?? c.findings ?? c.results ?? c.outcome ?? c.mainFindings ?? ""),
        doi: record ? String(record.doi ?? "") : String(c.doi ?? ""),
      };
    });

    const packageData = {
      reviewId,
      title: review.title,
      protocol: review.protocol,
      totalRecords: review.records.length,
      decisions: review.decisions,
      includedDecisionCount: included.length,
      unresolvedCount: review.records.length - review.decisions.length,
      introductionEvidence: introduction,
      detailedEvidence: detailed,
      characteristics: review.characteristics,
      characteristicsTable,
      citationStyleOptions: ["APA 7th", "IEEE", "Vancouver", "Harvard"],
      evidenceLimits: { introduction: 200, title: 200, results: 200, characteristics: 200, synthesis: 200, discussion: 200 },
      rules: [
        "Use only the supplied records and stored study characteristics.",
        "Do not introduce external papers, citations, authors, findings, statistics, or facts.",
        "Do not claim to have analyzed records that were not supplied to the current operation.",
        "If evidence is insufficient, say that it is insufficient rather than inventing support.",
        "You MUST write an incredibly detailed and expansive manuscript. Ensure every section (Introduction, Methods, Results, Synthesis, Discussion) is comprehensively elaborated.",
        "The complete manuscript MUST be extremely lengthy (targeting 4000-6000 words minimum) to guarantee a final comprehensive length of at least 12-15 pages.",
        "DO NOT output brief summaries. Expand each thematic narrative and discussion point with exhaustive substantive synthesis and deep methodological analysis.",
        "FORMATTING: Never use bullet points, dashes, numbered lists, or any list-style formatting in the manuscript body. Write everything as flowing academic paragraphs in a formal scholarly style suitable for indexed journal publication (Q1-Q3 Scopus/WoS). Headings and subheadings are permitted, but the body text under them must be continuous prose, not lists.",
        "INTRODUCTION SECTION: The Introduction must be comprehensive and suitable for a Q3 or higher Scopus-indexed journal. It must include: (a) a broad contextual background establishing the field and its importance with citations from the supplied records, (b) a critical review of existing literature organized thematically (not as a list of papers), demonstrating how the supplied records collectively build the knowledge base, (c) a clear identification of research gaps showing what remains unresolved or contradictory in the reviewed literature, (d) a statement of the study's purpose/objective and how it addresses the identified gaps, and (e) a brief overview of the paper's structure. The Introduction should be at least 1500 words and must cite at least 60% of the supplied introduction evidence records.",
        "CHARACTERISTICS TABLE: A 'characteristicsTable' array is provided in this package. Each entry contains the author, year, title, source, studyDesign, sampleSize, country, keyFindings, and DOI, all pre-filled from the stored records and characteristics. When drafting the Results or Characteristics section, render this data directly as a formatted table. Do NOT ask the user to fill in the table manually. If any field is empty, write 'Not reported' in that cell. Present the complete table as-is with all rows populated.",
        "RESULTS AND SYNTHESIS: Present findings as thematic narratives, grouping studies by theme, methodology, or outcome patterns. Use in-text citations (Author, Year) throughout. Never present results as a list of individual study summaries. Instead, synthesize across studies to identify converging evidence, contradictions, and trends."
      ],
    };`;

if (content.includes(oldBlock)) {
  content = content.replace(oldBlock, newBlock);
  fs.writeFileSync(path, content, 'utf-8');
  console.log('SUCCESS: server.ts patched successfully.');
  console.log('Changes made:');
  console.log('  1. Added characteristicsTable auto-builder (pre-fills table from stored records)');
  console.log('  2. Added FORMATTING rule (no bullet points, continuous prose only)');
  console.log('  3. Added INTRODUCTION SECTION rule (comprehensive Q3 Scopus quality)');
  console.log('  4. Added CHARACTERISTICS TABLE rule (render pre-filled table, no manual entry)');
  console.log('  5. Added RESULTS AND SYNTHESIS rule (thematic narratives, not study-by-study)');
} else {
  console.error('ERROR: Could not find the target block in server.ts.');
  console.error('The file may have been modified. Please check manually.');
}
