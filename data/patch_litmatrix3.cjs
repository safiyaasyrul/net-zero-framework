// Patch script to update LitlMatrix server.ts and actions.ts with strict PICOC and search string filter rules
const fs = require('fs');

const basePath = 'C:\\Users\\Dr Dyana\\Documents\\GitHub\\LitlMatrix\\apps\\litmatrix-chatgpt';
const serverPath = basePath + '\\server.ts';
const actionsPath = basePath + '\\actions.ts';

// 1. Patch server.ts start_review
let serverContent = fs.readFileSync(serverPath, 'utf-8');

const oldServerStart = `  }, async ({ title, protocol }) => {
    const reviewId = createReviewId();
    const review: Review = {
      title: title?.trim() || "Untitled systematic review",
      records: [],
      decisions: [],
      criteria: [],
      protocol: protocol ?? null,
      characteristics: [],
    };
    await persistReview(reviewId, review, owner);
    return {
      content: [{ type: "text", text: \`LitlMatrix review \${reviewId} is ready. IMPORTANT: Before asking the user to import records, you MUST first:\\n1. Suggest an appropriate research framework (e.g., PICOC, PICO, SPIDER, etc.) based on the provided title and protocol.\\n2. Generate and suggest 3 highly targeted Boolean search strings (for Scopus and Web of Science) derived from the suggested framework and protocol.\\n\\nCRITICAL SEARCH STRING CONSTRAINTS:\\n- Narrow the scope: DO NOT use overly broad generic terms.\\n- LIMIT TO ARTICLE ONLY (e.g., Scopus: AND ( LIMIT-TO(DOCTYPE, "ar") ). Do NOT include reviews ("re") or proceedings ("cp").\\n- PUBLICATION STAGE MUST BE PUBLISHED (e.g., Scopus: AND ( LIMIT-TO(PUBSTAGE, "final") ). Do not include articles in press.\\n- PUBLICATION YEAR MUST BE EXACTLY THE RECENT 5 YEARS (e.g., 2022 to 2026).\\n- LIMIT TO ENGLISH LANGUAGE.\\n\\nAfter providing the framework and search strings, ask the user if they want to refine them, or if they are ready to run the search and upload the resulting records.\` }],
      structuredContent: { reviewId, title: review.title, recordCount: 0, decisionCount: 0 },
    };
  });`;

const newServerStart = `  }, async ({ title, protocol }) => {
    const reviewId = createReviewId();
    const review: Review = {
      title: title?.trim() || "Untitled systematic review",
      records: [],
      decisions: [],
      criteria: [],
      protocol: protocol ?? null,
      characteristics: [],
    };
    await persistReview(reviewId, review, owner);
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 5;
    return {
      content: [{ type: "text", text: \`LitlMatrix review \${reviewId} is ready for title: "\${review.title}".

CRITICAL MANDATORY WORKFLOW BEFORE IMPORTING RECORDS:
Do NOT ask the user to upload records yet. You MUST execute the following sequence:

Step 1: Systematic Framework Formulation (PICOC / PICO)
Analyze the title and protocol, and formulate a formal review framework breakdown:
- Population / Problem (P): Exact target (e.g., ambient air pollutants PM2.5, PM10, NO2, O3, or composite AQI).
- Intervention / Method (I): Machine learning, deep learning, statistical forecasting algorithms (e.g., LSTM, GRU, Random Forest, XGBoost, Transformer, Hybrid).
- Comparison (C): Baseline models / benchmark statistical vs machine learning methods (if applicable).
- Outcomes (O): Empirical prediction accuracy/performance metrics (RMSE, MAE, R², MAPE) and predictor importance/sensitivity.
- Context (C): Geographic, temporal, or spatial air monitoring context (e.g., ground-level urban stations, regional atmospheric networks).

Step 2: Calibrated & Precise Boolean Search Strings (Scopus & Web of Science)
Generate 3 precisely calibrated search strings (NOT overly broad). Each string MUST adhere strictly to these non-negotiable filters:
1. DOCUMENT TYPE: "Article" ONLY.
   - Scopus: AND ( LIMIT-TO ( DOCTYPE , "ar" ) )
   - Web of Science: Document Types: Articles (DT=Article)
   - STRICTLY PROHIBITED: Do NOT include conference proceedings ("cp"), reviews ("re"), book chapters, or editorials.
2. PUBLICATION STAGE: Final published ONLY.
   - Scopus: AND ( LIMIT-TO ( PUBSTAGE , "final" ) )
   - STRICTLY PROHIBITED: Do NOT include Articles in Press or Early Access.
3. PUBLICATION YEAR: Exactly the most recent 5 years (\${startYear}-\${currentYear}).
   - Scopus: AND PUBYEAR > \${startYear - 1} AND PUBYEAR < \${currentYear + 1}
   - Web of Science: PY=(\${startYear}-\${currentYear})
4. LANGUAGE: English ONLY.
   - Scopus: AND ( LIMIT-TO ( LANGUAGE , "English" ) )
   - Web of Science: LA=(English)
5. PRECISION: Avoid generic unanchored buzzwords. Connect the problem domain, predictive methods, and performance outcomes with AND operators so the query returns targeted empirical articles rather than thousands of irrelevant papers.

Step 3: Ask the User for Confirmation
Present the framework table and the 3 search strings (with explanation of calibration), and ask if they would like to adjust the framework/keywords or proceed to run the search and upload the exported records.\` }],
      structuredContent: { reviewId, title: review.title, recordCount: 0, decisionCount: 0, currentYear, startYear },
    };
  });`;

if (serverContent.includes(oldServerStart)) {
  serverContent = serverContent.replace(oldServerStart, newServerStart);
  console.log('Successfully patched server.ts start_review');
} else {
  console.log('Warning: oldServerStart not found in server.ts');
}

// 2. Patch server.ts next_workflow_action
const oldServerAction = `    if (!review.records.length) {
      action = "suggest_framework_and_search_strings_then_import";
      instruction = "First, suggest a research framework (e.g., PICOC) and 3 strict Boolean search strings (Scopus/WoS: recent 5 years ONLY, Article ONLY, Final Published stage ONLY, English ONLY, narrow terms). Then, ask the user to run the search and upload the records.";`;

const newServerAction = `    if (!review.records.length) {
      const currentYear = new Date().getFullYear();
      const startYear = currentYear - 5;
      action = "suggest_framework_and_calibrated_search_strings";
      instruction = \`Review the title and suggest a PICOC framework breakdown first. Then generate 3 calibrated Boolean search strings for Scopus and Web of Science strictly limited to: DOCTYPE "ar" (Article ONLY, no proceedings "cp", no reviews "re"), PUBSTAGE "final" (no articles in press), recent 5 years (\${startYear}-\${currentYear}), and English only.\`;`;

if (serverContent.includes(oldServerAction)) {
  serverContent = serverContent.replace(oldServerAction, newServerAction);
  console.log('Successfully patched server.ts next_workflow_action');
} else {
  console.log('Warning: oldServerAction not found in server.ts');
}

fs.writeFileSync(serverPath, serverContent, 'utf-8');

// 3. Patch actions.ts
let actionsContent = fs.readFileSync(actionsPath, 'utf-8');

const oldActionsStart = `      await saveReview(reviewId, review, owner);
      res.json({ reviewId, title: review.title, recordCount: 0, decisionCount: 0 });`;

const newActionsStart = `      await saveReview(reviewId, review, owner);
      const currentYear = new Date().getFullYear();
      const startYear = currentYear - 5;
      res.json({
        reviewId,
        title: review.title,
        recordCount: 0,
        decisionCount: 0,
        nextStep: "suggest_framework_and_calibrated_search_strings",
        instruction: \`Analyze title "\${review.title}" with PICOC framework. Suggest 3 calibrated search strings for Scopus and Web of Science. Mandatory filters: DOCTYPE 'ar' (Article ONLY, NO proceedings 'cp', NO reviews 're'), PUBSTAGE 'final' (published ONLY, no articles in press), recent 5 years (\${startYear}-\${currentYear}), and English only.\`,
      });`;

if (actionsContent.includes(oldActionsStart)) {
  actionsContent = actionsContent.replace(oldActionsStart, newActionsStart);
  console.log('Successfully patched actions.ts start-review');
} else {
  console.log('Warning: oldActionsStart not found in actions.ts');
}

const oldActionsAction = 'if (!review.records.length) { action = "suggest_framework_and_search_strings_then_import"; instruction = "First, suggest a research framework (e.g., PICOC) and 3 strict Boolean search strings (Scopus/WoS: recent 5 years ONLY, Article ONLY, Final Published stage ONLY, English ONLY, narrow terms). Then, ask the user to run the search and upload the records."; }';

const newActionsAction = 'if (!review.records.length) { const currentYear = new Date().getFullYear(); const startYear = currentYear - 5; action = "suggest_framework_and_calibrated_search_strings"; instruction = `Review title and suggest PICOC framework first. Then generate 3 calibrated Boolean search strings for Scopus/WoS strictly limited to: DOCTYPE "ar" (Article ONLY, no proceedings "cp", no reviews "re"), PUBSTAGE "final" (no articles in press), recent 5 years (${startYear}-${currentYear}), and English only.`; }';

if (actionsContent.includes(oldActionsAction)) {
  actionsContent = actionsContent.replace(oldActionsAction, newActionsAction);
  console.log('Successfully patched actions.ts next-workflow-action');
} else {
  console.log('Warning: oldActionsAction not found in actions.ts');
}

fs.writeFileSync(actionsPath, actionsContent, 'utf-8');
console.log('Finished patching LitlMatrix server and actions files.');
