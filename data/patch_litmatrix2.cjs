// Patch script to update litmatrix prompt behavior
const fs = require('fs');

const basePath = 'C:\\Users\\Dr Dyana\\Documents\\GitHub\\LitlMatrix\\apps\\litmatrix-chatgpt';
const serverPath = basePath + '\\server.ts';
const actionsPath = basePath + '\\actions.ts';

function replaceBlock(filePath, oldStr, newStr) {
  let content = fs.readFileSync(filePath, 'utf-8');
  if (content.includes(oldStr)) {
    content = content.replace(oldStr, newStr);
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  }
  return false;
}

// 1. Update server.ts start_review tool
const oldStartReview = 'content: [{ type: "text", text: `LitlMatrix review ${reviewId} is ready. Import the researcher-supplied Scopus/WoS records next.` }],';
const newStartReview = 'content: [{ type: "text", text: `LitlMatrix review ${reviewId} is ready. IMPORTANT: Before asking the user to import records, you MUST first generate and suggest 3 highly effective Boolean search strings (for Scopus and Web of Science) based on their protocol/title. Ask the user if they want to refine these search strings, or if they are ready to run the search and upload the resulting RIS/BibTeX/CSV records.` }],';
if (replaceBlock(serverPath, oldStartReview, newStartReview)) {
  console.log('Successfully patched server.ts start_review');
} else {
  console.log('Failed to patch server.ts start_review - text not found');
}

// 2. Update server.ts next_workflow_action
const oldServerAction = `    if (!review.records.length) {
      action = "import_records";
      instruction = "Import the researcher-supplied Scopus/WoS records before doing AI analysis.";`;
const newServerAction = `    if (!review.records.length) {
      action = "suggest_search_strings_then_import";
      instruction = "First, suggest 3 Boolean search strings (Scopus/WoS) based on the protocol. Then, ask the user to run the search and upload the resulting Scopus/WoS records before doing AI analysis.";`;
if (replaceBlock(serverPath, oldServerAction, newServerAction)) {
  console.log('Successfully patched server.ts next_workflow_action');
} else {
  console.log('Failed to patch server.ts next_workflow_action - text not found');
}

// 3. Update actions.ts next-workflow-action
const oldActionsAction = 'if (!review.records.length) { action = "import_records"; instruction = "Import the researcher-supplied Scopus/WoS records before doing AI analysis."; }';
const newActionsAction = 'if (!review.records.length) { action = "suggest_search_strings_then_import"; instruction = "First, suggest 3 Boolean search strings (Scopus/WoS) based on the protocol. Then, ask the user to run the search and upload the resulting Scopus/WoS records before doing AI analysis."; }';
if (replaceBlock(actionsPath, oldActionsAction, newActionsAction)) {
  console.log('Successfully patched actions.ts next-workflow-action');
} else {
  console.log('Failed to patch actions.ts next-workflow-action - text not found');
}

console.log('Patch complete.');
