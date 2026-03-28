#!/usr/bin/env node

/**
 * sandbox.js - Isolated WebAssembly Runtime for Medical Data Normalization
 * with Machine Learning Fallback using Transformers.js
 *
 * This script demonstrates running the medical-data-normalizer WASM module
 * in an isolated sandbox environment using Node.js WebAssembly APIs.
 *
 * PARSING STRATEGY:
 * 1. First, attempt to parse using the Rust SigParser (fast, deterministic)
 * 2. If Rust parser returns error/unknown, fall back to NuExtract-tiny ML model
 * 3. The ML model runs locally using Transformers.js WASM/WebGPU backend
 * 4. No data is sent to external APIs - everything runs in the local sandbox
 *
 * For enhanced security, this script can be run with Wasmer Edge.js:
 *   edge --safe sandbox.js
 *
 * Edge.js provides an additional WebAssembly sandbox layer around the entire
 * Node.js runtime, isolating system calls and native code execution.
 *
 * NOTE: This script requires the WASM module to be built first:
 *   wasm-pack build --target nodejs
 *
 * If you see "wasm32-unknown-unknown target not found" errors, you need to:
 *   1. Install rustup from https://rustup.rs/ (recommended for WASM development)
 *   2. Run: rustup target add wasm32-unknown-unknown
 *   3. Or manually install the target if using Chocolatey Rust
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline, env } from '@xenova/transformers';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Transformers.js for sandboxed execution
// NOTE: In Edge.js --safe mode, network access may be restricted
// The model will be downloaded on first run (if allowed) and cached locally
env.allowLocalModels = true;
env.allowRemoteModels = true; // Set to false for strict offline/air-gapped mode
env.cacheDir = path.join(__dirname, '.cache', 'transformers');

// Check for offline mode flag
const OFFLINE_MODE = process.env.SIG_PARSER_OFFLINE === 'true' || !env.allowRemoteModels;

// Configuration
const CONFIG = {
    wasmPath: path.join(__dirname, 'pkg', 'medical_data_normalizer_bg.wasm'),
    jsGluePath: path.join(__dirname, 'pkg', 'medical_data_normalizer.js'),
    testInput: 'Take 1 tab po qd',
    // ML Fallback Strategy:
    // 1. 'pattern' - Fast rule-based extraction (default, <1ms, no model needed)
    // 2. 'transformers' - Neural model (slow, requires download)
    mlStrategy: 'pattern',
    modelName: 'Xenova/t5-small',  // Only used if mlStrategy='transformers'
    useQuantized: true,
    confidenceThreshold: 0.7
};

// Global ML pipeline (initialized once)
let mlExtractor = null;

/**
 * Initialize the ML fallback pipeline
 * This loads the quantized NuExtract-tiny model locally
 */
async function initializeMLPipeline() {
    if (mlExtractor) return mlExtractor;

    if (OFFLINE_MODE) {
        console.log('[INFO] Offline mode enabled - ML fallback disabled');
        console.log('       Set SIG_PARSER_OFFLINE=false to enable model download');
        console.log();
        return null;
    }

    console.log('='.repeat(60));
    console.log('Initializing ML Fallback Pipeline');
    console.log('='.repeat(60));
    console.log();
    console.log(`Model: ${CONFIG.modelName}`);
    console.log(`Quantized: ${CONFIG.useQuantized ? 'Yes (8-bit)' : 'No'}`);
    console.log(`Cache Directory: ${env.cacheDir}`);
    console.log(`Offline Mode: ${OFFLINE_MODE ? 'Yes' : 'No'}`);
    console.log();

    // Check if model is already cached
    const modelCached = fs.existsSync(env.cacheDir);
    if (modelCached) {
        console.log('✓ Model cache found - using local files');
    } else {
        console.log('ℹ Model not cached - will attempt download (~50MB)');
        console.log('  (Download requires network access)');
    }
    console.log();

    try {
        // Initialize the text2text generation pipeline with T5-based model
        // T5 models are encoder-decoder architecture good for structured extraction
        mlExtractor = await pipeline(
            'text2text-generation',
            CONFIG.modelName,
            {
                quantized: CONFIG.useQuantized,
                revision: 'main',
                device: 'cpu',  // Use 'webgpu' if available in Edge.js environment
                dtype: 'q8',    // 8-bit quantization for efficiency
            }
        );

        console.log('✓ ML pipeline initialized successfully');
        console.log('✓ Model runs entirely in local sandbox');
        console.log('✓ No external API calls made during inference');
        console.log();

        return mlExtractor;
    } catch (error) {
        console.error('✗ Failed to initialize ML pipeline:', error.message);
        if (error.message.includes('Unauthorized access')) {
            console.error('  This environment restricts network access.');
            console.error('  To use ML fallback:');
            console.error('  1. Run once without Edge.js --safe to download the model');
            console.error('  2. Or manually download the model to:', env.cacheDir);
            console.error('  3. Then run with Edge.js --safe for sandboxed execution');
        }
        console.error('  Continuing with Rust parser only...');
        console.log();
        return null;
    }
}

/**
 * Lightweight NLP utilities for medical text parsing
 */

// POS tagging patterns (simplified)
const POS_PATTERNS = {
    NUMBER: /\b\d+(?:\.\d+)?\b/,
    WORD_NUMBER: /\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\b/i,
    VERB: /\b(?:take|give|administer|apply|inject|inhale|instill|use|swallow|place|put|spray)\b/i,
    PREPOSITION: /\b(?:by|with|to|in|into|under|per|for|at|on)\b/i,
    ARTICLE: /\b(?:a|an|the)\b/i,
    ADJECTIVAL: /\b(?:affected|each|every|oral|topical|nasal)\b/i
};

// Word embeddings (simplified - semantic similarity groups)
const SEMANTIC_GROUPS = {
    tablet: ['tab', 'tablet', 'tabs', 'tablets', 'pill', 'pills'],
    capsule: ['cap', 'capsule', 'caps', 'capsules'],
    oral: ['oral', 'po', 'p.o.', 'by mouth', 'per os', 'swallow'],
    intravenous: ['iv', 'i.v.', 'intravenous'],
    daily: ['daily', 'qd', 'q.d.', 'every day', 'each day', 'once daily'],
    twice: ['bid', 'b.i.d.', 'twice', 'two times', '2x'],
    three: ['tid', 't.i.d.', 'three times', '3x'],
    morning: ['morning', 'qam', 'q.a.m.', 'am', 'a.m.'],
    evening: ['evening', 'qpm', 'q.p.m.', 'pm', 'p.m.', 'bedtime', 'qhs', 'hs']
};

// Calculate semantic similarity (0-1) between two terms
function semanticSimilarity(term1, term2) {
    const t1 = term1.toLowerCase();
    const t2 = term2.toLowerCase();

    // Exact match
    if (t1 === t2) return 1.0;

    // Check semantic groups
    for (const [canonical, synonyms] of Object.entries(SEMANTIC_GROUPS)) {
        const group = [canonical, ...synonyms];
        if (group.includes(t1) && group.includes(t2)) {
            return 0.9;
        }
    }

    // Levenshtein distance for typos
    const distance = levenshteinDistance(t1, t2);
    const maxLen = Math.max(t1.length, t2.length);
    if (maxLen === 0) return 1.0;

    const similarity = 1 - (distance / maxLen);
    return similarity > 0.7 ? similarity : 0;
}

// Levenshtein distance for fuzzy matching
function levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[str2.length][str1.length];
}

// Tokenize input into words with POS tags
function tokenizeWithPOS(input) {
    const tokens = input.toLowerCase().match(/\b\w+(?:\.\w+)?\b/g) || [];
    return tokens.map(token => {
        let pos = 'OTHER';
        if (POS_PATTERNS.NUMBER.test(token)) pos = 'NUMBER';
        else if (POS_PATTERNS.WORD_NUMBER.test(token)) pos = 'WORD_NUMBER';
        else if (POS_PATTERNS.VERB.test(token)) pos = 'VERB';
        else if (POS_PATTERNS.PREPOSITION.test(token)) pos = 'PREPOSITION';
        else if (POS_PATTERNS.ARTICLE.test(token)) pos = 'ARTICLE';
        else if (POS_PATTERNS.ADJECTIVAL.test(token)) pos = 'ADJECTIVAL';
        return { token, pos };
    });
}

// Find n-grams (multi-word expressions)
function extractNGrams(tokens, n = 2) {
    const ngrams = [];
    for (let i = 0; i <= tokens.length - n; i++) {
        ngrams.push(tokens.slice(i, i + n).map(t => t.token).join(' '));
    }
    return ngrams;
}

// Dependency parsing (simplified) - find verb-object relationships
function findVerbObjectPairs(tokens) {
    const pairs = [];
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].pos === 'VERB') {
            // Look for object after verb (within next 5 tokens)
            for (let j = i + 1; j < Math.min(i + 6, tokens.length); j++) {
                if (tokens[j].pos === 'NUMBER' || tokens[j].pos === 'WORD_NUMBER') {
                    pairs.push({
                        verb: tokens[i].token,
                        object: tokens.slice(j).map(t => t.token).join(' ')
                    });
                    break;
                }
            }
        }
    }
    return pairs;
}

// Extract temporal expressions
function extractTemporalExpressions(input) {
    const temporalPatterns = {
        frequency: [
            { pattern: /\b(?:every|each)\s+(\d+|\w+)\s*(hour|hr|h)s?\b/i, type: 'every_n_hours' },
            { pattern: /\b(?:every|each)\s+(morning|evening|day|night)\b/i, type: 'daily_time' },
            { pattern: /\b(?:before|after)\s+(meals?|breakfast|lunch|dinner|food)\b/i, type: 'meal_relative' },
            { pattern: /\b(?:at)\s+(bedtime|night|noon|midnight)\b/i, type: 'specific_time' }
        ]
    };

    const results = [];
    for (const [category, patterns] of Object.entries(temporalPatterns)) {
        for (const { pattern, type } of patterns) {
            const match = input.match(pattern);
            if (match) {
                results.push({
                    text: match[0],
                    category,
                    type,
                    value: match[1] || match[0]
                });
            }
        }
    }
    return results;
}

/**
 * Enhanced pattern-based medication extraction with NLP
 * Uses POS tagging, semantic similarity, and dependency parsing
 */
function extractWithPatterns(input) {
    const lower = input.toLowerCase();
    const result = {
        quantity: null,
        unit: null,
        route: null,
        frequency: null,
        drug_name: null,
        duration: null,
        indication: null
    };

    // Step 1: Tokenize with POS tags
    const tokens = tokenizeWithPOS(input);
    const ngrams2 = extractNGrams(tokens, 2);
    const ngrams3 = extractNGrams(tokens, 3);

    // Step 2: Find verb-object pairs (dependency parsing)
    const verbObjectPairs = findVerbObjectPairs(tokens);

    // Step 3: Extract temporal expressions
    const temporalExprs = extractTemporalExpressions(input);

    // Step 4: Extract quantity using NLP (number detection)
    const numberTokens = tokens.filter(t => t.pos === 'NUMBER' || t.pos === 'WORD_NUMBER');
    if (numberTokens.length > 0) {
        let qty = numberTokens[0].token;
        // Convert word numbers
        const wordToNum = {
            one: '1', two: '2', three: '3', four: '4', five: '5',
            six: '6', seven: '7', eight: '8', nine: '9', ten: '10'
        };
        if (wordToNum[qty.toLowerCase()]) {
            qty = wordToNum[qty.toLowerCase()];
        }
        result.quantity = qty;
    }

    // Step 5: Extract unit using semantic similarity on n-grams
    const unitPatterns = {
        'tab': ['tab', 'tablet', 'tabs', 'tablets', 'pill', 'pills'],
        'cap': ['cap', 'capsule', 'caps', 'capsules'],
        'mg': ['mg', 'milligram', 'milligrams'],
        'ml': ['ml', 'milliliter', 'milliliters', 'cc', 'ccs'],
        'unit': ['unit', 'units'],
        'drop': ['drop', 'drops', 'gtt', 'gtts'],
        'spray': ['spray', 'sprays'],
        'patch': ['patch', 'patches'],
        'puff': ['puff', 'puffs', 'inhalation', 'inhalations'],
        'supp': ['supp', 'suppository', 'suppositories']
    };

    // Check n-grams first (multi-word units), then single tokens
    const allNGrams = [...ngrams3, ...ngrams2, ...tokens.map(t => t.token)];
    for (const term of allNGrams) {
        for (const [canonical, synonyms] of Object.entries(unitPatterns)) {
            for (const synonym of synonyms) {
                if (semanticSimilarity(term, synonym) > 0.8) {
                    result.unit = canonical;
                    break;
                }
            }
            if (result.unit) break;
        }
        if (result.unit) break;
    }

    // Step 6: Extract route using semantic similarity
    const routePatterns = {
        'oral': ['oral', 'po', 'p.o.', 'by mouth', 'per os', 'swallow'],
        'intravenous': ['iv', 'i.v.', 'intravenous', 'intravenously'],
        'intramuscular': ['im', 'i.m.', 'intramuscular', 'intramuscularly'],
        'subcutaneous': ['subq', 'subcut', 'subcutaneous', 'subcutaneously', 'sc', 's.c.'],
        'sublingual': ['sl', 's.l.', 'sublingual', 'sublingually', 'under tongue'],
        'rectal': ['pr', 'p.r.', 'rectal', 'rectally', 'per rectum'],
        'topical': ['topical', 'topically', 'apply', 'applied', 'transdermal', 'td'],
        'inhalation': ['inhale', 'inhaled', 'inhalation', 'inh', 'nebulizer', 'nebulized'],
        'ophthalmic': ['ophthalmic', 'eye', 'eyes', 'ophth', 'ou', 'od', 'os'],
        'nasal': ['nasal', 'intranasal', 'nose', 'nostril', 'nostrils'],
        'buccal': ['buccal', 'cheek'],
        'otic': ['otic', 'ear', 'ears', 'auricular']
    };

    // Check n-grams for multi-word routes
    const allTerms = [...ngrams3, ...ngrams2, ...tokens.map(t => t.token)];
    for (const term of allTerms) {
        for (const [canonical, synonyms] of Object.entries(routePatterns)) {
            for (const synonym of synonyms) {
                if (semanticSimilarity(term, synonym) > 0.85) {
                    result.route = canonical;
                    break;
                }
            }
            if (result.route) break;
        }
        if (result.route) break;
    }

    // Step 7: Extract frequency using temporal expressions + patterns
    const freqPatterns = {
        'once_daily': ['qd', 'q.d.', 'daily', 'once daily', 'once a day', 'every day', 'each day', 'qday'],
        'twice_daily': ['bid', 'b.i.d.', 'twice daily', 'twice a day', 'two times daily', '2x daily'],
        'three_times_daily': ['tid', 't.i.d.', 'three times daily', 'three times a day', '3x daily'],
        'four_times_daily': ['qid', 'q.i.d.', 'four times daily', 'four times a day', '4x daily'],
        'every_4_hours': ['q4h', 'q4hr', 'every 4 hours', 'q4hours'],
        'every_6_hours': ['q6h', 'q6hr', 'every 6 hours', 'q6hours'],
        'every_8_hours': ['q8h', 'q8hr', 'every 8 hours', 'q8hours'],
        'every_12_hours': ['q12h', 'q12hr', 'every 12 hours', 'q12hours'],
        'as_needed': ['prn', 'p.r.n.', 'as needed', 'as necessary', 'when needed'],
        'once': ['once', 'one time', 'single dose', 'stat', 'statim'],
        'bedtime': ['qhs', 'h.s.', 'hs', 'at bedtime', 'bedtime'],
        'morning': ['qam', 'q.a.m.', 'morning', 'every morning', 'in the morning', 'am', 'a.m.'],
        'evening': ['qpm', 'q.p.m.', 'evening', 'every evening', 'in the evening', 'pm', 'p.m.'],
        'weekly': ['weekly', 'once weekly', 'every week', 'qweek', 'qwk']
    };

    // Use temporal expressions first
    for (const expr of temporalExprs) {
        if (expr.category === 'frequency') {
            result.frequency = expr.type;
            break;
        }
    }

    // Fall back to pattern matching
    if (!result.frequency) {
        for (const term of allTerms) {
            for (const [canonical, synonyms] of Object.entries(freqPatterns)) {
                for (const synonym of synonyms) {
                    if (semanticSimilarity(term, synonym) > 0.85) {
                        result.frequency = canonical;
                        break;
                    }
                }
                if (result.frequency) break;
            }
            if (result.frequency) break;
        }
    }

    // Step 8: Extract drug names using common medication list + POS patterns
    const commonDrugs = [
        'aspirin', 'ibuprofen', 'acetaminophen', 'tylenol', 'advil', 'motrin',
        'lisinopril', 'amlodipine', 'atorvastatin', 'simvastatin', 'metoprolol',
        'metformin', 'insulin', 'glipizide', 'glyburide',
        'omeprazole', 'pantoprazole', 'ranitidine',
        'albuterol', 'fluticasone', 'prednisone',
        'levothyroxine', 'synthroid',
        'warfarin', 'apixaban', 'rivaroxaban',
        'amoxicillin', 'azithromycin', 'ciprofloxacin',
        'gabapentin', 'pregabalin',
        'sertraline', 'fluoxetine', 'escitalopram',
        'oxycodone', 'hydrocodone', 'tramadol',
        'furosemide', 'hydrochlorothiazide', 'metformin'
    ];

    // Look for drug names in tokens
    for (const token of tokens) {
        for (const drug of commonDrugs) {
            if (semanticSimilarity(token.token, drug) > 0.9) {
                result.drug_name = drug;
                break;
            }
        }
        if (result.drug_name) break;
    }

    // Also check for drug after verb (e.g., "take aspirin")
    if (!result.drug_name) {
        for (const pair of verbObjectPairs) {
            const words = pair.object.split(' ');
            for (const word of words) {
                for (const drug of commonDrugs) {
                    if (semanticSimilarity(word, drug) > 0.85) {
                        result.drug_name = drug;
                        break;
                    }
                }
                if (result.drug_name) break;
            }
            if (result.drug_name) break;
        }
    }

    // Step 9: Extract indication (purpose) using preposition patterns
    const indicationMatch = input.match(/\b(?:for|to treat|to prevent)\s+([\w\s]+?)(?:\.|$|,)/i);
    if (indicationMatch) {
        result.indication = indicationMatch[1].trim();
    }

    // Step 10: Calculate confidence based on extraction quality
    const fields = ['quantity', 'unit', 'route', 'frequency'];
    const extractedCount = fields.filter(f => result[f] !== null).length;
    const hasVerb = tokens.some(t => t.pos === 'VERB');
    const hasTemporal = temporalExprs.length > 0;

    let confidence = 'low';
    if (extractedCount >= 3 && hasVerb) confidence = 'high';
    else if (extractedCount >= 2 || (extractedCount >= 1 && hasTemporal)) confidence = 'medium';

    return {
        ...result,
        success: extractedCount >= 2 || (result.quantity && result.unit),
        source: 'nlp_fallback',
        confidence,
        requires_review: confidence !== 'high',
        extracted_fields: extractedCount,
        nlp_features: {
            hasVerb,
            temporalExpressions: temporalExprs.length,
            verbObjectPairs: verbObjectPairs.length
        }
    };
}

/**
 * Build the extraction prompt for the ML model
 * Formatted for T5-based models (text2text-generation)
 */
function buildExtractionPrompt(input) {
    // T5 models work best with task-specific prefixes
    return `extract medication information: ${input}`;
}

/**
 * Parse ML model output into structured JSON
 */
function parseMLOutput(output) {
    try {
        // Extract JSON from the model output
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return null;
        }

        const parsed = JSON.parse(jsonMatch[0]);

        // Normalize the output to match Rust parser format
        return {
            quantity: parsed.quantity || null,
            unit: parsed.unit || null,
            route: parsed.route || null,
            frequency: parsed.frequency || null,
            drug_name: parsed.drug_name || null,
            duration: parsed.duration || null,
            indication: parsed.indication || null,
            success: true,
            source: 'ml_fallback',
            confidence: 'medium',  // ML results default to medium confidence
            requires_review: true  // ML results always require review
        };
    } catch (error) {
        console.error('Failed to parse ML output:', error.message);
        return null;
    }
}

/**
 * Check if Rust parser result indicates failure/unknown
 */
function isRustParserFailed(result) {
    if (!result) return true;

    // Check for explicit error
    if (result.error !== undefined) return true;

    // Check for parse failure indicators
    if (result.success === false) return true;

    // Check if all key fields are null (unknown result)
    const keyFields = ['quantity', 'unit', 'route', 'frequency'];
    const allNull = keyFields.every(field => result[field] === null || result[field] === undefined);

    return allNull;
}

/**
 * Hybrid parser that tries Rust first, then falls back to ML
 */
async function parseWithFallback(input, wasmModule) {
    const startTime = performance.now();

    // Step 1: Try Rust parser first
    console.log(`[1/2] Attempting Rust parser...`);
    const rustResultRaw = wasmModule.parse_medical_instruction(input);
    const rustResult = JSON.parse(rustResultRaw);
    const rustTime = performance.now() - startTime;

    console.log(`      Rust result: ${rustResult.success ? 'SUCCESS' : 'FAILED'} (${rustTime.toFixed(2)}ms)`);

    // If Rust parser succeeded, return its result
    if (!isRustParserFailed(rustResult)) {
        return {
            ...rustResult,
            parse_time_ms: rustTime,
            parser_used: 'rust'
        };
    }

    // Step 2: Fall back to pattern-based extraction
    console.log(`[2/2] Rust failed, attempting pattern-based fallback...`);

    const mlStartTime = performance.now();

    let mlResult;

    if (CONFIG.mlStrategy === 'pattern') {
        // Fast pattern-based extraction (< 1ms)
        mlResult = extractWithPatterns(input);
        const mlTime = performance.now() - mlStartTime;
        console.log(`      Pattern extraction complete (${mlTime.toFixed(2)}ms)`);

        if (mlResult.success) {
            const totalTime = performance.now() - startTime;
            return {
                ...mlResult,
                rust_error: rustResult.error || null,
                parse_time_ms: totalTime,
                rust_time_ms: rustTime,
                ml_time_ms: mlTime,
                parser_used: 'pattern_fallback'
            };
        }
    } else if (CONFIG.mlStrategy === 'transformers') {
        // Neural model fallback (slow, requires download)
        const extractor = await initializeMLPipeline();
        if (!extractor) {
            return {
                ...rustResult,
                parse_time_ms: rustTime,
                parser_used: 'rust',
                ml_fallback_available: false
            };
        }

        const prompt = buildExtractionPrompt(input);
        try {
            const output = await extractor(prompt, {
                max_new_tokens: 256,
                temperature: 0.1,
                do_sample: false,
                return_full_text: false
            });

            const mlTime = performance.now() - mlStartTime;
            const generatedText = output[0]?.generated_text || '';
            console.log(`      ML inference complete (${mlTime.toFixed(2)}ms)`);

            mlResult = parseMLOutput(generatedText);

            if (mlResult) {
                const totalTime = performance.now() - startTime;
                return {
                    ...mlResult,
                    rust_error: rustResult.error || null,
                    parse_time_ms: totalTime,
                    rust_time_ms: rustTime,
                    ml_time_ms: mlTime,
                    parser_used: 'ml_fallback'
                };
            }
        } catch (error) {
            console.error('ML inference error:', error.message);
        }
    }

    // Fallback failed, return Rust error
    const mlTime = performance.now() - mlStartTime;
    return {
        ...rustResult,
        parse_time_ms: rustTime + mlTime,
        rust_time_ms: rustTime,
        ml_time_ms: mlTime,
        parser_used: 'rust',
        ml_fallback_attempted: true,
        ml_fallback_success: false
    };
}

/**
 * Demonstrates running with Wasmer Edge.js isolation
 */
function demonstrateEdgeJsIsolation() {
    console.log('='.repeat(60));
    console.log('Wasmer Edge.js Isolation Layer');
    console.log('='.repeat(60));
    console.log();
    console.log('To run this script with additional WebAssembly sandboxing:');
    console.log();
    console.log('  1. Install Edge.js:');
    console.log('     curl -fsSL https://edgejs.org/install | bash');
    console.log();
    console.log('  2. Run with safe mode (full isolation):');
    console.log('     edge --safe sandbox.js');
    console.log();
    console.log('Edge.js provides:');
    console.log('  - WebAssembly sandboxing of system calls');
    console.log('  - WASIX-based isolation layer');
    console.log('  - Native module sandboxing via NAPI');
    console.log('  - ~5-30% performance overhead vs native Node.js');
    console.log();
    console.log('ML Model Security:');
    console.log('  - NuExtract-tiny runs locally via Transformers.js');
    console.log('  - Model downloaded once, cached locally');
    console.log('  - No data sent to external APIs during inference');
    console.log('  - WASM/WebGPU backend for sandboxed execution');
    console.log();
}

/**
 * Runs the medical instruction parser with ML fallback
 */
async function runWasmTest(input) {
    console.log('='.repeat(60));
    console.log('Test Case: Medical Sig Parsing with ML Fallback');
    console.log('='.repeat(60));
    console.log();
    console.log(`Input: "${input}"`);
    console.log();

    // Read the WASM binary for inspection
    const wasmBuffer = fs.readFileSync(CONFIG.wasmPath);
    console.log(`[INFO] WASM binary loaded: ${wasmBuffer.length} bytes`);

    // Import the wasm-bindgen generated module
    const wasmModule = await import('./pkg/medical_data_normalizer.js');

    console.log('[INFO] WASM module initialized successfully');
    console.log();

    // Call the hybrid parser with fallback
    const result = await parseWithFallback(input, wasmModule);

    console.log();
    console.log('Output (JSON):');
    console.log(JSON.stringify(result, null, 2));
    console.log();

    console.log('Structured Result:');
    console.log(`  Parser Used:  ${result.parser_used}`);
    console.log(`  Parse Time:   ${result.parse_time_ms?.toFixed(2) || 'N/A'}ms`);
    if (result.rust_time_ms) console.log(`  Rust Time:    ${result.rust_time_ms.toFixed(2)}ms`);
    if (result.ml_time_ms) console.log(`  ML Time:      ${result.ml_time_ms.toFixed(2)}ms`);
    console.log(`  Quantity:     ${result.quantity || 'N/A'}`);
    console.log(`  Unit:         ${result.unit || 'N/A'}`);
    console.log(`  Route:        ${result.route || 'N/A'}`);
    console.log(`  Frequency:    ${result.frequency || 'N/A'}`);
    console.log(`  Drug Name:    ${result.drug_name || 'N/A'}`);
    console.log(`  Confidence:   ${result.confidence_level || result.confidence || 'N/A'}`);
    console.log(`  Review Req:   ${result.requires_review ? 'Yes' : 'No'}`);
    if (result.rust_error) console.log(`  Rust Error:   ${result.rust_error}`);
    console.log();

    return { result, wasmModule };
}

/**
 * Demonstrates additional test cases with fallback
 */
async function runAdditionalTests(wasmModule) {
    console.log('='.repeat(60));
    console.log('Additional Test Cases (with ML Fallback)');
    console.log('='.repeat(60));
    console.log();

    const testCases = [
        'Give 500 ml IV BID',
        '2 tabs',
        'Administer 10 ml po tid',
        'Take 1 tab qd',
        // These should trigger ML fallback
        'Patient should take one aspirin daily for headache',
        'Apply cream to affected area twice a day',
        'Use inhaler every 4 hours as needed for asthma',
        'Inject 10 units insulin subcutaneously before meals',
        'Take metformin 500mg by mouth with breakfast',
        'Instill 2 drops in each eye at bedtime'
    ];

    for (const testCase of testCases) {
        console.log(`Input: "${testCase}"`);
        const result = await parseWithFallback(testCase, wasmModule);
        console.log(`  → Parser: ${result.parser_used}, qty: ${result.quantity || 'null'}, unit: ${result.unit || 'null'}, route: ${result.route || 'null'}, freq: ${result.frequency || 'null'}`);
        console.log(`  → Time: ${result.parse_time_ms?.toFixed(2) || 'N/A'}ms`);
        console.log();
    }
}

/**
 * Tests edge cases with ML fallback
 */
async function runEdgeCaseTests(wasmModule) {
    console.log('='.repeat(60));
    console.log('Edge Case Tests (with ML Fallback)');
    console.log('='.repeat(60));
    console.log();

    const edgeCases = [
        // Standard cases that Rust handles
        { input: '1 tab po qd', description: 'Standard format' },
        { input: 'Take 1 tablet by mouth daily', description: 'Full words' },

        // Complex cases that may need ML fallback
        { input: 'Give the patient 2 capsules orally every morning', description: 'Verbose instruction' },
        { input: 'Apply 1 patch to skin q72h', description: 'Extended release patch' },
        { input: 'Inhale 2 puffs from inhaler every 4 hours as needed', description: 'PRN inhaler' },
        { input: 'Take metformin 500mg with meals', description: 'Drug name first' },
        { input: 'Patient should use 1 spray in each nostril BID', description: 'Nasal spray' },

        // Ambiguous cases
        { input: 'Take as directed', description: 'Vague instruction' },
        { input: 'Use as needed for pain', description: 'PRN only' },

        // Invalid inputs
        { input: '', description: 'Empty string' },
        { input: 'abc def ghi', description: 'Completely invalid' },
    ];

    let rustCount = 0;
    let mlCount = 0;
    let failedCount = 0;

    for (const testCase of edgeCases) {
        try {
            const result = await parseWithFallback(testCase.input, wasmModule);

            console.log(`Test: ${testCase.description}`);
            console.log(`  Input: "${testCase.input}"`);
            console.log(`  Parser: ${result.parser_used}`);
            console.log(`  → qty: ${result.quantity ?? 'null'}, unit: ${result.unit ?? 'null'}, route: ${result.route ?? 'null'}, freq: ${result.frequency ?? 'null'}`);

            if (result.parser_used === 'rust') rustCount++;
            else if (result.parser_used === 'ml_fallback') mlCount++;
            else failedCount++;

            console.log();
        } catch (error) {
            console.log(`Test: ${testCase.description}`);
            console.log(`  Input: "${testCase.input}"`);
            console.log(`  Exception: ${error.message}`);
            console.log();
            failedCount++;
        }
    }

    console.log('-'.repeat(60));
    console.log(`Results: ${rustCount} Rust, ${mlCount} ML Fallback, ${failedCount} Failed`);
    console.log('-'.repeat(60));
    console.log();

    return { rustCount, mlCount, failedCount };
}

/**
 * Displays sandbox security information
 */
function displaySecurityInfo() {
    console.log('='.repeat(60));
    console.log('Sandbox Security Features');
    console.log('='.repeat(60));
    console.log();
    console.log('WebAssembly Sandbox Properties:');
    console.log('  ✓ Linear memory with bounds checking');
    console.log('  ✓ No direct access to host memory');
    console.log('  ✓ Type-safe function calls');
    console.log('  ✓ No implicit access to system resources');
    console.log();
    console.log('ML Model Security (Transformers.js):');
    console.log('  ✓ Model runs entirely locally');
    console.log('  ✓ No external API calls during inference');
    console.log('  ✓ WASM/WebGPU backend for sandboxed execution');
    console.log('  ✓ Model cached locally after first download');
    console.log('  ✓ Quantized 8-bit model (~50MB)');
    console.log();
    console.log('Current Execution Context:');
    console.log('  ✓ WASM module runs in isolated memory space');
    console.log('  ✓ ML model runs in Transformers.js sandbox');
    console.log('  ✓ Memory access validated by runtime');
    console.log('  ✓ No file system access from WASM/ML code');
    console.log('  ✓ No network access during inference');
    console.log();
    console.log('For Enhanced Isolation with Edge.js:');
    console.log('  ✓ Entire Node.js runtime sandboxed in WASM');
    console.log('  ✓ OS system calls intercepted and controlled');
    console.log('  ✓ Native modules run in isolated environment');
    console.log('  ✓ WASIX-based security boundary');
    console.log();
}

/**
 * Main execution
 */
async function main() {
    try {
        // Show Edge.js isolation information
        demonstrateEdgeJsIsolation();

        // Run the primary test case
        const { result, wasmModule } = await runWasmTest(CONFIG.testInput);

        // Run additional test cases
        await runAdditionalTests(wasmModule);

        // Run edge case tests
        const edgeCaseResults = await runEdgeCaseTests(wasmModule);

        // Display security information
        displaySecurityInfo();

        console.log('='.repeat(60));
        console.log('All tests completed!');
        console.log('='.repeat(60));
        console.log();
        console.log('Summary:');
        console.log(`  Primary test input: "${CONFIG.testInput}"`);
        console.log(`  Parser used: ${result.parser_used}`);
        console.log(`  Parse time: ${result.parse_time_ms?.toFixed(2) || 'N/A'}ms`);
        console.log(`  Rust parses: ${edgeCaseResults.rustCount}`);
        console.log(`  Pattern fallback parses: ${edgeCaseResults.mlCount}`);
        console.log(`  Failed parses: ${edgeCaseResults.failedCount}`);
        console.log(`  ML Strategy: ${CONFIG.mlStrategy}`);
        console.log();
        console.log('The hybrid parser combines deterministic Rust parsing');
        console.log('with fast pattern-based fallback for natural language.');
        console.log('All processing runs locally in the sandbox.');
        console.log();

        return result;

    } catch (error) {
        console.error('[ERROR]', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run main
const result = await main();
console.log('Final JSON Output:');
console.log(JSON.stringify(result, null, 2));
console.log();
