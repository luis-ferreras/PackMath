// ========================================
// PackMath Data Converter
// ========================================

// Initialize PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// LocalStorage key for saved reference data
const REFERENCE_DATA_KEY = 'packmath_reference_cardtypes';

// State
let state = {
    dataType: null,        // 'odds', 'checklist', 'combined', or 'multiConfigOdds'
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
    currentStep: 1,
    // Combined mode additional state
    checklistRawData: '',
    oddsRawData: '',
    checklistParsedRows: [],
    checklistRowMetadata: [],
    oddsParsedRows: [],
    checklistColumns: [],
    oddsColumns: [],
    checklistColumnMapping: {},
    oddsColumnMapping: {},
    validationWarnings: [],
    // Multi-config odds state
    multiConfigParsedRows: [],
    multiConfigConfigs: []
};

// ========================================
// Reference Data Management (for odds parsing)
// ========================================

// Save card types from checklist to localStorage
function saveReferenceCardTypes(setNames) {
    const uniqueNames = [...new Set(setNames.filter(n => n && n.trim()))];
    localStorage.setItem(REFERENCE_DATA_KEY, JSON.stringify(uniqueNames));
    updateReferenceDataStatus();
    return uniqueNames.length;
}

// Load saved card types from localStorage
function loadReferenceCardTypes() {
    try {
        const data = localStorage.getItem(REFERENCE_DATA_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Error loading reference data:', e);
        return [];
    }
}

// Clear saved reference data
function clearReferenceData() {
    localStorage.removeItem(REFERENCE_DATA_KEY);
    updateReferenceDataStatus();
}

// Update UI to show reference data status
function updateReferenceDataStatus() {
    const statusEl = document.getElementById('referenceDataStatus');
    if (!statusEl) return;

    const cardTypes = loadReferenceCardTypes();
    if (cardTypes.length > 0) {
        statusEl.innerHTML = `
            <div class="reference-status has-data">
                <span>✓ ${cardTypes.length} card types loaded from checklist</span>
                <button type="button" class="btn-small" onclick="viewReferenceData()">View</button>
                <button type="button" class="btn-small btn-danger" onclick="clearReferenceData()">Clear</button>
            </div>
        `;
    } else {
        statusEl.innerHTML = `
            <div class="reference-status no-data">
                <span>⚠ No reference data. Process a checklist first for accurate card_type/parallel splitting.</span>
            </div>
        `;
    }
}

// Show saved reference data
function viewReferenceData() {
    const cardTypes = loadReferenceCardTypes();
    alert('Saved Card Types:\n\n' + cardTypes.join('\n'));
}

// Expected columns for each data type (matching Google Sheets column names)
const ODDS_COLUMNS = ['product_id', 'box', 'type', 'set_name', 'parallel', 'numbered', 'odds'];
const CHECKLIST_COLUMNS = ['product_id', 'type', 'set_name', 'number', 'player', 'team', 'rookie'];

// Known parallel names for fallback detection when reference data isn't available
// These are matched at the END of card names (case-insensitive)
// Sorted by length (longest first) to match multi-word parallels first
const KNOWN_PARALLELS = [
    // Multi-word parallels (must come first for proper matching)
    'Summer Solstice', 'Winter Solstice', 'Moon Beam', 'Witching Hour', 'Black Light',
    'Gold Vinyl', 'Gold Wave', 'Green Wave', 'Blue Wave', 'Red Wave',
    'Asia Exclusive', 'Hobby Exclusive', 'Retail Exclusive',
    'Fast Break', 'Disco', 'Choice', 'Snakeskin', 'Mojo', 'Camo',
    'White Sparkle', 'Red White Blue', 'Tie Dye',
    // Single-word parallels
    'Zodiac', 'Morning', 'Twilight', 'Dusk', 'Moonrise', 'Equinox',
    'Midnight', 'Daybreak', 'Shimmer', 'Sparkle',
    'Gold', 'Silver', 'Bronze', 'Platinum', 'Diamond',
    'Red', 'Blue', 'Green', 'Orange', 'Purple', 'Pink', 'Yellow', 'Black', 'White',
    'Refractor', 'Prizm', 'Holo', 'Foil', 'Chrome',
    'Superfractor', 'Xfractor', 'Hyper', 'Atomic',
    'Ice', 'Lava', 'Magenta', 'Cyan', 'Teal', 'Neon',
    'Rated Rookie', 'Optic', 'Select', 'Mosaic'
];

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

const MULTI_CONFIG_ODDS_INSTRUCTIONS = `
    <p><strong>Upload your multi-config odds PDF or paste the data:</strong></p>
    <ol>
        <li>Enter the number of box configs and their names in Step 2 first</li>
        <li>Upload the PDF or paste the odds table data here</li>
        <li>The parser will skip the PDF header and use your manually entered config names</li>
        <li>Each row should have: Card Name, followed by odds (1:X) for each config</li>
    </ol>
    <p><em>Empty odds cells will become dashes (-) in the output.</em></p>
`;

// ========================================
// Initialize on DOM Ready
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    // Set up PDF upload handlers
    setupPDFUpload();
    // Set up combined mode PDF upload handlers
    setupCombinedPDFUploads();
    // Set up combined multi-config mode PDF upload handlers
    setupCombinedMultiConfigUploads();
    // Show reference data status
    updateReferenceDataStatus();
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

    // Show/hide appropriate paste sections based on mode
    const singleUploadSection = document.getElementById('singleUploadSection');
    const singleDivider = document.getElementById('singleDivider');
    const singlePasteSection = document.getElementById('singlePasteSection');
    const combinedPasteSection = document.getElementById('combinedPasteSection');
    const combinedMultiConfigSection = document.getElementById('combinedMultiConfigSection');

    if (state.dataType === 'combined') {
        singleUploadSection?.classList.add('hidden');
        singleDivider?.classList.add('hidden');
        singlePasteSection?.classList.add('hidden');
        combinedPasteSection?.classList.remove('hidden');
        combinedMultiConfigSection?.classList.add('hidden');
    } else if (state.dataType === 'combinedMultiConfig') {
        singleUploadSection?.classList.add('hidden');
        singleDivider?.classList.add('hidden');
        singlePasteSection?.classList.add('hidden');
        combinedPasteSection?.classList.add('hidden');
        combinedMultiConfigSection?.classList.remove('hidden');
    } else {
        singleUploadSection?.classList.remove('hidden');
        singleDivider?.classList.remove('hidden');
        singlePasteSection?.classList.remove('hidden');
        combinedPasteSection?.classList.add('hidden');
        combinedMultiConfigSection?.classList.add('hidden');
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

// Setup PDF upload handlers for combined mode (checklist + odds)
function setupCombinedPDFUploads() {
    // Checklist PDF upload
    setupCombinedUploadArea(
        'checklistUploadArea',
        'checklistPdfInput',
        'checklistUploadStatus',
        'checklistUploadStatusText',
        'checklistPasteArea'
    );

    // Odds PDF upload
    setupCombinedUploadArea(
        'oddsUploadArea',
        'oddsPdfInput',
        'oddsUploadStatus',
        'oddsUploadStatusText',
        'oddsPasteArea'
    );
}

// Set up PDF uploads for combined multi-config mode
function setupCombinedMultiConfigUploads() {
    // Checklist PDF upload
    setupCombinedUploadArea(
        'mcChecklistUploadArea',
        'mcChecklistPdfInput',
        'mcChecklistUploadStatus',
        'mcChecklistUploadStatusText',
        'mcChecklistPasteArea'
    );

    // Multi-config odds PDF upload (uses special extraction)
    setupMultiConfigOddsUploadArea(
        'mcOddsUploadArea',
        'mcOddsPdfInput',
        'mcOddsUploadStatus',
        'mcOddsUploadStatusText',
        'mcOddsPasteArea'
    );
}

// Setup multi-config odds upload area (uses extractMultiConfigText)
function setupMultiConfigOddsUploadArea(uploadAreaId, inputId, statusId, statusTextId, pasteAreaId) {
    const uploadArea = document.getElementById(uploadAreaId);
    const pdfInput = document.getElementById(inputId);

    if (!uploadArea || !pdfInput) return;

    uploadArea.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') {
            pdfInput.click();
        }
    });

    pdfInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            processMultiConfigOddsPDF(file, uploadAreaId, statusId, statusTextId, pasteAreaId);
        }
    });

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
            processMultiConfigOddsPDF(file, uploadAreaId, statusId, statusTextId, pasteAreaId);
        } else {
            alert('Please upload a PDF file');
        }
    });
}

// Process PDF for multi-config odds with comma-separated output
async function processMultiConfigOddsPDF(file, uploadAreaId, statusId, statusTextId, pasteAreaId) {
    const uploadArea = document.getElementById(uploadAreaId);
    const uploadStatus = document.getElementById(statusId);
    const statusText = document.getElementById(statusTextId);
    const configCount = parseInt(document.getElementById('configCount')?.value || '1', 10);

    uploadStatus?.classList.remove('hidden');
    if (statusText) statusText.textContent = 'Processing...';

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;

        let fullText = '';

        for (let i = 1; i <= numPages; i++) {
            if (statusText) statusText.textContent = `Page ${i}/${numPages}...`;

            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // Use multi-config extraction with comma-separated output
            const pageText = extractMultiConfigText(textContent, configCount);
            fullText += pageText + '\n';
        }

        const pasteArea = document.getElementById(pasteAreaId);
        if (pasteArea) {
            pasteArea.value = fullText.trim();
        }

        uploadArea?.classList.add('has-file');
        if (statusText) statusText.textContent = `✓ ${file.name}`;

        setTimeout(() => {
            uploadStatus?.classList.add('hidden');
        }, 2000);

    } catch (error) {
        console.error('PDF processing error:', error);
        if (statusText) statusText.textContent = 'Error: ' + error.message;

        setTimeout(() => {
            uploadStatus?.classList.add('hidden');
        }, 3000);
    }
}

// Setup a single combined mode upload area
function setupCombinedUploadArea(uploadAreaId, inputId, statusId, statusTextId, pasteAreaId) {
    const uploadArea = document.getElementById(uploadAreaId);
    const pdfInput = document.getElementById(inputId);

    if (!uploadArea || !pdfInput) return;

    // Click on area to trigger file input
    uploadArea.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') {
            pdfInput.click();
        }
    });

    // File input change
    pdfInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            processCombinedPDF(file, uploadAreaId, statusId, statusTextId, pasteAreaId);
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
            processCombinedPDF(file, uploadAreaId, statusId, statusTextId, pasteAreaId);
        } else {
            alert('Please upload a PDF file');
        }
    });
}

// Process PDF for combined mode and populate the target paste area
async function processCombinedPDF(file, uploadAreaId, statusId, statusTextId, pasteAreaId) {
    const uploadArea = document.getElementById(uploadAreaId);
    const uploadStatus = document.getElementById(statusId);
    const statusText = document.getElementById(statusTextId);

    // Show processing status
    uploadStatus?.classList.remove('hidden');
    if (statusText) statusText.textContent = 'Processing...';

    try {
        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // Load PDF with PDF.js
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;

        let fullText = '';

        // Extract text from all pages
        for (let i = 1; i <= numPages; i++) {
            if (statusText) statusText.textContent = `Page ${i}/${numPages}...`;

            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // Process text items with position awareness
            const pageText = extractTextWithStructure(textContent);
            fullText += pageText + '\n';
        }

        // Put extracted text in the target paste area
        const pasteArea = document.getElementById(pasteAreaId);
        if (pasteArea) {
            pasteArea.value = fullText.trim();
        }

        // Mark upload area as having a file
        uploadArea?.classList.add('has-file');

        // Update status to show success
        if (statusText) statusText.textContent = `✓ ${file.name}`;

        // Hide status after a moment
        setTimeout(() => {
            uploadStatus?.classList.add('hidden');
        }, 2000);

    } catch (error) {
        console.error('PDF processing error:', error);
        if (statusText) statusText.textContent = 'Error: ' + error.message;

        // Hide status after showing error
        setTimeout(() => {
            uploadStatus?.classList.add('hidden');
        }, 3000);
    }
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

            // Use different extraction based on data type
            let pageText;
            if (state.dataType === 'multiConfigOdds') {
                const configCount = parseInt(document.getElementById('configCount')?.value || '1', 10);
                pageText = extractMultiConfigText(textContent, configCount);
            } else {
                pageText = extractTextWithStructure(textContent);
            }
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

// Extract text formatted for multi-config odds (comma-separated with dashes)
function extractMultiConfigText(textContent, configCount) {
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
            return b.y - a.y;
        }
        return a.x - b.x;
    });

    for (const item of items) {
        if (item.text.trim() === '') continue;

        if (lastY === null || Math.abs(item.y - lastY) > yTolerance) {
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

    // Find column positions from rows with odds data
    const columnPositions = detectColumnPositions(rows, configCount);

    // Convert rows to comma-separated lines
    const lines = rows.map(row => {
        row.sort((a, b) => a.x - b.x);

        // Check if this row has odds data
        const hasOdds = row.some(item => /\d+:\d+/.test(item.text));

        if (!hasOdds) {
            // Non-data row (header, etc.) - just join with spaces
            return row.map(item => item.text).join(' ');
        }

        // Extract card name (items before first odds)
        let cardName = '';
        let oddsItems = [];
        let foundFirstOdds = false;

        for (const item of row) {
            if (/\d+:\d+/.test(item.text)) {
                foundFirstOdds = true;
                oddsItems.push(item);
            } else if (!foundFirstOdds) {
                cardName += (cardName ? ' ' : '') + item.text;
            }
        }

        // Map odds to column positions
        const oddsValues = new Array(configCount).fill('-');

        if (columnPositions.length > 0) {
            for (const item of oddsItems) {
                // Find which column this odds belongs to
                const colIndex = findClosestColumn(item.x, columnPositions);
                if (colIndex >= 0 && colIndex < configCount) {
                    oddsValues[colIndex] = item.text;
                }
            }
        } else {
            // Fallback: just use odds in order
            oddsItems.forEach((item, idx) => {
                if (idx < configCount) {
                    oddsValues[idx] = item.text;
                }
            });
        }

        // Format as comma-separated
        return cardName.trim() + ', ' + oddsValues.join(', ');
    });

    return lines.filter(line => line.length > 0).join('\n');
}

// Detect column x-positions from rows with odds
function detectColumnPositions(rows, expectedColumns) {
    const xPositions = [];

    // Collect x positions of all odds values
    for (const row of rows) {
        for (const item of row) {
            if (/\d+:\d+/.test(item.text)) {
                xPositions.push(item.x);
            }
        }
    }

    if (xPositions.length === 0) return [];

    // Cluster x positions to find column boundaries
    xPositions.sort((a, b) => a - b);

    const clusters = [];
    let currentCluster = [xPositions[0]];
    const clusterTolerance = 20; // pixels

    for (let i = 1; i < xPositions.length; i++) {
        if (xPositions[i] - xPositions[i-1] < clusterTolerance) {
            currentCluster.push(xPositions[i]);
        } else {
            clusters.push(currentCluster);
            currentCluster = [xPositions[i]];
        }
    }
    clusters.push(currentCluster);

    // Get average x for each cluster
    const columnXs = clusters.map(cluster =>
        Math.round(cluster.reduce((a, b) => a + b, 0) / cluster.length)
    );

    return columnXs;
}

// Find the closest column index for an x position
function findClosestColumn(x, columnPositions) {
    let minDist = Infinity;
    let closestIdx = -1;

    for (let i = 0; i < columnPositions.length; i++) {
        const dist = Math.abs(x - columnPositions[i]);
        if (dist < minDist) {
            minDist = dist;
            closestIdx = i;
        }
    }

    // Only return if reasonably close (within 50 pixels)
    return minDist < 50 ? closestIdx : -1;
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
        currentStep: 1,
        // Combined mode state
        checklistRawData: '',
        oddsRawData: '',
        checklistParsedRows: [],
        checklistRowMetadata: [],
        oddsParsedRows: [],
        checklistColumns: [],
        oddsColumns: [],
        checklistColumnMapping: {},
        oddsColumnMapping: {},
        validationWarnings: [],
        // Multi-config odds state
        multiConfigParsedRows: [],
        multiConfigConfigs: []
    };

    document.querySelectorAll('.data-type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById('productId').value = '';
    document.getElementById('boxConfig').value = '';
    document.getElementById('cardCategory').value = 'base';
    // setType is auto-detected from headers, no UI element needed
    document.getElementById('setName').value = '';
    document.getElementById('pasteArea').value = '';
    document.getElementById('csvOutput').value = '';

    // Reset combined mode paste areas
    const checklistPasteArea = document.getElementById('checklistPasteArea');
    const oddsPasteArea = document.getElementById('oddsPasteArea');
    if (checklistPasteArea) checklistPasteArea.value = '';
    if (oddsPasteArea) oddsPasteArea.value = '';

    // Reset combined mode upload areas
    document.getElementById('checklistUploadArea')?.classList.remove('has-file');
    document.getElementById('oddsUploadArea')?.classList.remove('has-file');

    // Reset combined mode CSV outputs
    const checklistCsvOutput = document.getElementById('checklistCsvOutput');
    const oddsCsvOutput = document.getElementById('oddsCsvOutput');
    if (checklistCsvOutput) checklistCsvOutput.value = '';
    if (oddsCsvOutput) oddsCsvOutput.value = '';

    // Reset UI to default state
    document.getElementById('singlePreviewSection')?.classList.remove('hidden');
    document.getElementById('combinedPreviewSection')?.classList.add('hidden');
    document.getElementById('validationWarnings')?.classList.add('hidden');
    document.getElementById('singleCsvOutput')?.classList.remove('hidden');
    document.getElementById('singleDownloadButtons')?.classList.remove('hidden');
    document.getElementById('combinedCsvOutput')?.classList.add('hidden');
    document.getElementById('combinedBackButton')?.classList.add('hidden');

    showStep(1);
}

// ========================================
// Step 1: Select Data Type
// ========================================

// Update config name inputs based on count
function updateConfigInputs() {
    const count = parseInt(document.getElementById('configCount')?.value || '1', 10);
    const container = document.getElementById('configNamesContainer');
    if (!container) return;

    // Store existing values
    const existingValues = [];
    container.querySelectorAll('.config-name-input').forEach(input => {
        existingValues.push(input.value);
    });

    // Generate new inputs
    let html = '<div class="config-names-container">';
    for (let i = 0; i < count; i++) {
        const existingValue = existingValues[i] || '';
        html += `
            <div class="config-name-row">
                <span class="config-number">${i + 1}.</span>
                <input type="text" class="form-input config-name-input"
                       id="configName${i}"
                       placeholder="e.g., HTA HOBBY DISTRIBUTOR"
                       value="${escapeHtml(existingValue)}">
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;
}

// Get manually entered config names
function getManualConfigNames() {
    const count = parseInt(document.getElementById('configCount')?.value || '1', 10);
    const configs = [];
    for (let i = 0; i < count; i++) {
        const input = document.getElementById(`configName${i}`);
        const name = input?.value.trim() || `Config ${i + 1}`;
        configs.push({
            original: name,
            normalized: name,
            index: i + 1
        });
    }
    return configs;
}

function selectDataType(type) {
    state.dataType = type;

    document.querySelectorAll('.data-type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-type="${type}"]`).classList.add('active');

    // Show/hide type-specific fields
    const configRow = document.getElementById('oddsConfigRow');
    const categoryRow = document.getElementById('oddsCategoryRow');
    const referenceDataRow = document.getElementById('referenceDataRow');
    const setNameRow = document.getElementById('checklistSetNameRow');

    // Hide multi-config fields by default
    document.getElementById('multiConfigSetupRow')?.classList.add('hidden');
    document.getElementById('multiConfigNamesRow')?.classList.add('hidden');

    if (type === 'odds') {
        configRow?.classList.remove('hidden');
        categoryRow?.classList.remove('hidden');
        referenceDataRow?.classList.remove('hidden');
        setNameRow?.classList.add('hidden');
    } else if (type === 'multiConfigOdds') {
        // Multi-config odds - show config setup fields
        configRow?.classList.add('hidden');
        categoryRow?.classList.add('hidden');
        referenceDataRow?.classList.add('hidden');
        setNameRow?.classList.add('hidden');
        document.getElementById('multiConfigSetupRow')?.classList.remove('hidden');
        document.getElementById('multiConfigNamesRow')?.classList.remove('hidden');
        // Initialize config inputs
        updateConfigInputs();
    } else if (type === 'combined') {
        // Combined mode - only show product ID
        configRow?.classList.add('hidden');
        categoryRow?.classList.add('hidden');
        referenceDataRow?.classList.add('hidden');
        setNameRow?.classList.add('hidden');
    } else if (type === 'combinedMultiConfig') {
        // Combined multi-config mode - show product ID and config setup
        configRow?.classList.add('hidden');
        categoryRow?.classList.add('hidden');
        referenceDataRow?.classList.add('hidden');
        setNameRow?.classList.add('hidden');
        document.getElementById('multiConfigSetupRow')?.classList.remove('hidden');
        document.getElementById('multiConfigNamesRow')?.classList.remove('hidden');
        // Initialize config inputs
        updateConfigInputs();
    } else {
        configRow?.classList.add('hidden');
        categoryRow?.classList.add('hidden');
        referenceDataRow?.classList.add('hidden');
        // setType is auto-detected from headers, only show setName field
        setNameRow?.classList.remove('hidden');
    }

    // Update instructions based on type
    if (type !== 'combined' && type !== 'combinedMultiConfig') {
        let instructions = CHECKLIST_INSTRUCTIONS;
        if (type === 'odds') {
            instructions = ODDS_INSTRUCTIONS;
        } else if (type === 'multiConfigOdds') {
            instructions = MULTI_CONFIG_ODDS_INSTRUCTIONS;
        }
        document.getElementById('pasteInstructions').innerHTML = instructions;
    }

    showStep(2);
}

// ========================================
// Step 3: Parse Data
// ========================================

function parseData() {
    // Handle combined mode differently
    if (state.dataType === 'combined') {
        parseCombinedData();
        return;
    }

    // Handle combined multi-config mode
    if (state.dataType === 'combinedMultiConfig') {
        parseCombinedMultiConfigData();
        return;
    }

    // Handle multi-config odds differently
    if (state.dataType === 'multiConfigOdds') {
        parseMultiConfigOdds();
        return;
    }

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

        // Save unique set_name values as reference for future odds parsing
        const setNames = result.metadata.map(m => m.set_name).filter(n => n);
        const savedCount = saveReferenceCardTypes(setNames);
        if (savedCount > 0) {
            console.log(`Saved ${savedCount} unique card types for odds reference`);
        }
    }

    if (state.parsedRows.length === 0) {
        alert('Could not parse any data. Please check the format.');
        return;
    }

    detectColumns();
    renderPreview();

    showStep(4);
}

// ========================================
// Multi-Config Odds Parsing
// ========================================

// Parse multi-config odds data (multiple box configs as columns)
function parseMultiConfigOdds() {
    try {
        const rawText = document.getElementById('pasteArea').value.trim();

        if (!rawText) {
            alert('Please upload a PDF or paste some data first');
            return;
        }

        // Get manually entered config names
        const configs = getManualConfigNames();

        if (configs.length === 0 || !configs[0].original.trim()) {
            alert('Please enter at least one config name in Step 2');
            return;
        }

        state.rawData = rawText;

        // Split into lines and parse as tab/space separated values
        const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        if (lines.length < 1) {
            alert('No data found');
            return;
        }

        console.log('Using manual configs:', configs.map(c => c.original));
        console.log('Number of data lines:', lines.length);

    // Find where the actual data starts - look for lines with odds patterns (1:X)
    let dataStartLine = 0;
    for (let i = 0; i < lines.length; i++) {
        if (/\d+:\d+/.test(lines[i])) {
            dataStartLine = i;
            break;
        }
    }

    console.log('Data starts at line:', dataStartLine);

    // Parse data rows and transform to output format
    const outputRows = [];
    // Load reference data once for case-insensitive set name/parallel matching
    const referenceCardTypes = loadReferenceCardTypes();

    for (let i = dataStartLine; i < lines.length; i++) {
        const line = lines[i];

        // Skip lines without any odds patterns or dashes
        if (!/\d+:\d+/.test(line) && !line.includes('-')) continue;

        // Skip if line looks like a header
        if (isHeaderLine(line)) continue;

        // Check if line is comma-separated (our formatted output)
        let cardName, oddsValues;

        if (line.includes(',')) {
            // Comma-separated format: "Card Name, 1:3, 1:1, -, 1:7, ..."
            const parts = line.split(',').map(p => p.trim());
            cardName = parts[0];
            oddsValues = parts.slice(1);
        } else {
            // Legacy format: extract card name and odds
            cardName = extractCardName(line);
            if (!cardName) continue;
            oddsValues = extractOddsFromLine(line, cardName);
        }

        if (!cardName) continue;

        // Split card name into set_name and parallel using reference data if available
        let cardType, parallel, cardCategory;
        if (referenceCardTypes && referenceCardTypes.length > 0) {
            const split = splitCardTypeAndParallel(cardName, referenceCardTypes);
            cardType = split.cardType;
            parallel = split.parallel;
            // Detect type from the card type only (not full name with parallel)
            cardCategory = detectCategory(cardType);
        } else {
            const split = splitCardNameIntoTypeAndParallel(cardName);
            cardType = split.cardType;
            parallel = split.parallel;
            cardCategory = detectCategory(cardType);
        }

        // Create a row for EACH box config, using dash for empty odds
        for (let j = 0; j < configs.length; j++) {
            const odds = oddsValues[j] || '-';
            outputRows.push({
                box: configs[j].original,
                boxOriginal: configs[j].original,
                set_name: cardType,
                parallel: parallel || 'Base',
                numbered: '-',
                odds: odds,
                type: cardCategory
            });
        }
    }

    if (outputRows.length === 0) {
        // Count odds patterns in the raw text for debugging
        const allOddsMatches = rawText.match(/\d+:\d+/g) || [];
        const linesWithOdds = lines.filter(l => /\d+:\d+/.test(l)).length;

        let errorMsg = 'No valid odds data found.\n\n';
        errorMsg += `Lines with odds patterns: ${linesWithOdds}\n`;
        errorMsg += `Total odds patterns: ${allOddsMatches.length}\n\n`;

        if (allOddsMatches.length === 0) {
            errorMsg += 'The extracted text contains NO odds ratios (1:X format).\n\n';
            errorMsg += 'The PDF table data is not extracting properly.\n\n';
            errorMsg += 'SOLUTION: Copy the odds table from your PDF and paste directly into the text area, OR open the PDF in a browser and copy the table from there.';
        } else {
            errorMsg += 'Odds were found but all lines were filtered as headers.\n';
            errorMsg += 'Try pasting the data in comma-separated format:\n';
            errorMsg += 'Card Name, 1:3, 1:1, -, 1:7, ...';
        }

        console.log('Debug - Configs:', configs.map(c => c.original));
        console.log('Debug - All lines:', lines);
        console.log('Debug - Odds found:', allOddsMatches);

        alert(errorMsg);
        return;
    }

    console.log('Parsed rows:', outputRows.length);

    // Store parsed data in state
    state.multiConfigParsedRows = outputRows;
    state.multiConfigConfigs = configs;

    // Render preview
    renderMultiConfigPreview();

    showStep(4);

    } catch (error) {
        console.error('Parse error:', error);
        alert('Error parsing data: ' + error.message + '\n\nCheck the browser console for details.');
    }
}

// Split a row into cells (handles tabs, multiple spaces, and common delimiters)
function splitMultiConfigRow(line) {
    // First try tab-separated
    if (line.includes('\t')) {
        return line.split('\t');
    }

    // Try to detect column boundaries using multiple spaces
    // This is common in PDF extraction where columns are space-aligned
    const cells = line.split(/\s{2,}/);
    if (cells.length > 1) {
        return cells;
    }

    // Fall back to detecting odds patterns to split
    // Look for patterns like "CardName 1:2 1:3 1:4"
    const oddsPattern = /(\d+:\d+)/g;
    const matches = [...line.matchAll(oddsPattern)];

    if (matches.length > 0) {
        // Find the position of the first odds value
        const firstOddsPos = matches[0].index;
        const cardName = line.substring(0, firstOddsPos).trim();

        // Extract all odds values
        const oddsValues = matches.map(m => m[1]);

        return [cardName, ...oddsValues];
    }

    // Last resort: split by single spaces but this is unreliable
    return line.split(/\s+/);
}

// Parse header row to extract config names
function parseMultiConfigHeaders(headerCells) {
    const configs = [];

    // Skip first cell (usually "Card" or empty)
    for (let i = 1; i < headerCells.length; i++) {
        const header = headerCells[i].trim();
        if (!header) continue;

        const normalized = normalizeConfigName(header);
        if (normalized) {
            configs.push({
                original: header,
                normalized: normalized,
                index: i
            });
        }
    }

    return configs;
}

// Normalize config header to standard config names
function normalizeConfigName(header) {
    const h = header.toLowerCase();

    // Match common box config patterns
    if (h.includes('hobby') && !h.includes('fotl')) return 'hobby';
    if (h.includes('jumbo')) return 'jumbo';
    if (h.includes('breaker')) return 'breaker';
    if (h.includes('sapphire')) return 'sapphire';
    if (h.includes('hanger')) return 'hanger';
    if (h.includes('mega')) return 'mega';
    if (h.includes('value') && h.includes('se')) return 'value_se';
    if (h.includes('value')) return 'value';
    if (h.includes('blaster')) return 'blaster';
    if (h.includes('cello')) return 'cello';
    if (h.includes('fat pack') || h.includes('fatpack')) return 'fat_pack';
    if (h.includes('retail')) return 'retail';
    if (h.includes('fotl') || h.includes('first off')) return 'fotl';
    if (h.includes('fanatics') && h.includes('bulk')) return 'fanatics_bulk';
    if (h.includes('fanatics') && h.includes('mega')) return 'fanatics_mega';
    if (h.includes('fanatics')) return 'fanatics';
    if (h.includes('refractor') && h.includes('set')) return 'refractor_set';
    if (h.includes('box set')) return 'box_set';
    if (h.includes('hta')) return 'hta';

    // If we can't identify it, use the original (cleaned up)
    return header.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || null;
}

// Check if a line is a header or noise line that should be skipped
function isHeaderOrNoiseLine(line, configs) {
    const lower = line.toLowerCase();

    // Skip typical header keywords
    if (lower.includes('overall odds') || lower.includes('card type') ||
        lower.includes('insert odds') || lower.includes('pack odds')) {
        return true;
    }

    // Skip if the line is mostly config names (header row)
    const configMatches = configs.filter(c => lower.includes(c.normalized));
    if (configMatches.length >= Math.floor(configs.length / 2)) {
        return true;
    }

    // Skip very short lines
    if (line.trim().length < 3) {
        return true;
    }

    return false;
}

// Extract card name from a line (text before the first odds pattern)
function extractCardName(line) {
    // Find the position of the first odds pattern (1:X)
    const oddsMatch = line.match(/\d+:\d+/);
    if (oddsMatch) {
        const cardName = line.substring(0, oddsMatch.index).trim();
        // Clean up any trailing spaces or special characters
        return cardName.replace(/[\s\-–—]+$/, '').trim();
    }

    // If no odds found, the whole line might be a card name (rare)
    // But only if it doesn't contain numbers that look like config headers
    if (!/\d{4}/.test(line) && !/distributor|hobby|jumbo|breaker/i.test(line)) {
        return line.trim();
    }

    return null;
}

// Check if a line looks like a header row or noise
function isHeaderLine(line) {
    const lower = line.toLowerCase();

    // Check for common header keywords
    if (lower.includes('card type') || lower.includes('odds per') ||
        lower.includes('overall odds') || lower.includes('insert odds') ||
        lower.includes('pack odds') || lower.includes('card ')) {
        return true;
    }

    // Check if it has ANY config-like keywords (these are headers, not card names)
    const configKeywords = ['hobby', 'jumbo', 'breaker', 'sapphire', 'hanger', 'mega', 'blaster', 'retail', 'value', 'fanatics', 'distributor', 'hta', 'chrome', 'nba-'];
    const matches = configKeywords.filter(kw => lower.includes(kw));
    if (matches.length >= 1) {
        return true;
    }

    // Skip lines with year patterns (2025-, 2024-, etc.)
    if (/20\d{2}[-\s]/.test(line)) {
        return true;
    }

    // Skip lines that are mostly dashes or special characters
    if (/^[\s\-–—]+$/.test(line.trim())) {
        return true;
    }

    // Skip lines with "PACK", "BOX", "SET" alone (header remnants)
    if (/^(pack|box|set)\s*$/i.test(line.trim())) {
        return true;
    }

    return false;
}

// Extract all odds values from a line
function extractOddsFromLine(line, cardName) {
    // Remove the card name from the line first
    let remainder = line;
    if (cardName) {
        const cardNameIndex = line.indexOf(cardName);
        if (cardNameIndex !== -1) {
            remainder = line.substring(cardNameIndex + cardName.length);
        }
    }

    // Find all odds patterns (1:X format)
    const oddsPattern = /\b(\d+:\d+)\b/g;
    const matches = [];
    let match;

    while ((match = oddsPattern.exec(remainder)) !== null) {
        matches.push(match[1]);
    }

    return matches;
}

// Find config names in messy text (for PDF extraction that doesn't preserve columns)
function findConfigsInText(text) {
    const configs = [];
    const foundConfigs = new Set();

    // Common config keywords to search for (order matters for priority)
    const configPatterns = [
        { pattern: /\bfotl\b|\bfirst\s*off\s*the\s*line\b/gi, normalized: 'fotl' },
        { pattern: /\bhta\s*hobby\b/gi, normalized: 'hta' },
        { pattern: /\bhobby\b/gi, normalized: 'hobby' },
        { pattern: /\bjumbo\b/gi, normalized: 'jumbo' },
        { pattern: /\bbreaker\b/gi, normalized: 'breaker' },
        { pattern: /\bsapphire\b/gi, normalized: 'sapphire' },
        { pattern: /\bhanger\b/gi, normalized: 'hanger' },
        { pattern: /\bmega\b/gi, normalized: 'mega' },
        { pattern: /\bvalue\s*se\b/gi, normalized: 'value_se' },
        { pattern: /\bvalue\b/gi, normalized: 'value' },
        { pattern: /\bblaster\b/gi, normalized: 'blaster' },
        { pattern: /\bcello\b/gi, normalized: 'cello' },
        { pattern: /\bfat\s*pack\b|\bfatpack\b/gi, normalized: 'fat_pack' },
        { pattern: /\bretail\b/gi, normalized: 'retail' },
        { pattern: /\bfanatics\s*bulk\b/gi, normalized: 'fanatics_bulk' },
        { pattern: /\bfanatics\s*mega\b/gi, normalized: 'fanatics_mega' },
        { pattern: /\bfanatics\b/gi, normalized: 'fanatics' }
    ];

    for (const { pattern, normalized } of configPatterns) {
        const match = text.match(pattern);
        if (match && !foundConfigs.has(normalized)) {
            foundConfigs.add(normalized);
            configs.push({
                original: match[0],
                normalized: normalized,
                index: configs.length + 1
            });
        }
    }

    return configs;
}

// Split card name into card_type and parallel
function splitCardNameIntoTypeAndParallel(cardName) {
    // Common patterns:
    // "Base" -> cardType: "Base", parallel: ""
    // "Base Refractors" -> cardType: "Base", parallel: "Refractors"
    // "Base Refractors Prism" -> cardType: "Base", parallel: "Refractors Prism"
    // "Rookie Autographs Gold" -> cardType: "Rookie Autographs", parallel: "Gold"

    const name = cardName.trim();

    // Check if it starts with "Base"
    if (name.toLowerCase().startsWith('base')) {
        if (name.toLowerCase() === 'base') {
            return { cardType: 'Base', parallel: '' };
        }
        // Everything after "Base " is the parallel
        const parallel = name.substring(5).trim();
        return { cardType: 'Base', parallel: parallel };
    }

    // Check for common card type prefixes
    const cardTypePatterns = [
        { pattern: /^(Rookie\s+Autographs?)\s+(.+)$/i, type: 1, parallel: 2 },
        { pattern: /^(Autographs?)\s+(.+)$/i, type: 1, parallel: 2 },
        { pattern: /^(Inserts?)\s+(.+)$/i, type: 1, parallel: 2 },
        { pattern: /^(Rookies?)\s+(.+)$/i, type: 1, parallel: 2 },
    ];

    for (const { pattern, type, parallel } of cardTypePatterns) {
        const match = name.match(pattern);
        if (match) {
            return { cardType: match[type], parallel: match[parallel] };
        }
    }

    // Default: treat entire name as card_type, no parallel
    return { cardType: name, parallel: '' };
}

// Detect category from card name
function detectCategoryFromCardName(cardName) {
    const name = cardName.toLowerCase();

    if (name.includes('autograph') || name.includes('auto ') || name.includes('signature')) {
        if (name.includes('relic') || name.includes('jersey') || name.includes('patch')) {
            return 'autograph_relic';
        }
        return 'autograph';
    }
    if (name.includes('relic') || name.includes('jersey') || name.includes('patch') || name.includes('memorabilia')) {
        return 'relic';
    }
    if (name.includes('insert') || name.includes('mosaic') || name.includes('prizm')) {
        return 'insert';
    }
    if (name.startsWith('base') || name.includes('refractor') || name.includes('parallel')) {
        return 'base';
    }

    // Default to base for unknown
    return 'base';
}

// Render preview for multi-config odds
function renderMultiConfigPreview() {
    const container = document.getElementById('previewContainer');

    if (!container) {
        console.error('Preview container not found');
        return;
    }

    if (!state.multiConfigParsedRows || state.multiConfigParsedRows.length === 0) {
        container.innerHTML = '<p class="preview-note">No data to preview</p>';
        return;
    }

    // Show the rows in a table format
    const expectedCols = ODDS_COLUMNS;

    let html = '<table class="preview-table"><thead><tr>';
    for (const col of expectedCols) {
        html += `<th>${formatColumnName(col)}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (const row of state.multiConfigParsedRows.slice(0, 100)) { // Limit preview to 100 rows
        html += '<tr>';
        html += `<td>${escapeHtml(state.productId)}</td>`;
        html += `<td>${escapeHtml(row.box)}</td>`;
        html += `<td>${escapeHtml(row.type)}</td>`;
        html += `<td>${escapeHtml(row.set_name)}</td>`;
        html += `<td>${escapeHtml(row.parallel)}</td>`;
        html += `<td>${escapeHtml(row.numbered)}</td>`;
        html += `<td>${escapeHtml(row.odds)}</td>`;
        html += '</tr>';
    }

    html += '</tbody></table>';

    if (state.multiConfigParsedRows.length > 100) {
        html += `<p class="preview-note">Showing first 100 of ${state.multiConfigParsedRows.length} rows</p>`;
    }

    // Add summary
    const boxCounts = {};
    state.multiConfigParsedRows.forEach(row => {
        boxCounts[row.box] = (boxCounts[row.box] || 0) + 1;
    });

    html = `<div class="preview-summary">
        <p><strong>${state.multiConfigParsedRows.length}</strong> total rows across <strong>${Object.keys(boxCounts).length}</strong> box configurations</p>
        <p>Box configs: ${Object.entries(boxCounts).map(([k, v]) => `${k} (${v})`).join(', ')}</p>
    </div>` + html;

    container.innerHTML = html;
}

// Parse combined checklist + odds data
function parseCombinedData() {
    const checklistText = document.getElementById('checklistPasteArea').value.trim();
    const oddsText = document.getElementById('oddsPasteArea').value.trim();

    if (!checklistText && !oddsText) {
        alert('Please paste data in at least one of the areas');
        return;
    }

    state.checklistRawData = checklistText;
    state.oddsRawData = oddsText;
    state.validationWarnings = [];

    // Parse checklist first (to get set_names for odds parsing)
    let checklistSetNames = [];
    if (checklistText) {
        const checklistLines = checklistText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        // Detect header row
        const firstLine = checklistLines[0]?.toLowerCase() || '';
        const hasHeader = firstLine.includes('card') || firstLine.includes('player') ||
                          firstLine.includes('team') || firstLine.includes('number');
        const dataLines = hasHeader ? checklistLines.slice(1) : checklistLines;

        const result = parseChecklistData(dataLines);
        state.checklistParsedRows = result.rows;
        state.checklistRowMetadata = result.metadata;

        // Extract set_names for odds parsing
        checklistSetNames = [...new Set(result.metadata.map(m => m.set_name).filter(n => n))];
    } else {
        state.checklistParsedRows = [];
        state.checklistRowMetadata = [];
    }

    // Parse odds using checklist set_names as reference
    if (oddsText) {
        const oddsLines = oddsText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        // Detect header row
        const firstLine = oddsLines[0]?.toLowerCase() || '';
        const hasHeader = firstLine.includes('odds') || firstLine.includes('card') || firstLine.includes('parallel');
        const dataLines = hasHeader ? oddsLines.slice(1) : oddsLines;

        state.oddsParsedRows = parseOddsDataWithReference(dataLines, checklistSetNames);

        // Validate: check for card types not found in checklist
        if (checklistSetNames.length > 0) {
            validateOddsAgainstChecklist(state.oddsParsedRows, checklistSetNames);
        }
    } else {
        state.oddsParsedRows = [];
    }

    if (state.checklistParsedRows.length === 0 && state.oddsParsedRows.length === 0) {
        alert('Could not parse any data. Please check the format.');
        return;
    }

    // Detect columns for both datasets
    detectColumnsForCombined();
    renderCombinedPreview();

    showStep(4);
}

// Parse combined multi-config data (checklist + multi-column odds)
function parseCombinedMultiConfigData() {
    try {
        console.log('parseCombinedMultiConfigData called');

        const checklistText = document.getElementById('mcChecklistPasteArea')?.value.trim() || '';
        const oddsText = document.getElementById('mcOddsPasteArea')?.value.trim() || '';

        console.log('Checklist text length:', checklistText.length);
        console.log('Odds text length:', oddsText.length);

        if (!checklistText && !oddsText) {
            alert('Please paste data in at least one of the areas');
            return;
        }

        // Get manually entered config names
        const configs = getManualConfigNames();
        console.log('Configs:', configs);

        if (configs.length === 0 || !configs[0].original.trim()) {
            alert('Please enter config names in Step 2');
            return;
        }

        state.checklistRawData = checklistText;
        state.validationWarnings = [];

    // Parse checklist first (to get set_names for odds parsing)
    let checklistSetNames = [];
    if (checklistText) {
        const checklistLines = checklistText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        // Detect header row
        const firstLine = checklistLines[0]?.toLowerCase() || '';
        const hasHeader = firstLine.includes('card') || firstLine.includes('player') ||
                          firstLine.includes('team') || firstLine.includes('number');
        const dataLines = hasHeader ? checklistLines.slice(1) : checklistLines;

        const result = parseChecklistData(dataLines);
        state.checklistParsedRows = result.rows;
        state.checklistRowMetadata = result.metadata;

        // Extract set_names for odds parsing (enables case-insensitive matching)
        checklistSetNames = [...new Set(result.metadata.map(m => m.set_name).filter(n => n))];
    } else {
        state.checklistParsedRows = [];
        state.checklistRowMetadata = [];
    }

    // Parse multi-config odds using checklist set_names as reference
    if (oddsText) {
        state.multiConfigParsedRows = parseMultiConfigOddsText(oddsText, configs, checklistSetNames);
    } else {
        state.multiConfigParsedRows = [];
    }

    // Validate: check for card types in odds not found in checklist
    if (checklistSetNames.length > 0 && state.multiConfigParsedRows.length > 0) {
        const oddsRowsForValidation = state.multiConfigParsedRows.map(r => [r.set_name]);
        validateOddsAgainstChecklist(oddsRowsForValidation, checklistSetNames);
    }

    if (state.checklistParsedRows.length === 0 && state.multiConfigParsedRows.length === 0) {
        alert('Could not parse any data. Please check the format.');
        return;
    }

    // Detect columns for checklist
    if (state.checklistParsedRows.length > 0) {
        const maxCols = Math.max(...state.checklistParsedRows.map(row => row.length));
        state.checklistColumns = [];
        for (let i = 0; i < maxCols; i++) {
            state.checklistColumns.push(`Column ${i + 1}`);
        }
        state.checklistColumnMapping = detectColumnMappingForRows(state.checklistParsedRows, 'checklist');
    }

    state.multiConfigConfigs = configs;

    console.log('Checklist rows:', state.checklistParsedRows.length);
    console.log('Multi-config odds rows:', state.multiConfigParsedRows.length);

    // Render preview
    renderCombinedMultiConfigPreview();

    showStep(4);

    } catch (error) {
        console.error('parseCombinedMultiConfigData error:', error);
        alert('Error parsing data: ' + error.message);
    }
}

// Parse multi-config odds text into rows
function parseMultiConfigOddsText(rawText, configs, referenceCardTypes) {
    const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const outputRows = [];

    // Find where data starts
    let dataStartLine = 0;
    for (let i = 0; i < lines.length; i++) {
        if (/\d+:\d+/.test(lines[i]) || lines[i].includes(',')) {
            dataStartLine = i;
            break;
        }
    }

    for (let i = dataStartLine; i < lines.length; i++) {
        const line = lines[i];

        if (!/\d+:\d+/.test(line) && !line.includes('-')) continue;
        if (isHeaderLine(line)) continue;

        let cardName, oddsValues;

        if (line.includes(',')) {
            const parts = line.split(',').map(p => p.trim());
            cardName = parts[0];
            oddsValues = parts.slice(1);
        } else {
            cardName = extractCardName(line);
            if (!cardName) continue;
            oddsValues = extractOddsFromLine(line, cardName);
        }

        if (!cardName) continue;

        // Use reference data from checklist for case-insensitive set name/parallel matching
        let cardType, parallel, cardCategory;
        if (referenceCardTypes && referenceCardTypes.length > 0) {
            const split = splitCardTypeAndParallel(cardName, referenceCardTypes);
            cardType = split.cardType;
            parallel = split.parallel;
            // Detect type from the card type only (not full name with parallel)
            cardCategory = detectCategory(cardType);
        } else {
            const split = splitCardNameIntoTypeAndParallel(cardName);
            cardType = split.cardType;
            parallel = split.parallel;
            // Fallback: detect type from card type only for consistency
            cardCategory = detectCategory(cardType);
        }

        for (let j = 0; j < configs.length; j++) {
            const odds = oddsValues[j] || '-';
            outputRows.push({
                box: configs[j].original,
                set_name: cardType,
                parallel: parallel || 'Base',
                numbered: '-',
                odds: odds,
                type: cardCategory
            });
        }
    }

    return outputRows;
}

// Render preview for combined multi-config mode
function renderCombinedMultiConfigPreview() {
    // Show combined preview section
    document.getElementById('singlePreviewSection')?.classList.add('hidden');
    document.getElementById('combinedPreviewSection')?.classList.remove('hidden');

    // Render checklist preview
    if (state.checklistParsedRows.length > 0) {
        renderCombinedPreviewTable(
            'checklistPreviewContainer',
            state.checklistParsedRows,
            state.checklistRowMetadata,
            state.checklistColumnMapping,
            CHECKLIST_COLUMNS,
            'checklist'
        );
    } else {
        const container = document.getElementById('checklistPreviewContainer');
        if (container) container.innerHTML = '<p class="preview-note">No checklist data</p>';
    }

    // Render multi-config odds preview
    const oddsContainer = document.getElementById('oddsPreviewContainer');
    if (oddsContainer && state.multiConfigParsedRows.length > 0) {
        renderMultiConfigOddsPreviewTable(oddsContainer);
    } else if (oddsContainer) {
        oddsContainer.innerHTML = '<p class="preview-note">No odds data</p>';
    }
}

// Render multi-config odds preview table
function renderMultiConfigOddsPreviewTable(container) {
    const expectedCols = ODDS_COLUMNS;

    let html = '<table class="preview-table"><thead><tr>';
    for (const col of expectedCols) {
        html += `<th>${formatColumnName(col)}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (const row of state.multiConfigParsedRows.slice(0, 100)) {
        html += '<tr>';
        html += `<td>${escapeHtml(state.productId)}</td>`;
        html += `<td>${escapeHtml(row.box)}</td>`;
        html += `<td>${escapeHtml(row.type)}</td>`;
        html += `<td>${escapeHtml(row.set_name)}</td>`;
        html += `<td>${escapeHtml(row.parallel)}</td>`;
        html += `<td>${escapeHtml(row.numbered)}</td>`;
        html += `<td>${escapeHtml(row.odds)}</td>`;
        html += '</tr>';
    }

    html += '</tbody></table>';

    if (state.multiConfigParsedRows.length > 100) {
        html += `<p class="preview-note">Showing first 100 of ${state.multiConfigParsedRows.length} rows</p>`;
    }

    // Add summary
    const boxCounts = {};
    state.multiConfigParsedRows.forEach(row => {
        boxCounts[row.box] = (boxCounts[row.box] || 0) + 1;
    });

    html = `<div class="preview-summary">
        <p><strong>${state.multiConfigParsedRows.length}</strong> total rows across <strong>${Object.keys(boxCounts).length}</strong> box configurations</p>
    </div>` + html;

    container.innerHTML = html;
}

// Parse odds data with specific reference set names
function parseOddsDataWithReference(lines, referenceCardTypes) {
    const rows = [];

    for (const line of lines) {
        // Skip empty or header-like lines
        if (!line || line.toLowerCase().includes('overall odds') || line.toLowerCase().includes('card type')) {
            continue;
        }

        let cardName = '';
        let numbered = '';
        let odds = '';

        // Tab-separated
        if (line.includes('\t')) {
            const parts = line.split('\t').map(p => normalizeWhitespace(p)).filter(p => p);
            if (parts.length >= 2) {
                const normalized = normalizeOddsRow(parts);
                cardName = normalized[0];
                numbered = normalized[1];
                odds = normalized[2];
            }
        }

        if (!cardName) {
            // Look for odds pattern: card name followed by 1:X or /XX 1:X
            const oddsPatterns = [
                /^(.+?)\s+\/(\d+)\s+(1:\d+|1\/\d+)$/,
                /^(.+?)\s+#(\d+)\s+(1:\d+|1\/\d+)$/,
                /^(.+?)\s+(\d+)\s+(1:\d+|1\/\d+)$/,
                /^(.+?)\s+(1:\d+|1\/\d+)$/,
                /^(.+?)\s+(1:\d+:\d+)$/
            ];

            for (const pattern of oddsPatterns) {
                const match = line.match(pattern);
                if (match) {
                    if (match.length === 4) {
                        cardName = match[1].trim();
                        numbered = match[2];
                        odds = match[3];
                    } else {
                        cardName = match[1].trim();
                        odds = match[2];
                    }
                    break;
                }
            }
        }

        if (!cardName) {
            // Fallback: split by multiple spaces
            const parts = line.split(/\s{2,}/).map(p => normalizeWhitespace(p)).filter(p => p);
            if (parts.length >= 2) {
                const normalized = normalizeOddsRow(parts);
                cardName = normalized[0];
                numbered = normalized[1];
                odds = normalized[2];
            } else {
                const simpleParts = line.split(/\s+/);
                if (simpleParts.length >= 2) {
                    const lastPart = simpleParts[simpleParts.length - 1];
                    if (/^1:\d+/.test(lastPart) || /^1\/\d+/.test(lastPart)) {
                        cardName = simpleParts.slice(0, -1).join(' ');
                        odds = lastPart;
                    }
                }
            }
        }

        if (cardName) {
            // Split cardName into card_type and parallel using provided reference
            const { cardType, parallel } = splitCardTypeAndParallel(cardName, referenceCardTypes);
            const category = detectCategory(cardType);
            rows.push([cardType, parallel, numbered, odds, category]);
        }
    }

    return rows;
}

// Validate odds card types against checklist set names
function validateOddsAgainstChecklist(oddsRows, checklistSetNames) {
    const checklistSetNamesLower = checklistSetNames.map(n => n.toLowerCase());
    const unmatchedTypes = new Set();

    for (const row of oddsRows) {
        const cardType = row[0];
        if (cardType && !checklistSetNamesLower.includes(cardType.toLowerCase())) {
            // Check if it's a base card (which might not be in checklist headers)
            if (!/^base$/i.test(cardType)) {
                unmatchedTypes.add(cardType);
            }
        }
    }

    if (unmatchedTypes.size > 0) {
        state.validationWarnings.push({
            type: 'unmatched_card_types',
            message: 'Card types in odds not found in checklist:',
            items: Array.from(unmatchedTypes)
        });
    }
}

// Detect columns for combined mode
function detectColumnsForCombined() {
    // Checklist columns
    if (state.checklistParsedRows.length > 0) {
        const maxCols = Math.max(...state.checklistParsedRows.map(row => row.length));
        state.checklistColumns = [];
        for (let i = 0; i < maxCols; i++) {
            state.checklistColumns.push(`Column ${i + 1}`);
        }
        state.checklistColumnMapping = detectColumnMappingForRows(state.checklistParsedRows, 'checklist');
    }

    // Odds columns
    if (state.oddsParsedRows.length > 0) {
        const maxCols = Math.max(...state.oddsParsedRows.map(row => row.length));
        state.oddsColumns = [];
        for (let i = 0; i < maxCols; i++) {
            state.oddsColumns.push(`Column ${i + 1}`);
        }
        state.oddsColumnMapping = detectColumnMappingForRows(state.oddsParsedRows, 'odds');
    }
}

// Detect column mapping for a set of rows
function detectColumnMappingForRows(rows, dataType) {
    const mapping = {};
    const maxCols = Math.max(...rows.map(row => row.length));

    for (let i = 0; i < maxCols; i++) {
        const sampleValues = rows.slice(0, 10).map(row => row[i] || '').filter(v => v);

        if (dataType === 'odds') {
            // Odds-specific mapping
            if (sampleValues.some(v => /^1:\d+/.test(v) || /^1\/\d+/.test(v))) {
                mapping[i] = 'odds';
                continue;
            }
            if (sampleValues.length > 0 && sampleValues.every(v => /^\d+$/.test(v))) {
                mapping[i] = 'numbered';
                continue;
            }
            if (!Object.values(mapping).includes('set_name') && i === 0) {
                mapping[i] = 'set_name';
                continue;
            }
            if (!Object.values(mapping).includes('parallel') && i === 1) {
                mapping[i] = 'parallel';
                continue;
            }
            if (!Object.values(mapping).includes('type')) {
                const categories = ['base', 'insert', 'autograph', 'relic', 'autograph_relic'];
                if (sampleValues.some(v => categories.includes(v.toLowerCase()))) {
                    mapping[i] = 'type';
                    continue;
                }
            }
        } else {
            // Checklist-specific mapping (reuse existing logic)
            if (sampleValues.some(v => /^1:\d+/.test(v) || /^1\/\d+/.test(v))) {
                mapping[i] = 'odds';
                continue;
            }
            if (sampleValues.length > 0 && sampleValues.every(v => /^\d+$/.test(v))) {
                if (!Object.values(mapping).includes('number')) {
                    mapping[i] = 'number';
                }
                continue;
            }
            if (sampleValues.some(v => /^[A-Z]+-?\d+$/i.test(v) || /^RC-?\d+$/i.test(v))) {
                mapping[i] = 'number';
                continue;
            }
            const teamPatterns = /celtics|lakers|bulls|heat|warriors|nets|knicks|mavericks|suns|bucks|76ers|spurs|rockets|jazz|nuggets|clippers|grizzlies|pelicans|hawks|hornets|pacers|pistons|magic|wizards|raptors|cavaliers|timberwolves|thunder|blazers|kings/i;
            if (sampleValues.some(v => teamPatterns.test(v))) {
                mapping[i] = 'team';
                continue;
            }
            if (sampleValues.some(v => /^(true|false|yes|no|rc|rookie)$/i.test(v))) {
                mapping[i] = 'rookie';
                continue;
            }
            if (!Object.values(mapping).includes('player')) {
                mapping[i] = 'player';
                continue;
            }
        }
    }

    return mapping;
}

function parseOddsData(lines) {
    const rows = [];
    const referenceCardTypes = loadReferenceCardTypes();

    for (const line of lines) {
        // Skip empty or header-like lines
        if (!line || line.toLowerCase().includes('overall odds') || line.toLowerCase().includes('card type')) {
            continue;
        }

        let cardName = '';
        let numbered = '';
        let odds = '';

        // Tab-separated
        if (line.includes('\t')) {
            const parts = line.split('\t').map(p => p.trim()).filter(p => p);
            if (parts.length >= 2) {
                const normalized = normalizeOddsRow(parts);
                cardName = normalized[0];
                numbered = normalized[1];
                odds = normalized[2];
            }
        }

        if (!cardName) {
            // Look for odds pattern: card name followed by 1:X or /XX 1:X
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

            for (const pattern of oddsPatterns) {
                const match = line.match(pattern);
                if (match) {
                    if (match.length === 4) {
                        cardName = match[1].trim();
                        numbered = match[2];
                        odds = match[3];
                    } else {
                        cardName = match[1].trim();
                        odds = match[2];
                    }
                    break;
                }
            }
        }

        if (!cardName) {
            // Fallback: split by multiple spaces
            const parts = line.split(/\s{2,}/).map(p => p.trim()).filter(p => p);
            if (parts.length >= 2) {
                const normalized = normalizeOddsRow(parts);
                cardName = normalized[0];
                numbered = normalized[1];
                odds = normalized[2];
            } else {
                // Last resort: just use the whole line
                const simpleParts = line.split(/\s+/);
                if (simpleParts.length >= 2) {
                    const lastPart = simpleParts[simpleParts.length - 1];
                    if (/^1:\d+/.test(lastPart) || /^1\/\d+/.test(lastPart)) {
                        cardName = simpleParts.slice(0, -1).join(' ');
                        odds = lastPart;
                    }
                }
            }
        }

        if (cardName) {
            // Split cardName into card_type and parallel using reference data
            const { cardType, parallel } = splitCardTypeAndParallel(cardName, referenceCardTypes);
            // Auto-detect category based on card type
            const category = detectCategory(cardType);
            // Row format: [card_type, parallel, out_of, odds, category]
            rows.push([cardType, parallel, numbered, odds, category]);
        }
    }

    return rows;
}

// Split combined card name into card_type and parallel using reference data
// "Rookie Jersey Autographs Twilight" -> cardType: "Rookie Jersey Autographs", parallel: "Twilight"
function splitCardTypeAndParallel(fullName, referenceCardTypes) {
    if (!fullName) return { cardType: '', parallel: '' };

    const fullNameLower = fullName.toLowerCase();

    // Strategy 1: Try to match a known card type from reference data (most accurate)
    if (referenceCardTypes && referenceCardTypes.length > 0) {
        // Sort by length (longest first) to match most specific card type
        const sortedTypes = [...referenceCardTypes].sort((a, b) => b.length - a.length);

        for (const cardType of sortedTypes) {
            const cardTypeLower = cardType.toLowerCase();
            if (fullNameLower.startsWith(cardTypeLower)) {
                // Found a match - extract parallel from remaining text
                const remaining = fullName.substring(cardType.length).trim();
                return {
                    cardType: cardType,
                    parallel: remaining || ''
                };
            }
        }
    }

    // Strategy 2: Try to detect base card pattern
    // "Base Zodiac" -> cardType: "Base", parallel: "Zodiac"
    if (/^base\s+/i.test(fullName)) {
        const parts = fullName.split(/\s+/);
        return {
            cardType: parts[0],
            parallel: parts.slice(1).join(' ')
        };
    }

    // Strategy 3: Check if name ends with a known parallel (fallback)
    // "Rookie Jersey Autographs Twilight" -> cardType: "Rookie Jersey Autographs", parallel: "Twilight"
    for (const parallel of KNOWN_PARALLELS) {
        const parallelLower = parallel.toLowerCase();
        // Check if the name ends with this parallel (with a space before it)
        if (fullNameLower.endsWith(' ' + parallelLower)) {
            const cardType = fullName.substring(0, fullName.length - parallel.length).trim();
            // Only use this if there's actually a card type left
            if (cardType.length > 0) {
                return {
                    cardType: cardType,
                    parallel: parallel
                };
            }
        }
    }

    // No match found - return full name as card_type with no parallel
    return { cardType: fullName, parallel: '' };
}

// Auto-detect category based on card type name
function detectCategory(cardType) {
    if (!cardType) return 'base';

    const nameLower = cardType.toLowerCase();

    // Check for autograph indicators
    if (/auto(graph)?|signature/i.test(nameLower)) {
        // Check if also has relic
        if (/relic|memorabilia|patch|jersey|mem\b/i.test(nameLower)) {
            return 'autograph_relic';
        }
        return 'autograph';
    }

    // Check for relic/memorabilia indicators
    if (/relic|memorabilia|patch|jersey|mem\b/i.test(nameLower)) {
        return 'relic';
    }

    // Check for base
    if (/^base/i.test(nameLower)) {
        return 'base';
    }

    // Default to insert for everything else
    return 'insert';
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
            // Normalize whitespace in each cell to handle non-breaking spaces
            let parts = line.split('\t').map(p => normalizeWhitespace(p)).filter(p => p);
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
                // Normalize whitespace to handle non-breaking spaces
                const parts = rest.split(/\s{2,}|\t/).map(p => normalizeWhitespace(p)).filter(p => p);
                parsedRow = [cardNum, ...parts];
            }
        }

        if (!parsedRow) {
            // Multiple spaces as delimiter
            let parts = line.split(/\s{2,}/).map(p => normalizeWhitespace(p)).filter(p => p);
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
                set_type: currentSetType,  // Use raw header text from PDF
                set_name: currentSetName
            });
        }
    }

    // Post-process: find column with player+team combos and split them
    const processedRows = splitPlayerTeamColumn(rows);

    // Return both rows and metadata
    return { rows: processedRows, metadata: metadata };
}

// Find combined player+team in each row and split it
function splitPlayerTeamColumn(rows) {
    console.log('splitPlayerTeamColumn called with', rows.length, 'rows');
    if (rows.length === 0) return rows;

    // Process each row individually - find and split any column that has combined player+team
    const newRows = [];
    let splitCount = 0;

    for (const row of rows) {
        let rowWasSplit = false;

        // Check each column in this row for a combined player+team value
        for (let colIndex = 0; colIndex < row.length; colIndex++) {
            const value = row[colIndex] || '';

            // Check if this column has a combined player+team:
            // 1. Value is long enough to contain both player AND team
            // 2. Value contains a team name
            // 3. Value is NOT just a standalone team name
            const hasTeam = containsTeamName(value);
            const isJustTeam = isStandaloneTeam(value);
            const isCombined = value.length > 10 && hasTeam && !isJustTeam;

            // Also check if a later column already has this team as standalone
            const hasStandaloneTeamLater = row.slice(colIndex + 1).some(v => {
                return v && isStandaloneTeam(v);
            });

            if (isCombined && !hasStandaloneTeamLater) {
                // Split this column
                const [player, team] = splitPlayerFromTeam(value);
                console.log('  SPLITTING row', row[0], 'col', colIndex, ':', value.substring(0, 40), '->', player, '|', team);

                const newRow = [];
                for (let i = 0; i < row.length; i++) {
                    if (i === colIndex) {
                        newRow.push(player);
                        newRow.push(team);
                    } else {
                        newRow.push(row[i]);
                    }
                }
                newRows.push(newRow);
                rowWasSplit = true;
                splitCount++;
                break; // Only split one column per row
            }
        }

        if (!rowWasSplit) {
            // No combined column found in this row - copy as-is
            newRows.push([...row]);
        }
    }

    // Normalize all rows to have the same number of columns
    const finalMaxCols = Math.max(...newRows.map(r => r.length));
    for (const row of newRows) {
        while (row.length < finalMaxCols) {
            row.push('');
        }
    }

    console.log('splitPlayerTeamColumn done, split', splitCount, 'rows, finalMaxCols:', finalMaxCols);
    return newRows;
}

// Check if text contains any known team name
function containsTeamName(text) {
    if (!text) return false;
    // Normalize whitespace to handle non-breaking spaces and multiple spaces
    const textNorm = normalizeWhitespace(text).toLowerCase();
    for (const team of NBA_TEAMS) {
        if (textNorm.includes(team.toLowerCase())) {
            return true;
        }
    }
    return false;
}

// Check if text is JUST a team name (not combined with player)
// Returns true for "Boston Celtics", false for "John Smith Boston Celtics"
function isStandaloneTeam(text) {
    if (!text) return false;
    // Normalize whitespace to handle non-breaking spaces and multiple spaces
    const textNorm = normalizeWhitespace(text).toLowerCase();
    for (const team of NBA_TEAMS) {
        const teamLower = team.toLowerCase();
        // Check if the text starts with the team name
        if (textNorm.startsWith(teamLower)) {
            // Allow for some trailing whitespace but not much more content
            const remaining = textNorm.substring(teamLower.length).trim();
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

    // Skip if too long (headers are typically short, but set names can be longer)
    if (trimmed.length > 80) return false;

    // Skip if it looks like player data (mixed case with multiple words that aren't all caps)
    const words = trimmed.split(/\s+/);
    // Allow longer headers (set names can be quite long like "TOPPS CHROME GOLD LOGOMAN II")
    if (words.length > 10) return false;

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

// Normalize whitespace: replace all whitespace variants (non-breaking, multiple spaces, etc.) with single space
function normalizeWhitespace(text) {
    if (!text) return '';
    // Replace all whitespace (including non-breaking spaces \u00A0) with regular space, then collapse multiples
    return text.replace(/[\s\u00A0]+/g, ' ').trim();
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

    // Normalize whitespace to handle non-breaking spaces and multiple spaces
    const textNorm = normalizeWhitespace(text);
    const textNormLower = textNorm.toLowerCase();

    // Check if text contains a known team name (case-insensitive)
    for (const team of NBA_TEAMS) {
        const teamLower = team.toLowerCase();
        const teamIndex = textNormLower.indexOf(teamLower);
        if (teamIndex > 0) {
            const player = textNorm.substring(0, teamIndex).trim();
            const teamName = textNorm.substring(teamIndex).trim();
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
    // Normalize whitespace to handle non-breaking spaces and multiple spaces
    const normalizedLine = normalizeWhitespace(line);

    // First, try to extract card number from the start
    const cardNumMatch = normalizedLine.match(/^(\d+|[A-Z]{1,3}-?\d+|RC-?\d+)\s+(.+)$/i);

    let cardNum = '';
    let rest = normalizedLine;

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
        // Pattern: starts with a card number, followed by space, then a name
        // Examples: "1 Pascal Siakam", "10 Talen Horton-Tucker", "RC-1 Victor Wembanyama"
        // Also handles: "11 T.J. McConnell", "5 D'Angelo Russell", "19 P.J. Washington"
        // Hyphenated names: "Nickeil Alexander-Walker", "Kentavious Caldwell-Pope"
        // Accented names: "Yanic Konan-Niederhäuser", "José Calderón"
        // Complex card numbers: "TAUR2-DH Dylan Harper", "TCAR-YKN Yanic Konan", "SWS-AD Name"
        //
        // Card number patterns (in order of specificity):
        // 1. Alphanumeric-alphanumeric: "TAUR2-DH", "TCAR-YKN", "SWS-AD"
        // 2. Pure digits: "1", "10", "123"
        // 3. Short prefix + digits: "RC-1", "VS-1", "LD-10"
        const match = part.match(/^([A-Z0-9]+-[A-Z0-9]+|\d+|[A-Z]{1,4}-?\d+)\s+([A-Za-zÀ-ÿ][a-zA-ZÀ-ÿ.'-].*)/i);

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

        // Pure numbers (could be number or numbered)
        if (sampleValues.length > 0 && sampleValues.every(v => /^\d+$/.test(v))) {
            if (state.dataType === 'odds') {
                state.columnMapping[i] = 'numbered';
            } else if (!Object.values(state.columnMapping).includes('number')) {
                state.columnMapping[i] = 'number';
            }
            continue;
        }

        // Card numbers with letters
        if (sampleValues.some(v => /^[A-Z]+-?\d+$/i.test(v) || /^RC-?\d+$/i.test(v))) {
            state.columnMapping[i] = 'number';
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
// Step 4: Preview UI
// ========================================

function formatColumnName(col) {
    return col.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function renderPreview() {
    // Show single preview section, hide combined preview section
    document.getElementById('singlePreviewSection')?.classList.remove('hidden');
    document.getElementById('combinedPreviewSection')?.classList.add('hidden');
    document.getElementById('validationWarnings')?.classList.add('hidden');

    const container = document.getElementById('previewContainer');
    const expectedCols = state.dataType === 'odds' ? ODDS_COLUMNS : CHECKLIST_COLUMNS;

    const previewRows = state.parsedRows.map((row, rowIndex) => {
        const mappedRow = {};

        mappedRow.product_id = state.productId;
        if (state.dataType === 'odds') {
            mappedRow.box = state.boxConfig;
            mappedRow.type = state.cardCategory;
        } else {
            // Checklist: add type and set_name (use per-row metadata if available)
            const rowMeta = state.rowMetadata[rowIndex] || {};
            mappedRow.type = rowMeta.set_type || state.setType;
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

// Render combined preview with tabs for checklist and odds
function renderCombinedPreview() {
    // Show/hide appropriate preview sections
    document.getElementById('singlePreviewSection')?.classList.add('hidden');
    document.getElementById('combinedPreviewSection')?.classList.remove('hidden');

    // Show validation warnings if any
    const warningsContainer = document.getElementById('validationWarnings');
    if (state.validationWarnings.length > 0) {
        let warningsHtml = '<h4>⚠️ Validation Warnings</h4><ul>';
        for (const warning of state.validationWarnings) {
            warningsHtml += `<li>${warning.message}<ul>`;
            for (const item of warning.items) {
                warningsHtml += `<li>${escapeHtml(item)}</li>`;
            }
            warningsHtml += '</ul></li>';
        }
        warningsHtml += '</ul>';
        warningsContainer.innerHTML = warningsHtml;
        warningsContainer.classList.remove('hidden');
    } else {
        warningsContainer.classList.add('hidden');
    }

    // Render checklist preview
    if (state.checklistParsedRows.length > 0) {
        renderCombinedPreviewTable(
            'checklistPreviewContainer',
            state.checklistParsedRows,
            state.checklistRowMetadata,
            state.checklistColumnMapping,
            CHECKLIST_COLUMNS,
            'checklist'
        );
    } else {
        document.getElementById('checklistPreviewContainer').innerHTML = '<p class="preview-note">No checklist data</p>';
    }

    // Render odds preview
    if (state.oddsParsedRows.length > 0) {
        renderCombinedPreviewTable(
            'oddsPreviewContainer',
            state.oddsParsedRows,
            [],
            state.oddsColumnMapping,
            ODDS_COLUMNS,
            'odds'
        );
    } else {
        document.getElementById('oddsPreviewContainer').innerHTML = '<p class="preview-note">No odds data</p>';
    }
}

// Render a preview table for combined mode
function renderCombinedPreviewTable(containerId, rows, rowMetadata, columnMapping, expectedCols, dataType) {
    const container = document.getElementById(containerId);

    const previewRows = rows.map((row, rowIndex) => {
        const mappedRow = {};

        mappedRow.product_id = state.productId;
        if (dataType === 'odds') {
            mappedRow.box = 'hobby';  // Default to hobby in combined mode
            // type is auto-detected and should be in the row
        } else {
            const rowMeta = rowMetadata[rowIndex] || {};
            mappedRow.type = rowMeta.set_type || '';
            mappedRow.set_name = rowMeta.set_name || '';
        }

        for (const [colIndex, colName] of Object.entries(columnMapping)) {
            mappedRow[colName] = row[parseInt(colIndex)] || '';
        }

        // For odds, map from row array directly since it's already structured
        if (dataType === 'odds') {
            mappedRow.set_name = row[0] || '';
            mappedRow.parallel = row[1] || 'Base';
            mappedRow.numbered = row[2] || '-';
            mappedRow.odds = row[3] || '';
            mappedRow.type = row[4] || '';
        }

        // Auto-detect rookie status for checklists
        if (dataType === 'checklist') {
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
    html += `<p class="preview-note">${rows.length} total rows</p>`;

    container.innerHTML = html;
}

// Switch between preview tabs
function switchPreviewTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.preview-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Show/hide tab content
    document.getElementById('checklistPreviewTab')?.classList.toggle('hidden', tab !== 'checklist');
    document.getElementById('oddsPreviewTab')?.classList.toggle('hidden', tab !== 'odds');
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

    // Check number for RC prefix
    if (row.number && /^RC/i.test(row.number)) {
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

    // Check type
    if (row.type && /rookie/i.test(row.type)) {
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
    if (state.dataType === 'combined') {
        generateCombinedCSV();
        return;
    }

    if (state.dataType === 'combinedMultiConfig') {
        generateCombinedMultiConfigCSV();
        return;
    }

    if (state.dataType === 'multiConfigOdds') {
        generateMultiConfigCSV();
        return;
    }

    const expectedCols = state.dataType === 'odds' ? ODDS_COLUMNS : CHECKLIST_COLUMNS;
    const csvRows = [];

    csvRows.push(expectedCols.join(','));

    state.parsedRows.forEach((row, rowIndex) => {
        // Build a mapped row object first
        const rowData = {};
        rowData.product_id = state.productId;

        if (state.dataType === 'odds') {
            rowData.box = state.boxConfig;
            rowData.type = state.cardCategory;
        } else {
            // Use per-row metadata if available, fallback to global state
            const rowMeta = state.rowMetadata[rowIndex] || {};
            rowData.type = rowMeta.set_type || state.setType;
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
            mappedRow.push(formatCsvValue(rowData[col], col));
        }

        csvRows.push(mappedRow.join(','));
    });

    document.getElementById('csvOutput').value = csvRows.join('\n');

    // Show single mode UI, hide combined mode UI
    document.getElementById('singleCsvOutput')?.classList.remove('hidden');
    document.getElementById('singleDownloadButtons')?.classList.remove('hidden');
    document.getElementById('combinedCsvOutput')?.classList.add('hidden');
    document.getElementById('combinedBackButton')?.classList.add('hidden');

    showStep(5);
}

// Generate CSV for multi-config odds
function generateMultiConfigCSV() {
    const expectedCols = ODDS_COLUMNS;
    const csvRows = [];

    csvRows.push(expectedCols.join(','));

    state.multiConfigParsedRows.forEach(row => {
        const rowData = {
            product_id: state.productId,
            box: row.box,
            type: row.type,
            set_name: row.set_name,
            parallel: row.parallel,
            numbered: row.numbered,
            odds: row.odds
        };

        // Build CSV row
        const mappedRow = [];
        for (const col of expectedCols) {
            mappedRow.push(formatCsvValue(rowData[col], col));
        }

        csvRows.push(mappedRow.join(','));
    });

    document.getElementById('csvOutput').value = csvRows.join('\n');

    // Show single mode UI
    document.getElementById('singleCsvOutput')?.classList.remove('hidden');
    document.getElementById('singleDownloadButtons')?.classList.remove('hidden');
    document.getElementById('combinedCsvOutput')?.classList.add('hidden');
    document.getElementById('combinedBackButton')?.classList.add('hidden');

    showStep(5);
}

// Generate both CSVs for combined mode
function generateCombinedCSV() {
    // Generate checklist CSV
    const checklistCsv = generateCsvForDataset(
        state.checklistParsedRows,
        state.checklistRowMetadata,
        state.checklistColumnMapping,
        CHECKLIST_COLUMNS,
        'checklist'
    );

    // Generate odds CSV
    const oddsCsv = generateCsvForDataset(
        state.oddsParsedRows,
        [],
        state.oddsColumnMapping,
        ODDS_COLUMNS,
        'odds'
    );

    // Populate output areas
    document.getElementById('checklistCsvOutput').value = checklistCsv;
    document.getElementById('oddsCsvOutput').value = oddsCsv;

    // Show combined mode UI, hide single mode UI
    document.getElementById('singleCsvOutput')?.classList.add('hidden');
    document.getElementById('singleDownloadButtons')?.classList.add('hidden');
    document.getElementById('combinedCsvOutput')?.classList.remove('hidden');
    document.getElementById('combinedBackButton')?.classList.remove('hidden');

    showStep(5);
}

// Generate CSV for combined multi-config mode
function generateCombinedMultiConfigCSV() {
    // Generate checklist CSV using normal combined method
    const checklistCsv = generateCsvForDataset(
        state.checklistParsedRows,
        state.checklistRowMetadata,
        state.checklistColumnMapping,
        CHECKLIST_COLUMNS,
        'checklist'
    );

    // Generate multi-config odds CSV
    const oddsCsv = generateMultiConfigOddsCsv();

    // Populate output areas
    document.getElementById('checklistCsvOutput').value = checklistCsv;
    document.getElementById('oddsCsvOutput').value = oddsCsv;

    // Show combined mode UI, hide single mode UI
    document.getElementById('singleCsvOutput')?.classList.add('hidden');
    document.getElementById('singleDownloadButtons')?.classList.add('hidden');
    document.getElementById('combinedCsvOutput')?.classList.remove('hidden');
    document.getElementById('combinedBackButton')?.classList.remove('hidden');

    showStep(5);
}

// Generate multi-config odds CSV string
function generateMultiConfigOddsCsv() {
    const expectedCols = ODDS_COLUMNS;
    const csvRows = [];

    csvRows.push(expectedCols.join(','));

    state.multiConfigParsedRows.forEach(row => {
        const rowData = {
            product_id: state.productId,
            box: row.box,
            type: row.type,
            set_name: row.set_name,
            parallel: row.parallel,
            numbered: row.numbered,
            odds: row.odds
        };

        const mappedRow = [];
        for (const col of expectedCols) {
            mappedRow.push(formatCsvValue(rowData[col], col));
        }

        csvRows.push(mappedRow.join(','));
    });

    return csvRows.join('\n');
}

// Generate CSV for a specific dataset
function generateCsvForDataset(rows, rowMetadata, columnMapping, expectedCols, dataType) {
    const csvRows = [];
    csvRows.push(expectedCols.join(','));

    rows.forEach((row, rowIndex) => {
        const rowData = {};
        rowData.product_id = state.productId;

        if (dataType === 'odds') {
            rowData.box = 'hobby';  // Default to hobby in combined mode
            // Map from row array directly since odds rows are already structured
            rowData.set_name = row[0] || '';
            rowData.parallel = row[1] || 'Base';
            rowData.numbered = row[2] || '-';
            rowData.odds = row[3] || '';
            rowData.type = row[4] || '';
        } else {
            const rowMeta = rowMetadata[rowIndex] || {};
            rowData.type = rowMeta.set_type || '';
            rowData.set_name = rowMeta.set_name || '';

            // Map columns from parsed data
            for (const [colIndex, colName] of Object.entries(columnMapping)) {
                rowData[colName] = row[parseInt(colIndex)] || '';
            }

            // Auto-detect rookie
            rowData.rookie = detectRookieStatus(rowData, row);
        }

        // Build CSV row
        const mappedRow = [];
        for (const col of expectedCols) {
            mappedRow.push(formatCsvValue(rowData[col], col));
        }

        csvRows.push(mappedRow.join(','));
    });

    return csvRows.join('\n');
}

function copyCSV(type) {
    let csvOutput;

    if (state.dataType === 'combined' && type) {
        csvOutput = document.getElementById(type === 'checklist' ? 'checklistCsvOutput' : 'oddsCsvOutput');
    } else {
        csvOutput = document.getElementById('csvOutput');
    }

    csvOutput.select();
    document.execCommand('copy');

    const successMsg = document.getElementById('copySuccess');
    successMsg.classList.remove('hidden');
    setTimeout(() => {
        successMsg.classList.add('hidden');
    }, 2000);
}

function downloadCSV(type) {
    let csvContent, filename;

    if ((state.dataType === 'combined' || state.dataType === 'combinedMultiConfig') && type) {
        csvContent = document.getElementById(type === 'checklist' ? 'checklistCsvOutput' : 'oddsCsvOutput').value;
        filename = `${type}_${state.productId.replace(/[^a-z0-9]/gi, '_')}.csv`;
    } else {
        csvContent = document.getElementById('csvOutput').value;
        filename = `${state.dataType}_${state.productId.replace(/[^a-z0-9]/gi, '_')}.csv`;
    }

    // Add UTF-8 BOM to help spreadsheets recognize encoding for special characters
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
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

// Format a value for CSV export
// For odds values (like "1:111"), wrap in formula format to prevent spreadsheet conversion
// Spreadsheets interpret "1:111" as time and convert to decimals
// Using ="1:111" format creates a formula that returns the text value
function formatCsvValue(value, columnName) {
    // Empty values become dashes to avoid blank cells
    if (!value || value === '') return '-';

    let str = String(value);

    // For odds column, use formula format to prevent time conversion
    // This handles values like "1:111" which spreadsheets interpret as time
    // ="1:111" is a formula that evaluates to the string "1:111"
    if (columnName === 'odds' && str.includes(':') && /^\d+:\d+/.test(str)) {
        return `"=""${str}"""`;
    }

    // Standard CSV escaping: quote if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        str = `"${str.replace(/"/g, '""')}"`;
    }

    return str;
}
