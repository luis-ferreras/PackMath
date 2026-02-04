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
    setType: 'base',       // for checklist (default/fallback)
    setName: '',           // for checklist (default/fallback)
    rawData: '',
    parsedRows: [],
    rowMetadata: [],       // per-row metadata [{set_type, set_name}, ...]
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
});

// Continue from step 2 to step 3
function continueToStep3() {
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
}

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
        rowMetadata: [],
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
        state.rowMetadata = [];
    } else {
        const result = parseChecklistData(dataLines);
        state.parsedRows = result.rows;
        state.rowMetadata = result.metadata;
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
    const metadata = [];

    // Track current section headers
    let currentSetType = '';
    let currentSetName = '';
    let pendingHeader = null;  // Store first header until we see second or card data

    for (const line of lines) {
        if (!line) continue;

        // Check if this line is a section header
        if (isSectionHeader(line)) {
            const headerText = line.trim();

            if (pendingHeader === null) {
                // First header - could be set_type
                pendingHeader = headerText;
            } else {
                // Second consecutive header - first was set_type, this is set_name
                currentSetType = pendingHeader;
                currentSetName = headerText;
                pendingHeader = null;
            }
            continue;
        }

        // Not a header - if we have a pending header, it's actually set_name (single header case)
        if (pendingHeader !== null) {
            // Single header before card data - treat as set_name, keep previous set_type
            currentSetName = pendingHeader;
            pendingHeader = null;
        }

        // Parse card data
        let parsedRow = null;

        // Tab-separated
        if (line.includes('\t')) {
            let parts = line.split('\t').map(p => p.trim()).filter(p => p);
            // Try to split "number + name" patterns in each part
            parts = splitNumberNameParts(parts);
            if (parts.length >= 2) {
                parsedRow = parts;
            }
        }

        if (!parsedRow) {
            // Card number at start
            const cardNumMatch = line.match(/^(\d+|[A-Z]+-?\d+|RC-?\d+)\s+(.+)$/i);
            if (cardNumMatch) {
                const cardNum = cardNumMatch[1];
                const rest = cardNumMatch[2];
                const parts = rest.split(/\s{2,}|\t/).map(p => p.trim()).filter(p => p);
                parsedRow = [cardNum, ...parts];
            }
        }

        if (!parsedRow) {
            // Multiple spaces as delimiter
            let parts = line.split(/\s{2,}/).map(p => p.trim()).filter(p => p);
            parts = splitNumberNameParts(parts);
            if (parts.length >= 2) {
                parsedRow = parts;
            } else if (parts.length === 1) {
                // Single part - try to parse it intelligently
                const parsed = parseLineWithTeamDetection(line);
                if (parsed.length >= 2) {
                    parsedRow = parsed;
                }
            }
        }

        if (parsedRow) {
            rows.push(parsedRow);
            metadata.push({
                set_type: currentSetType,
                set_name: currentSetName
            });
        }
    }

    // Post-process: find column with player+team combos and split them
    const processedRows = splitPlayerTeamColumn(rows);

    // Return both rows and metadata
    return { rows: processedRows, metadata: metadata };
}

// Find the column that contains player+team combos and split it for ALL rows
function splitPlayerTeamColumn(rows) {
    if (rows.length === 0) return rows;

    // Find which column index contains combined player+team values (long strings with team names)
    let teamColumnIndex = -1;
    for (let colIndex = 0; colIndex < rows[0].length; colIndex++) {
        // Check if any row has a combined player+team in this column
        for (const row of rows) {
            const value = row[colIndex] || '';
            // Only consider it a combined column if the value is long (has both player AND team)
            if (value.length > 10 && containsTeamName(value)) {
                teamColumnIndex = colIndex;
                break;
            }
        }
        if (teamColumnIndex >= 0) break;
    }

    // If no column with combined player+team found, return as-is
    if (teamColumnIndex < 0) return rows;

    // Split that column for rows that have combined player+team
    const newRows = [];
    for (const row of rows) {
        // Check if this specific row needs splitting
        const valueAtTeamCol = row[teamColumnIndex] || '';

        // Only split if:
        // 1. Value is long enough to contain both player and team
        // 2. Value contains a team name
        // 3. Value is NOT just a standalone team name (like "Boston Celtics" alone)
        const hasTeam = containsTeamName(valueAtTeamCol);
        const isJustTeam = isStandaloneTeam(valueAtTeamCol);
        const needsSplit = valueAtTeamCol.length > 10 && hasTeam && !isJustTeam;

        // Also check if this row already has a standalone team in a later column
        const hasStandaloneTeamLater = row.slice(teamColumnIndex + 1).some(v => {
            return v && isStandaloneTeam(v);
        });

        if (!needsSplit || hasStandaloneTeamLater) {
            // Row doesn't need splitting or already has team separate - copy as-is
            newRows.push([...row]);
        } else {
            // Split this row's combined player+team column
            const newRow = [];
            for (let i = 0; i < row.length; i++) {
                if (i === teamColumnIndex) {
                    const [player, team] = splitPlayerFromTeam(row[i]);
                    newRow.push(player);
                    newRow.push(team);
                } else {
                    newRow.push(row[i]);
                }
            }
            newRows.push(newRow);
        }
    }

    // Normalize all rows to have the same number of columns
    const maxCols = Math.max(...newRows.map(r => r.length));
    for (const row of newRows) {
        while (row.length < maxCols) {
            row.push('');
        }
    }

    return newRows;
}

// Check if text contains any known team name
function containsTeamName(text) {
    if (!text) return false;
    const textLower = text.toLowerCase();
    for (const team of NBA_TEAMS) {
        if (textLower.includes(team.toLowerCase())) {
            return true;
        }
    }
    return false;
}

// Check if text is JUST a team name (not combined with player)
// Returns true for "Boston Celtics", false for "John Smith Boston Celtics"
function isStandaloneTeam(text) {
    if (!text) return false;
    const textLower = text.toLowerCase().trim();
    for (const team of NBA_TEAMS) {
        const teamLower = team.toLowerCase();
        // Check if the text starts with the team name
        if (textLower.startsWith(teamLower)) {
            // Allow for some trailing whitespace but not much more content
            const remaining = textLower.substring(teamLower.length).trim();
            if (remaining.length < 5) {
                return true;
            }
        }
    }
    return false;
}

// Detect if a line is a section header (set_type or set_name indicator)
// Section headers are typically:
// - All uppercase (or nearly all)
// - Single column (no tabs)
// - Don't start with a card number pattern
// - Don't contain a team name
// - Short (typically 1-3 words)
function isSectionHeader(line) {
    if (!line || line.length === 0) return false;

    const trimmed = line.trim();

    // Skip if it has tabs (multiple columns = card data)
    if (trimmed.includes('\t')) return false;

    // Skip if it starts with a card number pattern
    if (/^(\d+|[A-Z]{1,4}-?\d+|RC-?\d+)\s/i.test(trimmed)) return false;

    // Skip if it contains a team name
    if (containsTeamName(trimmed)) return false;

    // Skip if too long (headers are typically short)
    if (trimmed.length > 50) return false;

    // Skip if it looks like player data (mixed case with multiple words that aren't all caps)
    const words = trimmed.split(/\s+/);
    if (words.length > 4) return false;

    // Check if mostly uppercase (allowing for small words like "of", "the", numbers)
    const uppercaseChars = (trimmed.match(/[A-Z]/g) || []).length;
    const lowercaseChars = (trimmed.match(/[a-z]/g) || []).length;
    const totalLetters = uppercaseChars + lowercaseChars;

    // At least 70% uppercase letters, or all caps
    if (totalLetters > 0 && uppercaseChars / totalLetters >= 0.7) {
        return true;
    }

    // Also accept known section header keywords
    const headerKeywords = /^(base|insert|parallel|rookie|auto|autograph|relic|memorabilia|short print|sp|ssp|variation|subset|checklist)/i;
    if (headerKeywords.test(trimmed)) {
        return true;
    }

    return false;
}

// NBA team names for splitting player from team
const NBA_TEAMS = [
    'Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets',
    'Chicago Bulls', 'Cleveland Cavaliers', 'Dallas Mavericks', 'Denver Nuggets',
    'Detroit Pistons', 'Golden State Warriors', 'Houston Rockets', 'Indiana Pacers',
    'Los Angeles Clippers', 'Los Angeles Lakers', 'LA Clippers', 'LA Lakers',
    'Memphis Grizzlies', 'Miami Heat', 'Milwaukee Bucks', 'Minnesota Timberwolves',
    'New Orleans Pelicans', 'New York Knicks', 'Oklahoma City Thunder', 'Orlando Magic',
    'Philadelphia 76ers', 'Phoenix Suns', 'Portland Trail Blazers', 'Sacramento Kings',
    'San Antonio Spurs', 'Toronto Raptors', 'Utah Jazz', 'Washington Wizards'
];

// Split "Giannis Antetokounmpo Milwaukee Bucks" into ["Giannis Antetokounmpo", "Milwaukee Bucks"]
// ALWAYS returns exactly 2 elements to keep columns consistent
function splitPlayerFromTeam(text) {
    if (!text || text.length < 3) return [text, ''];

    const textLower = text.toLowerCase();

    // Check if text contains a known team name (case-insensitive)
    for (const team of NBA_TEAMS) {
        const teamLower = team.toLowerCase();
        const teamIndex = textLower.indexOf(teamLower);
        if (teamIndex > 0) {
            const player = text.substring(0, teamIndex).trim();
            const teamName = text.substring(teamIndex).trim();
            if (player.length > 0) {
                return [player, teamName];
            }
        }
    }

    // No team found - return original as player, empty team
    return [text, ''];
}

// Parse a line by detecting where the team name starts
// Handles: "1 Shai Gilgeous-Alexander Oklahoma City Thunder"
// Returns: ["1", "Shai Gilgeous-Alexander", "Oklahoma City Thunder"]
function parseLineWithTeamDetection(line) {
    // First, try to extract card number from the start
    const cardNumMatch = line.match(/^(\d+|[A-Z]{1,3}-?\d+|RC-?\d+)\s+(.+)$/i);

    let cardNum = '';
    let rest = line;

    if (cardNumMatch) {
        cardNum = cardNumMatch[1];
        rest = cardNumMatch[2];
    }

    // Now try to find a team name in the rest
    const restLower = rest.toLowerCase();
    let bestTeamMatch = null;
    let bestTeamIndex = -1;

    for (const team of NBA_TEAMS) {
        const teamLower = team.toLowerCase();
        const teamIndex = restLower.indexOf(teamLower);
        // Find the earliest team match (closest to player name)
        if (teamIndex > 0 && (bestTeamIndex === -1 || teamIndex < bestTeamIndex)) {
            bestTeamIndex = teamIndex;
            bestTeamMatch = team;
        }
    }

    if (bestTeamIndex > 0) {
        const player = rest.substring(0, bestTeamIndex).trim();
        const team = rest.substring(bestTeamIndex).trim();

        if (cardNum) {
            return [cardNum, player, team];
        } else {
            return [player, team];
        }
    }

    // No team found - fall back to space splitting but keep hyphenated names together
    const words = rest.split(/\s+/);
    if (cardNum && words.length >= 1) {
        // Assume the rest is the player name
        return [cardNum, rest];
    }

    // Last resort: return the line split by spaces
    if (cardNum) {
        return [cardNum, ...words];
    }
    return words;
}

// Split parts that contain "number + name" patterns like "1 Pascal Siakam"
function splitNumberNameParts(parts) {
    const result = [];

    for (const part of parts) {
        // Pattern: starts with number(s), followed by space, then a name
        // Examples: "1 Pascal Siakam", "10 Talen Horton-Tucker", "RC-1 Victor Wembanyama"
        // Also handles: "11 T.J. McConnell", "5 D'Angelo Russell", "19 P.J. Washington"
        // Hyphenated names: "Nickeil Alexander-Walker", "Kentavious Caldwell-Pope"
        // Accented names: "Yanic Konan-Niederhäuser", "José Calderón"
        // Card number: digits, or short prefix (1-3 letters) + optional dash + digits
        // Name: starts with letter (including accented), followed by letter/period/apostrophe/dash
        const match = part.match(/^(\d+|[A-Z]{1,3}-?\d+|RC-?\d+)\s+([A-Za-zÀ-ÿ][a-zA-ZÀ-ÿ.'-].*)/i);

        if (match) {
            // Split into card number and player name (team split happens in post-processing)
            result.push(match[1]);  // card number
            result.push(match[2]);  // player name (may include team)
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

    const previewRows = state.parsedRows.map((row, rowIndex) => {
        const mappedRow = {};

        mappedRow.product_id = state.productId;
        if (state.dataType === 'odds') {
            mappedRow.config = state.boxConfig;
            mappedRow.category = state.cardCategory;
        } else {
            // Checklist: add set_type and set_name (use per-row metadata if available)
            const rowMeta = state.rowMetadata[rowIndex] || {};
            mappedRow.set_type = rowMeta.set_type || state.setType;
            mappedRow.set_name = rowMeta.set_name || state.setName;
        }

        for (const [colIndex, colName] of Object.entries(state.columnMapping)) {
            mappedRow[colName] = row[parseInt(colIndex)] || '';
        }

        // Auto-detect rookie status for checklists
        if (state.dataType === 'checklist') {
            mappedRow.rookie = detectRookieStatus(mappedRow, row);
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

    html += `<p class="preview-note">${state.parsedRows.length} total rows</p>`;

    container.innerHTML = html;
}

// Detect if a card is a rookie card based on various indicators
// rawRow: optional array of original parsed values (to check unmapped columns)
function detectRookieStatus(row, rawRow) {
    // First check if there's an explicitly mapped rookie column value
    if (row.rookie) {
        // Check if it contains "Rookie" or similar indicators
        if (/rookie/i.test(row.rookie) || /^(true|yes|1|rc)$/i.test(row.rookie)) {
            return 'TRUE';
        }
        // If it's explicitly "false" or "no", respect that
        if (/^(false|no|0)$/i.test(row.rookie)) {
            return 'FALSE';
        }
    }

    // Check card_num for RC prefix
    if (row.card_num && /^RC/i.test(row.card_num)) {
        return 'TRUE';
    }

    // Check player name for RC suffix or (RC) tag
    if (row.player) {
        if (/\bRC\b/i.test(row.player) || /\(RC\)/i.test(row.player)) {
            return 'TRUE';
        }
    }

    // Check set_name for rookie-related terms
    if (row.set_name) {
        if (/rookie/i.test(row.set_name)) {
            return 'TRUE';
        }
    }

    // Check set_type
    if (row.set_type && /rookie/i.test(row.set_type)) {
        return 'TRUE';
    }

    // Check if "Rookie" appears anywhere in any mapped field value
    for (const value of Object.values(row)) {
        if (value && typeof value === 'string' && /\brookie\b/i.test(value)) {
            return 'TRUE';
        }
    }

    // Check unmapped columns from raw row data (e.g., 4th column "Rookie" that wasn't mapped)
    if (rawRow && Array.isArray(rawRow)) {
        for (const value of rawRow) {
            if (value && typeof value === 'string' && /\brookie\b/i.test(value)) {
                return 'TRUE';
            }
        }
    }

    return 'FALSE';
}

// ========================================
// Step 5: Generate CSV
// ========================================

function generateCSV() {
    const expectedCols = state.dataType === 'odds' ? ODDS_COLUMNS : CHECKLIST_COLUMNS;
    const csvRows = [];

    csvRows.push(expectedCols.join(','));

    state.parsedRows.forEach((row, rowIndex) => {
        // Build a mapped row object first
        const rowData = {};
        rowData.product_id = state.productId;

        if (state.dataType === 'odds') {
            rowData.config = state.boxConfig;
            rowData.category = state.cardCategory;
        } else {
            // Use per-row metadata if available, fallback to global state
            const rowMeta = state.rowMetadata[rowIndex] || {};
            rowData.set_type = rowMeta.set_type || state.setType;
            rowData.set_name = rowMeta.set_name || state.setName;
        }

        // Map columns from parsed data
        for (const [colIndex, colName] of Object.entries(state.columnMapping)) {
            rowData[colName] = row[parseInt(colIndex)] || '';
        }

        // Auto-detect rookie for checklists
        if (state.dataType === 'checklist') {
            rowData.rookie = detectRookieStatus(rowData, row);
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
    });

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
