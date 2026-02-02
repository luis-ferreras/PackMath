// ========================================
// PackMath Data Converter
// ========================================

// State
let state = {
    dataType: null,        // 'odds' or 'checklist'
    productId: '',
    boxConfig: '',
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
    <p><strong>How to get odds data from a PDF:</strong></p>
    <ol>
        <li>Open the PDF in your browser or PDF viewer</li>
        <li>Select the odds table (usually has columns like: Card Type, Odds, etc.)</li>
        <li>Copy the selected text (Ctrl+C / Cmd+C)</li>
        <li>Paste it in the box below</li>
    </ol>
    <p><strong>Expected format:</strong> Each row should have card name and odds (e.g., "Refractor 1:4")</p>
    <p><strong>Tip:</strong> You can also manually type or edit the data. One item per line.</p>
`;

const CHECKLIST_INSTRUCTIONS = `
    <p><strong>How to get checklist data from a PDF:</strong></p>
    <ol>
        <li>Open the PDF in your browser or PDF viewer</li>
        <li>Select the checklist table</li>
        <li>Copy the selected text (Ctrl+C / Cmd+C)</li>
        <li>Paste it in the box below</li>
    </ol>
    <p><strong>Expected format:</strong> Each row should have card number, player name, team, etc.</p>
    <p><strong>Tip:</strong> The parser will try to detect columns automatically.</p>
`;

// ========================================
// Step Navigation
// ========================================

function showStep(stepNum) {
    // Hide all steps
    document.querySelectorAll('.step').forEach(step => {
        step.classList.add('hidden');
    });

    // Show the requested step
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
        rawData: '',
        parsedRows: [],
        columns: [],
        columnMapping: {},
        currentStep: 1
    };

    // Reset UI
    document.querySelectorAll('.data-type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById('productId').value = '';
    document.getElementById('boxConfig').value = '';
    document.getElementById('pasteArea').value = '';
    document.getElementById('csvOutput').value = '';

    showStep(1);
}

// ========================================
// Step 1: Select Data Type
// ========================================

function selectDataType(type) {
    state.dataType = type;

    // Update UI
    document.querySelectorAll('.data-type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-type="${type}"]`).classList.add('active');

    // Show/hide config row based on type
    const configRow = document.getElementById('oddsConfigRow');
    if (type === 'odds') {
        configRow.classList.remove('hidden');
    } else {
        configRow.classList.add('hidden');
    }

    // Update instructions
    document.getElementById('pasteInstructions').innerHTML =
        type === 'odds' ? ODDS_INSTRUCTIONS : CHECKLIST_INSTRUCTIONS;

    // Move to step 2
    showStep(2);
}

// ========================================
// Step 2: Product Info (handled by step navigation)
// ========================================

// Watch for input changes to auto-advance
document.getElementById('productId')?.addEventListener('input', function(e) {
    state.productId = e.target.value.trim();
});

document.getElementById('boxConfig')?.addEventListener('input', function(e) {
    state.boxConfig = e.target.value.trim();
});

// Add continue button functionality
document.addEventListener('DOMContentLoaded', function() {
    // Add continue button to step 2
    const step2Content = document.querySelector('#step2 .step-content');
    if (step2Content && !step2Content.querySelector('.continue-btn')) {
        const continueBtn = document.createElement('button');
        continueBtn.className = 'btn btn-primary continue-btn';
        continueBtn.textContent = 'Continue';
        continueBtn.onclick = function() {
            state.productId = document.getElementById('productId').value.trim();
            state.boxConfig = document.getElementById('boxConfig').value.trim();

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
// Step 3: Parse Data
// ========================================

function parseData() {
    const rawText = document.getElementById('pasteArea').value.trim();

    if (!rawText) {
        alert('Please paste some data first');
        return;
    }

    state.rawData = rawText;

    // Split into lines and parse
    const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    if (lines.length === 0) {
        alert('No data found');
        return;
    }

    // Try to detect if first line is a header
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('card') || firstLine.includes('odds') ||
                      firstLine.includes('player') || firstLine.includes('team') ||
                      firstLine.includes('number') || firstLine.includes('#');

    const dataLines = hasHeader ? lines.slice(1) : lines;

    // Parse based on data type
    if (state.dataType === 'odds') {
        state.parsedRows = parseOddsData(dataLines);
    } else {
        state.parsedRows = parseChecklistData(dataLines);
    }

    if (state.parsedRows.length === 0) {
        alert('Could not parse any data. Please check the format.');
        return;
    }

    // Detect columns
    detectColumns();

    // Show column mapping UI
    renderColumnMapping();
    renderPreview();

    showStep(4);
}

function parseOddsData(lines) {
    const rows = [];

    for (const line of lines) {
        // Try different parsing strategies

        // Strategy 1: Tab-separated
        if (line.includes('\t')) {
            const parts = line.split('\t').map(p => p.trim());
            if (parts.length >= 2) {
                rows.push(parts);
                continue;
            }
        }

        // Strategy 2: Look for odds pattern (1:X or X:Y)
        const oddsMatch = line.match(/^(.+?)\s+(1:\d+|\d+:\d+)\s*(.*)$/);
        if (oddsMatch) {
            const cardType = oddsMatch[1].trim();
            const odds = oddsMatch[2].trim();
            const extra = oddsMatch[3].trim();

            // Check if there's a number (out_of) in the card type or extra
            const numberedMatch = cardType.match(/^(.+?)\s*[/#]?\s*(\d+)\s*$/);
            if (numberedMatch) {
                rows.push([numberedMatch[1].trim(), numberedMatch[2], odds]);
            } else if (extra && /^\d+$/.test(extra)) {
                rows.push([cardType, extra, odds]);
            } else {
                rows.push([cardType, '', odds]);
            }
            continue;
        }

        // Strategy 3: Space-separated (last item might be odds)
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
            const lastPart = parts[parts.length - 1];
            if (/^1:\d+$/.test(lastPart) || /^\d+:\d+$/.test(lastPart)) {
                const cardType = parts.slice(0, -1).join(' ');
                rows.push([cardType, '', lastPart]);
            } else {
                rows.push(parts);
            }
        }
    }

    return rows;
}

function parseChecklistData(lines) {
    const rows = [];

    for (const line of lines) {
        // Strategy 1: Tab-separated
        if (line.includes('\t')) {
            const parts = line.split('\t').map(p => p.trim());
            if (parts.length >= 2) {
                rows.push(parts);
                continue;
            }
        }

        // Strategy 2: Detect card number at start
        const cardNumMatch = line.match(/^(\d+|[A-Z]+-?\d+)\s+(.+)$/);
        if (cardNumMatch) {
            const cardNum = cardNumMatch[1];
            const rest = cardNumMatch[2];

            // Try to split the rest by common delimiters
            const parts = rest.split(/\s{2,}|\t|,\s*/);
            rows.push([cardNum, ...parts]);
            continue;
        }

        // Strategy 3: Just split by multiple spaces or tabs
        const parts = line.split(/\s{2,}|\t/).map(p => p.trim()).filter(p => p);
        if (parts.length >= 1) {
            rows.push(parts);
        }
    }

    return rows;
}

function detectColumns() {
    if (state.parsedRows.length === 0) return;

    // Find max columns
    const maxCols = Math.max(...state.parsedRows.map(row => row.length));

    // Create column labels
    state.columns = [];
    for (let i = 0; i < maxCols; i++) {
        state.columns.push(`Column ${i + 1}`);
    }

    // Try to auto-detect column types based on content
    const expectedCols = state.dataType === 'odds' ? ODDS_COLUMNS : CHECKLIST_COLUMNS;
    state.columnMapping = {};

    // Simple auto-detection based on content patterns
    for (let i = 0; i < maxCols; i++) {
        const sampleValues = state.parsedRows.slice(0, 5).map(row => row[i] || '');

        // Check for odds pattern
        if (sampleValues.some(v => /^1:\d+$/.test(v) || /^\d+:\d+$/.test(v))) {
            state.columnMapping[i] = 'odds';
            continue;
        }

        // Check for numbers (could be card_num or out_of)
        if (sampleValues.every(v => /^\d+$/.test(v) || v === '')) {
            if (state.dataType === 'checklist' && !Object.values(state.columnMapping).includes('card_num')) {
                state.columnMapping[i] = 'card_num';
            } else {
                state.columnMapping[i] = 'out_of';
            }
            continue;
        }

        // Check for team names (often have city names or common suffixes)
        const teamPatterns = /celtics|lakers|bulls|heat|warriors|nets|knicks|mavericks|suns|bucks/i;
        if (sampleValues.some(v => teamPatterns.test(v))) {
            state.columnMapping[i] = 'team';
            continue;
        }

        // Check for rookie indicator
        if (sampleValues.some(v => /^(true|false|yes|no|rc|rookie)$/i.test(v))) {
            state.columnMapping[i] = 'rookie';
            continue;
        }

        // Default: first text column is likely card_type/player, second is parallel/team
        if (!Object.values(state.columnMapping).includes(state.dataType === 'odds' ? 'card_type' : 'player')) {
            state.columnMapping[i] = state.dataType === 'odds' ? 'card_type' : 'player';
        }
    }
}

// ========================================
// Step 4: Column Mapping UI
// ========================================

function renderColumnMapping() {
    const container = document.getElementById('columnMapping');
    const expectedCols = state.dataType === 'odds' ? ODDS_COLUMNS : CHECKLIST_COLUMNS;

    // Filter out auto-populated columns
    const selectableCols = expectedCols.filter(col => col !== 'product_id' && col !== 'config');

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

    // Build preview data
    const previewRows = state.parsedRows.slice(0, 10).map(row => {
        const mappedRow = {};

        // Auto-populate product_id and config
        mappedRow.product_id = state.productId;
        if (state.dataType === 'odds') {
            mappedRow.config = state.boxConfig;
            mappedRow.category = 'base'; // Default, user can specify
        }

        // Map other columns
        for (const [colIndex, colName] of Object.entries(state.columnMapping)) {
            mappedRow[colName] = row[parseInt(colIndex)] || '';
        }

        return mappedRow;
    });

    // Render table
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

// ========================================
// Step 5: Generate CSV
// ========================================

function generateCSV() {
    const expectedCols = state.dataType === 'odds' ? ODDS_COLUMNS : CHECKLIST_COLUMNS;

    // Build CSV rows
    const csvRows = [];

    // Header
    csvRows.push(expectedCols.join(','));

    // Data rows
    for (const row of state.parsedRows) {
        const mappedRow = [];

        for (const col of expectedCols) {
            if (col === 'product_id') {
                mappedRow.push(state.productId);
            } else if (col === 'config') {
                mappedRow.push(state.boxConfig);
            } else if (col === 'category' && state.dataType === 'odds') {
                // Let user specify or default to 'base'
                mappedRow.push('base');
            } else {
                // Find mapped column
                let value = '';
                for (const [colIndex, colName] of Object.entries(state.columnMapping)) {
                    if (colName === col) {
                        value = row[parseInt(colIndex)] || '';
                        break;
                    }
                }
                // Escape CSV values
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    value = `"${value.replace(/"/g, '""')}"`;
                }
                mappedRow.push(value);
            }
        }

        csvRows.push(mappedRow.join(','));
    }

    const csvContent = csvRows.join('\n');
    document.getElementById('csvOutput').value = csvContent;

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
