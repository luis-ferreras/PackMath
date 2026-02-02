// ========================================
// PackMath Data Converter
// ========================================

// Initialize PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// State
let state = {
    dataType: null,        // 'odds' or 'checklist'
    productId: '',
    boxConfig: '',
    cardCategory: 'base',
    setType: 'base',       // for checklist
    setName: '',           // for checklist
    rawData: '',
    parsedRows: [],
    columns: [],
    columnMapping: {},
    currentStep: 1
};

// Expected columns for each data type
const ODDS_COLUMNS = ['product_id', 'config', 'category', 'card_type', 'parallel', 'out_of', 'odds'];
const CHECKLIST_COLUMNS = ['product_id', 'set_type', 'set_name', 'card_num', 'player', 'team', 'rookie'];

const ODDS_INSTRUCTIONS = `
    <p><strong>Paste odds data from your PDF:</strong></p>
    <p>Each line should contain card name and odds. Examples:</p>
    <ul>
        <li>Refractor 1:4</li>
        <li>Gold /50 1:12</li>
        <li>Superfractor 1/1 1:549</li>
    </ul>
`;

const CHECKLIST_INSTRUCTIONS = `
    <p><strong>Paste checklist data from your PDF:</strong></p>
    <p>Each line should contain card number, player name, and team. Examples:</p>
    <ul>
        <li>1 LeBron James Los Angeles Lakers</li>
        <li>RC-1 Victor Wembanyama San Antonio Spurs</li>
    </ul>
`;

// ========================================
// Initialize on DOM Ready
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    // Set up PDF upload handlers
    setupPDFUpload();

    // Add continue button to step 2
    const step2Content = document.querySelector('#step2 .step-content');
    if (step2Content && !step2Content.querySelector('.continue-btn')) {
        const continueBtn = document.createElement('button');
        continueBtn.className = 'btn btn-primary continue-btn';
        continueBtn.textContent = 'Continue';
        continueBtn.onclick = function() {
            state.productId = document.getElementById('productId').value.trim();
            state.boxConfig = document.getElementById('boxConfig').value.trim();
            state.cardCategory = document.getElementById('cardCategory')?.value || 'base';
            state.setType = document.getElementById('setType')?.value || 'base';
            state.setName = document.getElementById('setName')?.value.trim() || '';

            if (!state.productId) {
                alert('Please enter a Product ID');
                return;
            }
            if (state.dataType === 'odds' && !state.boxConfig) {
                alert('Please enter a Box Configuration');
                return;
            }
            showStep(3);
        };
        step2Content.appendChild(continueBtn);
    }
});

// ========================================
// PDF Upload Handling
// ========================================

function setupPDFUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const pdfInput = document.getElementById('pdfInput');

    if (!uploadArea || !pdfInput) return;

    // Click to upload
    uploadArea.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') {
            pdfInput.click();
        }
    });

    // File input change
    pdfInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            processPDF(file);
        }
    });

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');

        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            processPDF(file);
        } else {
            alert('Please upload a PDF file');
        }
    });
}

async function processPDF(file) {
    const uploadArea = document.getElementById('uploadArea');
    const uploadStatus = document.getElementById('uploadStatus');
    const progressBar = document.getElementById('uploadProgressBar');
    const statusText = document.getElementById('uploadStatusText');

    // Show progress
    uploadArea.classList.add('hidden');
    uploadStatus.classList.remove('hidden');
    statusText.textContent = 'Loading PDF...';
    progressBar.style.width = '10%';

    try {
        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        progressBar.style.width = '30%';
        statusText.textContent = 'Parsing PDF...';

        // Load PDF with PDF.js
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;
        progressBar.style.width = '50%';

        let fullText = '';

        // Extract text from all pages
        for (let i = 1; i <= numPages; i++) {
            statusText.textContent = `Extracting page ${i} of ${numPages}...`;
            progressBar.style.width = `${50 + (40 * i / numPages)}%`;

            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // Process text items with position awareness
            const pageText = extractTextWithStructure(textContent);
            fullText += pageText + '\n';
        }

        progressBar.style.width = '100%';
        statusText.textContent = 'Done!';

        // Put extracted text in paste area
        document.getElementById('pasteArea').value = fullText.trim();

        // Reset upload UI after a moment
        setTimeout(() => {
            uploadArea.classList.remove('hidden');
            uploadStatus.classList.add('hidden');
            progressBar.style.width = '0%';
        }, 1000);

    } catch (error) {
        console.error('PDF processing error:', error);
        alert('Error processing PDF: ' + error.message);

        uploadArea.classList.remove('hidden');
        uploadStatus.classList.add('hidden');
    }
}

function extractTextWithStructure(textContent) {
    // Sort items by vertical position (y), then horizontal (x)
    const items = textContent.items.map(item => ({
        text: item.str,
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
        width: item.width,
        height: item.height
    }));

    // Group items by approximate y position (same row)
    const rows = [];
    let currentRow = [];
    let lastY = null;
    const yTolerance = 5; // pixels

    // Sort by y (descending, since PDF y is from bottom), then x
    items.sort((a, b) => {
        if (Math.abs(a.y - b.y) > yTolerance) {
            return b.y - a.y; // Higher y values first (top of page)
        }
        return a.x - b.x; // Left to right
    });

    for (const item of items) {
        if (item.text.trim() === '') continue;

        if (lastY === null || Math.abs(item.y - lastY) > yTolerance) {
            // New row
            if (currentRow.length > 0) {
                rows.push(currentRow);
            }
            currentRow = [item];
            lastY = item.y;
        } else {
            currentRow.push(item);
        }
    }

    if (currentRow.length > 0) {
        rows.push(currentRow);
    }

    // Convert rows to text lines
    const lines = rows.map(row => {
        // Sort row items by x position
        row.sort((a, b) => a.x - b.x);

        // Join with appropriate spacing
        let line = '';
        let lastX = 0;

        for (const item of row) {
            // Add tab if there's a significant gap
            if (lastX > 0 && item.x - lastX > 30) {
                line += '\t';
            } else if (line.length > 0 && !line.endsWith(' ') && !line.endsWith('\t')) {
                line += ' ';
            }
            line += item.text;
            lastX = item.x + (item.width || item.text.length * 5);
        }

        return line.trim();
    });

    return lines.filter(line => line.length > 0).join('\n');
}

// ========================================
// Step Navigation
// ========================================

function showStep(stepNum) {
    document.querySelectorAll('.step').forEach(step => {
        step.classList.add('hidden');
    });
    document.getElementById(`step${stepNum}`).classList.remove('hidden');
    state.currentStep = stepNum;
}

function goBack() {
    if (state.currentStep > 1) {
        showStep(state.currentStep - 1);
    }
}

function startOver() {
    state = {
        dataType: null,
        productId: '',
        boxConfig: '',
        cardCategory: 'base',
        setType: 'base',
        setName: '',
        rawData: '',
        parsedRows: [],
        columns: [],
        columnMapping: {},
        currentStep: 1
    };

    document.querySelectorAll('.data-type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById('productId').value = '';
    document.getElementById('boxConfig').value = '';
    document.getElementById('cardCategory').value = 'base';
    document.getElementById('setType').value = 'base';
    document.getElementById('setName').value = '';
    document.getElementById('pasteArea').value = '';
    document.getElementById('csvOutput').value = '';

    showStep(1);
}

// ========================================
// Step 1: Select Data Type
// ========================================

function selectDataType(type) {
    state.dataType = type;

    document.querySelectorAll('.data-type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-type="${type}"]`).classList.add('active');

    // Show/hide type-specific fields
    const configRow = document.getElementById('oddsConfigRow');
    const categoryRow = document.getElementById('oddsCategoryRow');
    const setTypeRow = document.getElementById('checklistSetTypeRow');
    const setNameRow = document.getElementById('checklistSetNameRow');

    if (type === 'odds') {
        configRow?.classList.remove('hidden');
        categoryRow?.classList.remove('hidden');
        setTypeRow?.classList.add('hidden');
        setNameRow?.classList.add('hidden');
    } else {
        configRow?.classList.add('hidden');
        categoryRow?.classList.add('hidden');
        setTypeRow?.classList.remove('hidden');
        setNameRow?.classList.remove('hidden');
    }

    document.getElementById('pasteInstructions').innerHTML =
        type === 'odds' ? ODDS_INSTRUCTIONS : CHECKLIST_INSTRUCTIONS;

    showStep(2);
}

// ========================================
// Step 3: Parse Data
// ========================================

function parseData() {
    const rawText = document.getElementById('pasteArea').value.trim();

    if (!rawText) {
        alert('Please upload a PDF or paste some data first');
        return;
    }

    state.rawData = rawText;

    const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    if (lines.length === 0) {
        alert('No data found');
        return;
    }

    // Detect header row
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('card') || firstLine.includes('odds') ||
                      firstLine.includes('player') || firstLine.includes('team') ||
                      firstLine.includes('number') || firstLine.includes('#') ||
                      firstLine.includes('parallel') || firstLine.includes('insert');

    const dataLines = hasHeader ? lines.slice(1) : lines;

    if (state.dataType === 'odds') {
        state.parsedRows = parseOddsData(dataLines);
    } else {
        state.parsedRows = parseChecklistData(dataLines);
    }

    if (state.parsedRows.length === 0) {
        alert('Could not parse any data. Please check the format.');
        return;
    }

    detectColumns();
    renderColumnMapping();
    renderPreview();

    showStep(4);
}

function parseOddsData(lines) {
    const rows = [];

    for (const line of lines) {
        // Skip empty or header-like lines
        if (!line || line.toLowerCase().includes('overall odds') || line.toLowerCase().includes('card type')) {
            continue;
        }

        // Tab-separated
        if (line.includes('\t')) {
            const parts = line.split('\t').map(p => p.trim()).filter(p => p);
            if (parts.length >= 2) {
                rows.push(normalizeOddsRow(parts));
                continue;
            }
        }

        // Look for odds pattern: card name followed by 1:X or /XX 1:X
        // Patterns: "Refractor 1:4", "Gold /50 1:12", "Gold 50 1:12", "Superfractor 1/1 1:549"
        const oddsPatterns = [
            // Pattern: Name /XX 1:Y (numbered with slash)
            /^(.+?)\s+\/(\d+)\s+(1:\d+|1\/\d+)$/,
            // Pattern: Name #XX 1:Y (numbered with hash)
            /^(.+?)\s+#(\d+)\s+(1:\d+|1\/\d+)$/,
            // Pattern: Name XX 1:Y where XX is a number (could be numbered)
            /^(.+?)\s+(\d+)\s+(1:\d+|1\/\d+)$/,
            // Pattern: Name 1:Y (simple odds)
            /^(.+?)\s+(1:\d+|1\/\d+)$/,
            // Pattern: Name 1:Y:Z (case odds)
            /^(.+?)\s+(1:\d+:\d+)$/
        ];

        let matched = false;
        for (const pattern of oddsPatterns) {
            const match = line.match(pattern);
            if (match) {
                if (match.length === 4) {
                    // Has numbered
                    rows.push([match[1].trim(), match[2], match[3]]);
                } else {
                    // Simple odds
                    rows.push([match[1].trim(), '', match[2]]);
                }
                matched = true;
                break;
            }
        }

        if (!matched) {
            // Fallback: split by multiple spaces
            const parts = line.split(/\s{2,}/).map(p => p.trim()).filter(p => p);
            if (parts.length >= 2) {
                rows.push(normalizeOddsRow(parts));
            } else {
                // Last resort: just use the whole line
                const simpleParts = line.split(/\s+/);
                if (simpleParts.length >= 2) {
                    const lastPart = simpleParts[simpleParts.length - 1];
                    if (/^1:\d+/.test(lastPart) || /^1\/\d+/.test(lastPart)) {
                        rows.push([simpleParts.slice(0, -1).join(' '), '', lastPart]);
                    }
                }
            }
        }
    }

    return rows;
}

function normalizeOddsRow(parts) {
    // Try to identify which part is the odds
    const result = [];
    let cardName = '';
    let numbered = '';
    let odds = '';

    for (const part of parts) {
        if (/^1:\d+/.test(part) || /^1\/\d+/.test(part)) {
            odds = part;
        } else if (/^\/?\d+$/.test(part) || /^#\d+$/.test(part)) {
            numbered = part.replace(/[/#]/g, '');
        } else {
            cardName += (cardName ? ' ' : '') + part;
        }
    }

    return [cardName, numbered, odds];
}

function parseChecklistData(lines) {
    const rows = [];

    for (const line of lines) {
        if (!line) continue;

        // Tab-separated
        if (line.includes('\t')) {
            let parts = line.split('\t').map(p => p.trim()).filter(p => p);
            // Try to split "number + name" patterns in each part
            parts = splitNumberNameParts(parts);
            if (parts.length >= 2) {
                rows.push(parts);
                continue;
            }
        }

        // Card number at start
        const cardNumMatch = line.match(/^(\d+|[A-Z]+-?\d+|RC-?\d+)\s+(.+)$/i);
        if (cardNumMatch) {
            const cardNum = cardNumMatch[1];
            const rest = cardNumMatch[2];
            const parts = rest.split(/\s{2,}|\t/).map(p => p.trim()).filter(p => p);
            rows.push([cardNum, ...parts]);
            continue;
        }

        // Multiple spaces as delimiter
        let parts = line.split(/\s{2,}/).map(p => p.trim()).filter(p => p);
        parts = splitNumberNameParts(parts);
        if (parts.length >= 2) {
            rows.push(parts);
        } else if (parts.length === 1) {
            // Try single space split but be careful
            const spaceParts = line.split(/\s+/);
            if (spaceParts.length >= 3) {
                rows.push(spaceParts);
            }
        }
    }

    return rows;
}

// Split parts that contain "number + name" patterns like "1 Pascal Siakam"
function splitNumberNameParts(parts) {
    const result = [];

    for (const part of parts) {
        // Pattern: starts with number(s), followed by space, then a name (letters)
        // Examples: "1 Pascal Siakam", "10 Talen Horton-Tucker", "RC-1 Victor Wembanyama"
        const match = part.match(/^(\d+|[A-Z]+-?\d+|RC-?\d+)\s+([A-Z][a-zA-Z].*)/i);

        if (match) {
            // Split into card number and player name
            result.push(match[1]);  // card number
            result.push(match[2]);  // player name
        } else {
            result.push(part);
        }
    }

    return result;
}

function detectColumns() {
    if (state.parsedRows.length === 0) return;

    const maxCols = Math.max(...state.parsedRows.map(row => row.length));

    state.columns = [];
    for (let i = 0; i < maxCols; i++) {
        state.columns.push(`Column ${i + 1}`);
    }

    state.columnMapping = {};

    for (let i = 0; i < maxCols; i++) {
        const sampleValues = state.parsedRows.slice(0, 10).map(row => row[i] || '').filter(v => v);

        // Odds pattern
        if (sampleValues.some(v => /^1:\d+/.test(v) || /^1\/\d+/.test(v))) {
            state.columnMapping[i] = 'odds';
            continue;
        }

        // Pure numbers (could be card_num or out_of)
        if (sampleValues.length > 0 && sampleValues.every(v => /^\d+$/.test(v))) {
            if (state.dataType === 'odds') {
                state.columnMapping[i] = 'out_of';
            } else if (!Object.values(state.columnMapping).includes('card_num')) {
                state.columnMapping[i] = 'card_num';
            }
            continue;
        }

        // Card numbers with letters
        if (sampleValues.some(v => /^[A-Z]+-?\d+$/i.test(v) || /^RC-?\d+$/i.test(v))) {
            state.columnMapping[i] = 'card_num';
            continue;
        }

        // Team names
        const teamPatterns = /celtics|lakers|bulls|heat|warriors|nets|knicks|mavericks|suns|bucks|76ers|spurs|rockets|jazz|nuggets|clippers|grizzlies|pelicans|hawks|hornets|pacers|pistons|magic|wizards|raptors|cavaliers|timberwolves|thunder|blazers|kings/i;
        if (sampleValues.some(v => teamPatterns.test(v))) {
            state.columnMapping[i] = 'team';
            continue;
        }

        // Rookie indicator
        if (sampleValues.some(v => /^(true|false|yes|no|rc|rookie)$/i.test(v))) {
            state.columnMapping[i] = 'rookie';
            continue;
        }

        // First unassigned text column
        if (state.dataType === 'odds') {
            if (!Object.values(state.columnMapping).includes('parallel')) {
                state.columnMapping[i] = 'parallel';
            }
        } else {
            if (!Object.values(state.columnMapping).includes('player')) {
                state.columnMapping[i] = 'player';
            }
        }
    }
}

// ========================================
// Step 4: Column Mapping UI
// ========================================

function renderColumnMapping() {
    const container = document.getElementById('columnMapping');
    const expectedCols = state.dataType === 'odds' ? ODDS_COLUMNS : CHECKLIST_COLUMNS;
    const selectableCols = expectedCols.filter(col => col !== 'product_id' && col !== 'config' && col !== 'category');

    let html = '<div class="mapping-grid">';

    for (let i = 0; i < state.columns.length; i++) {
        const sampleValues = state.parsedRows.slice(0, 3).map(row => row[i] || '-').join(', ');
        const currentMapping = state.columnMapping[i] || '';

        html += `
            <div class="mapping-item">
                <div class="mapping-sample">${escapeHtml(sampleValues.substring(0, 50))}${sampleValues.length > 50 ? '...' : ''}</div>
                <select class="mapping-select" onchange="updateMapping(${i}, this.value)">
                    <option value="">-- Skip --</option>
                    ${selectableCols.map(col =>
                        `<option value="${col}" ${currentMapping === col ? 'selected' : ''}>${formatColumnName(col)}</option>`
                    ).join('')}
                </select>
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;
}

function updateMapping(columnIndex, value) {
    if (value) {
        state.columnMapping[columnIndex] = value;
    } else {
        delete state.columnMapping[columnIndex];
    }
    renderPreview();
}

function formatColumnName(col) {
    return col.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function renderPreview() {
    const container = document.getElementById('previewContainer');
    const expectedCols = state.dataType === 'odds' ? ODDS_COLUMNS : CHECKLIST_COLUMNS;

    const previewRows = state.parsedRows.slice(0, 10).map(row => {
        const mappedRow = {};

        mappedRow.product_id = state.productId;
        if (state.dataType === 'odds') {
            mappedRow.config = state.boxConfig;
            mappedRow.category = state.cardCategory;
        } else {
            // Checklist: add set_type and set_name
            mappedRow.set_type = state.setType;
            mappedRow.set_name = state.setName;
        }

        for (const [colIndex, colName] of Object.entries(state.columnMapping)) {
            mappedRow[colName] = row[parseInt(colIndex)] || '';
        }

        // Auto-detect rookie status for checklists
        if (state.dataType === 'checklist') {
            mappedRow.rookie = detectRookieStatus(mappedRow);
        }

        return mappedRow;
    });

    let html = '<table class="preview-table"><thead><tr>';
    for (const col of expectedCols) {
        html += `<th>${formatColumnName(col)}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (const row of previewRows) {
        html += '<tr>';
        for (const col of expectedCols) {
            html += `<td>${escapeHtml(row[col] || '')}</td>`;
        }
        html += '</tr>';
    }

    html += '</tbody></table>';

    if (state.parsedRows.length > 10) {
        html += `<p class="preview-note">Showing first 10 of ${state.parsedRows.length} rows</p>`;
    }

    container.innerHTML = html;
}

// Detect if a card is a rookie card based on various indicators
function detectRookieStatus(row) {
    // Check card_num for RC prefix
    if (row.card_num && /^RC/i.test(row.card_num)) {
        return 'true';
    }

    // Check player name for RC suffix or (RC) tag
    if (row.player) {
        if (/\bRC\b/i.test(row.player) || /\(RC\)/i.test(row.player)) {
            return 'true';
        }
    }

    // Check set_name for rookie-related terms
    if (row.set_name) {
        if (/rookie/i.test(row.set_name)) {
            return 'true';
        }
    }

    // Check set_type
    if (row.set_type && /rookie/i.test(row.set_type)) {
        return 'true';
    }

    return '';
}

// ========================================
// Step 5: Generate CSV
// ========================================

function generateCSV() {
    const expectedCols = state.dataType === 'odds' ? ODDS_COLUMNS : CHECKLIST_COLUMNS;
    const csvRows = [];

    csvRows.push(expectedCols.join(','));

    for (const row of state.parsedRows) {
        // Build a mapped row object first
        const rowData = {};
        rowData.product_id = state.productId;

        if (state.dataType === 'odds') {
            rowData.config = state.boxConfig;
            rowData.category = state.cardCategory;
        } else {
            rowData.set_type = state.setType;
            rowData.set_name = state.setName;
        }

        // Map columns from parsed data
        for (const [colIndex, colName] of Object.entries(state.columnMapping)) {
            rowData[colName] = row[parseInt(colIndex)] || '';
        }

        // Auto-detect rookie for checklists
        if (state.dataType === 'checklist') {
            rowData.rookie = detectRookieStatus(rowData);
        }

        // Build CSV row
        const mappedRow = [];
        for (const col of expectedCols) {
            let value = rowData[col] || '';
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                value = `"${value.replace(/"/g, '""')}"`;
            }
            mappedRow.push(value);
        }

        csvRows.push(mappedRow.join(','));
    }

    document.getElementById('csvOutput').value = csvRows.join('\n');
    showStep(5);
}

function copyCSV() {
    const csvOutput = document.getElementById('csvOutput');
    csvOutput.select();
    document.execCommand('copy');

    const successMsg = document.getElementById('copySuccess');
    successMsg.classList.remove('hidden');
    setTimeout(() => {
        successMsg.classList.add('hidden');
    }, 2000);
}

function downloadCSV() {
    const csvContent = document.getElementById('csvOutput').value;
    const filename = `${state.dataType}_${state.productId.replace(/[^a-z0-9]/gi, '_')}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

// ========================================
// Utility Functions
// ========================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
