# RAG Knowledge Base Testing Guide

## Overview
This guide provides step-by-step instructions to test the new RAG (Retrieval Augmented Generation) knowledge base feature in OpenMind.

## What Was Implemented

### 1. Knowledge Base System (`knowledge-base.js`)
- Vector embedding generation using Gemini text-embedding-004 API
- Text chunking (500 chars with 100 char overlap)
- Cosine similarity-based retrieval
- Persistent storage using electron-store
- Support for .txt, .pdf, .docx, .md files

### 2. File Upload UI (`index.html` + `renderer.js`)
- File upload button in Settings page
- Multi-file upload support
- Document statistics display
- Knowledge base management (view, clear)
- Auto-load on startup

### 3. RAG Integration (`chatbox-renderer.js`)
- Automatic knowledge retrieval when chatbox is used
- Top-3 most relevant chunks retrieved per query
- Context injection with source citations
- Relevance score display
- Graceful fallback if KB is empty or errors occur

## Prerequisites

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Get Gemini API Key**
   - Go to https://makersuite.google.com/app/apikey
   - Create a new API key
   - Copy the key (you'll need it for testing)

## Testing Procedure

### Test 1: File Upload and Storage

1. **Start the application**
   ```bash
   npm start
   ```

2. **Configure API Key**
   - Click "Settings" in the top navigation
   - Paste your Gemini API key in the "Gemini API Key" field
   - Click "Save Settings"

3. **Upload Test Document**
   - Scroll down to the "Knowledge Base (RAG)" section
   - Click "Choose Files" button
   - Select the `test-knowledge.txt` file (provided in the repo)
   - Wait for processing (you should see "Processing..." indicator)
   - Verify success message: "✅ Successfully added 1 document(s) to knowledge base!"

4. **Verify Upload**
   - Check that the knowledge base status shows:
     - "1 document(s) • X chunks indexed"
   - Check that the document appears in the "Uploaded Documents" list
   - Verify the document shows chunk count and upload date

5. **Check Console Logs**
   - Open DevTools (View → Toggle DevTools)
   - Console should show:
     ```
     [KB] Adding document: test-knowledge.txt
     [KB] Added X chunks from test-knowledge.txt
     ```

### Test 2: Knowledge Retrieval in Chatbox

1. **Open Chatbox**
   - Click "Open Chatbox" button in top-right corner
   - Or use shortcut: `Cmd+Shift+C` (Mac) or `Ctrl+Shift+C` (Windows/Linux)

2. **Test Question 1: Direct Knowledge Query**
   - In chatbox, type: "What is the probability of drawing a white ball?"
   - Send the message
   - **Expected Result:**
     - AI should reference the knowledge base
     - Should cite "test-knowledge.txt" as source
     - Should give correct answer: 60% or 0.6 or 6/10
     - Should show step-by-step calculation

3. **Check Console Logs**
   - Console should show:
     ```
     [RAG] Knowledge base available: 1 documents, X chunks
     [RAG] Retrieved 3 relevant chunks
     [KB] Retrieving for query: What is the probability...
     [KB] Top 3 chunks retrieved with similarities: [0.XXX, 0.XXX, 0.XXX]
     ```

4. **Test Question 2: Related Knowledge**
   - Ask: "What is conditional probability?"
   - **Expected Result:**
     - Should reference P(A|B) = P(A and B) / P(B)
     - Should cite the knowledge base
     - Relevance score should be shown in console

5. **Test Question 3: Unrelated Query**
   - Ask: "What is the capital of France?"
   - **Expected Result:**
     - May retrieve some chunks (lower similarity scores)
     - Should answer from general knowledge
     - Should acknowledge if KB doesn't contain relevant info

### Test 3: Persistence

1. **Close Application**
   - Close the OpenMind app completely

2. **Restart Application**
   ```bash
   npm start
   ```

3. **Verify Persistence**
   - Go to Settings
   - Check that Knowledge Base section shows the previously uploaded document
   - Stats should match previous session
   - Documents list should show the same files

4. **Test Query Again**
   - Open chatbox
   - Ask: "What is the formula for mean?"
   - **Expected Result:**
     - Should still use the knowledge base
     - Should give correct answer from stored knowledge
     - Console logs should confirm KB retrieval

### Test 4: Multiple Document Upload

1. **Create Second Test File**
   - Create a new file `test-stats.txt` with content:
     ```
     STATISTICS REFERENCE

     Variance Formula:
     Variance = Sum of (x - mean)² / N

     Standard Deviation:
     SD = √Variance

     Z-Score:
     Z = (x - mean) / SD
     ```

2. **Upload Multiple Files**
   - Go to Settings → Knowledge Base
   - Click "Choose Files"
   - Select both `test-knowledge.txt` and `test-stats.txt` (hold Cmd/Ctrl)
   - Wait for processing
   - **Note:** If the first file was already uploaded, it may show 1 success + 1 failure (duplicate handling)

3. **Verify Multiple Documents**
   - Status should show "2 document(s)" (or 1 if duplicate was skipped)
   - Both files should appear in documents list

4. **Test Cross-Document Retrieval**
   - Open chatbox
   - Ask: "What is the z-score formula?"
   - **Expected Result:**
     - Should retrieve from `test-stats.txt`
     - Should cite the correct source file

### Test 5: Clear Knowledge Base

1. **Clear KB**
   - Go to Settings → Knowledge Base
   - Click "Clear Knowledge Base" button
   - Confirm the warning dialog

2. **Verify Clearing**
   - All documents should disappear
   - Status, document list, and clear button should hide
   - Success message: "✅ Knowledge base cleared successfully!"

3. **Test Without KB**
   - Open chatbox
   - Ask: "What is the probability of drawing a white ball?"
   - **Expected Result:**
     - No console logs about KB retrieval
     - AI answers from general knowledge (may not know about the specific 4 black/6 white scenario)

### Test 6: Error Handling

1. **Test Invalid API Key**
   - Settings → Change API key to invalid value "sk-invalid-key"
   - Try uploading a document
   - **Expected Result:**
     - Should show error message
     - Should not crash the app
     - Console shows embedding API error

2. **Test Large File** (optional)
   - Create a large .txt file (>100KB)
   - Upload it
   - **Expected Result:**
     - Should chunk into many pieces
     - May take longer to process
     - Should show chunk count in UI

3. **Test Unsupported File Type** (current limitation)
   - Try selecting a .pdf or .docx file
   - **Expected Result:**
     - File selector should allow it
     - Reading may fail (PDF/DOCX parsing not yet implemented)
     - Error should be caught and displayed

## Expected Console Output Patterns

### During Upload:
```
[KB] Processing file: /path/to/test-knowledge.txt
[KB] Adding document: test-knowledge.txt
[KB] Added 8 chunks from test-knowledge.txt
[KB] Successfully added: test-knowledge.txt
```

### During Retrieval:
```
[Gemini API] Using model: gemini-2.0-flash-exp, API version: v1beta, Has image: false
[RAG] Knowledge base available: 1 documents, 8 chunks
[KB] Retrieving for query: What is the probability of...
[KB] Top 3 chunks retrieved with similarities: [0.856, 0.723, 0.612]
[RAG] Retrieved 3 relevant chunks
```

### During Clear:
```
[KB] Knowledge base cleared
```

## Known Limitations

1. **PDF/DOCX Support**: Currently only .txt and .md files are fully supported. PDF and DOCX require additional parsing libraries.

2. **File Size**: Very large files (>1MB) may take significant time to process due to embedding API calls.

3. **API Rate Limits**: Gemini API has rate limits. Uploading many files quickly may hit these limits.

4. **Chunk Overlap**: Current chunking is character-based, not sentence-aware. May split sentences mid-word.

## Troubleshooting

### "Please configure your Gemini API key"
- Go to Settings and save your API key first

### "Embedding API error: 403"
- Check that your API key is valid
- Ensure Gemini API is enabled for your key

### Documents don't appear after upload
- Check console for errors
- Verify API key is correct
- Try refreshing the app

### Chatbox doesn't use KB knowledge
- Check console for `[RAG]` logs
- Verify documents are shown in Settings → Knowledge Base
- Try asking a more specific question that matches uploaded content

### App won't start
- Run `npm install` to ensure dependencies are installed
- Check that Node.js and npm are up to date

## Success Criteria

✅ **All tests pass if:**
1. Documents upload successfully with success message
2. Document stats and list display correctly
3. Console shows embedding generation and chunk creation
4. Chatbox retrieves relevant chunks (console logs confirm)
5. AI responses reference the uploaded knowledge
6. Knowledge base persists across app restarts
7. Clear function removes all documents
8. No crashes or unhandled errors

## Next Steps After Testing

If all tests pass:
1. Commit the changes with detailed commit message
2. Push to the branch
3. Create documentation for end users
4. Consider adding PDF parsing library (e.g., pdf-parse)
5. Consider adding DOCX parsing library (e.g., mammoth)

If tests fail:
1. Note the specific failure in console output
2. Check the error messages
3. Review the relevant code section
4. Fix the issue and retest
