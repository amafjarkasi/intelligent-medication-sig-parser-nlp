#!/usr/bin/env node

/**
 * sandbox.js - Enterprise-Grade WebAssembly Runtime for Intelligent Medication Sig Parser
 *
 * An optimized, production-ready Node.js harness for the Intelligent Medication Sig Parser
 * with NLP WASM module with intelligent ML fallback using Transformers.js.
 *
 * FEATURES:
 * - Hybrid parsing: Rust WASM first, pattern-based NLP fallback
 * - Comprehensive error handling with structured logging
 * - Performance monitoring and metrics collection
 * - Configurable strategies and thresholds
 * - Enterprise-grade security and sandboxing
 * - Batch processing with progress tracking
 * - Memory-efficient processing with streaming support
 *
 * @version 2.0.0
 * @author Intelligent Medication Sig Parser Team
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

// Optional: Transformers.js for neural fallback (loaded dynamically)
let transformers = null;

try {
  transformers = await import('@xenova/transformers');
} catch (e) {
  // Transformers.js not available, pattern fallback only
}

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = Object.freeze({
  // Paths
  wasmPath: path.join(__dirname, 'pkg', 'medical_data_normalizer_bg.wasm'),
  jsGluePath: path.join(__dirname, 'pkg', 'medical_data_normalizer.js'),

  // ML Strategy: 'pattern' (fast, default) | 'transformers' (neural, slow) | 'none'
  mlStrategy: process.env.SIG_PARSER_ML_STRATEGY || 'pattern',
  modelName: process.env.SIG_PARSER_MODEL || 'Xenova/t5-small',
  useQuantized: process.env.SIG_PARSER_QUANTIZED !== 'false',

  // Performance
  maxInputLength: parseInt(process.env.SIG_PARSER_MAX_INPUT_LENGTH) || 10000,
  batchSize: parseInt(process.env.SIG_PARSER_BATCH_SIZE) || 100,
  timeoutMs: parseInt(process.env.SIG_PARSER_TIMEOUT_MS) || 30000,

  // Confidence thresholds
  confidenceThreshold: parseFloat(process.env.SIG_PARSER_CONFIDENCE_THRESHOLD) || 0.7,
  minExtractedFields: parseInt(process.env.SIG_PARSER_MIN_FIELDS) || 2,

  // Security
  offlineMode: process.env.SIG_PARSER_OFFLINE === 'true',
  allowFileSystem: process.env.SIG_PARSER_ALLOW_FS !== 'false',

  // Logging
  logLevel: process.env.SIG_PARSER_LOG_LEVEL || 'info', // debug, info, warn, error
  structuredLogs: process.env.SIG_PARSER_STRUCTURED_LOGS === 'true',
});

// ============================================================================
// LOGGER
// ============================================================================

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

class Logger {
  constructor(config = CONFIG) {
    this.level = LOG_LEVELS[config.logLevel] ?? 1;
    this.structured = config.structuredLogs;
  }

  _log(level, message, meta = {}) {
    if (LOG_LEVELS[level] < this.level) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta,
    };

    if (this.structured) {
      console.log(JSON.stringify(logEntry));
    } else {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`);
    }
  }

  debug(msg, meta) { this._log('debug', msg, meta); }
  info(msg, meta) { this._log('info', msg, meta); }
  warn(msg, meta) { this._log('warn', msg, meta); }
  error(msg, meta) { this._log('error', msg, meta); }
}

const logger = new Logger();

// ============================================================================
// METRICS COLLECTOR
// ============================================================================

class MetricsCollector {
  constructor() {
    this.stats = {
      totalParses: 0,
      rustParses: 0,
      fallbackParses: 0,
      failedParses: 0,
      totalParseTimeMs: 0,
      avgParseTimeMs: 0,
      p95ParseTimeMs: 0,
      errors: [],
    };
    this.latencies = [];
  }

  recordParse(result, durationMs) {
    this.stats.totalParses++;
    this.stats.totalParseTimeMs += durationMs;
    this.latencies.push(durationMs);

    if (result.parser_used === 'rust') {
      this.stats.rustParses++;
    } else if (result.parser_used?.includes('fallback')) {
      this.stats.fallbackParses++;
    } else {
      this.stats.failedParses++;
    }

    // Keep only last 1000 latencies for P95 calculation
    if (this.latencies.length > 1000) {
      this.latencies.shift();
    }

    this._updateStats();
  }

  recordError(error, context = '') {
    this.stats.errors.push({
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      context,
    });

    // Keep only last 100 errors
    if (this.stats.errors.length > 100) {
      this.stats.errors.shift();
    }
  }

  _updateStats() {
    if (this.stats.totalParses > 0) {
      this.stats.avgParseTimeMs = this.stats.totalParseTimeMs / this.stats.totalParses;
    }

    if (this.latencies.length > 0) {
      const sorted = [...this.latencies].sort((a, b) => a - b);
      const p95Index = Math.floor(sorted.length * 0.95);
      this.stats.p95ParseTimeMs = sorted[p95Index] || 0;
    }
  }

  getStats() {
    return { ...this.stats };
  }

  reset() {
    this.stats = {
      totalParses: 0,
      rustParses: 0,
      fallbackParses: 0,
      failedParses: 0,
      totalParseTimeMs: 0,
      avgParseTimeMs: 0,
      p95ParseTimeMs: 0,
      errors: [],
    };
    this.latencies = [];
  }
}

const metrics = new MetricsCollector();

// ============================================================================
// ERROR CLASSES
// ============================================================================

class SigParserError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'SigParserError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

class ValidationError extends SigParserError {
  constructor(message, details) {
    super('VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

class TimeoutError extends SigParserError {
  constructor(message, details) {
    super('TIMEOUT_ERROR', message, details);
    this.name = 'TimeoutError';
  }
}

class WasmError extends SigParserError {
  constructor(message, details) {
    super('WASM_ERROR', message, details);
    this.name = 'WasmError';
  }
}

// ============================================================================
// INPUT VALIDATION
// ============================================================================

function validateInput(input) {
  if (input === null || input === undefined) {
    throw new ValidationError('Input cannot be null or undefined', { input });
  }

  if (typeof input !== 'string') {
    throw new ValidationError('Input must be a string', { type: typeof input });
  }

  if (input.length === 0) {
    throw new ValidationError('Input cannot be empty', { length: 0 });
  }

  if (input.length > CONFIG.maxInputLength) {
    throw new ValidationError(
      `Input exceeds maximum length of ${CONFIG.maxInputLength} characters`,
      { length: input.length, maxLength: CONFIG.maxInputLength }
    );
  }

  // Check for potentially dangerous patterns (basic sanitization)
  const dangerousPatterns = [
    { pattern: /<script\b/i, name: 'script_tag' },
    { pattern: /javascript:/i, name: 'javascript_protocol' },
    { pattern: /on\w+\s*=/i, name: 'event_handler' },
  ];

  for (const { pattern, name } of dangerousPatterns) {
    if (pattern.test(input)) {
      logger.warn('Potentially dangerous input pattern detected', { pattern: name });
      // Don't throw, just warn - the WASM parser should handle this safely
    }
  }

  return true;
}

// ============================================================================
// NLP UTILITIES (Pattern-Based Fallback)
// ============================================================================

// Cache for compiled patterns
const patternCache = new Map();

const POS_PATTERNS = Object.freeze({
  NUMBER: /\b\d+(?:\.\d+)?\b/,
  WORD_NUMBER: /\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\b/i,
  VERB: /\b(?:take|give|administer|apply|inject|inhale|instill|use|swallow|place|put|spray)\b/i,
  PREPOSITION: /\b(?:by|with|to|in|into|under|per|for|at|on)\b/i,
});

const SEMANTIC_GROUPS = Object.freeze({
  tablet: ['tab', 'tablet', 'tabs', 'tablets', 'pill', 'pills'],
  capsule: ['cap', 'capsule', 'caps', 'capsules'],
  oral: ['oral', 'po', 'p.o.', 'by mouth', 'per os', 'swallow'],
  intravenous: ['iv', 'i.v.', 'intravenous'],
  daily: ['daily', 'qd', 'q.d.', 'every day', 'each day', 'once daily'],
  twice: ['bid', 'b.i.d.', 'twice', 'two times', '2x'],
});

const UNIT_PATTERNS = Object.freeze({
  tab: ['tab', 'tablet', 'tabs', 'tablets', 'pill', 'pills'],
  cap: ['cap', 'capsule', 'caps', 'capsules'],
  mg: ['mg', 'milligram', 'milligrams'],
  ml: ['ml', 'milliliter', 'milliliters', 'cc', 'ccs'],
  unit: ['unit', 'units'],
  drop: ['drop', 'drops', 'gtt', 'gtts'],
  spray: ['spray', 'sprays'],
  patch: ['patch', 'patches'],
  puff: ['puff', 'puffs', 'inhalation', 'inhalations'],
  supp: ['supp', 'suppository', 'suppositories'],
});

const ROUTE_PATTERNS = Object.freeze({
  oral: ['oral', 'po', 'p.o.', 'by mouth', 'per os', 'swallow'],
  intravenous: ['iv', 'i.v.', 'intravenous', 'intravenously'],
  intramuscular: ['im', 'i.m.', 'intramuscular', 'intramuscularly'],
  subcutaneous: ['subq', 'subcut', 'subcutaneous', 'subcutaneously', 'sc', 's.c.'],
  sublingual: ['sl', 's.l.', 'sublingual', 'sublingually', 'under tongue'],
  rectal: ['pr', 'p.r.', 'rectal', 'rectally', 'per rectum'],
  topical: ['topical', 'topically', 'apply', 'applied', 'transdermal', 'td'],
  inhalation: ['inhale', 'inhaled', 'inhalation', 'inh', 'nebulizer', 'nebulized'],
  ophthalmic: ['ophthalmic', 'eye', 'eyes', 'ophth', 'ou', 'od', 'os'],
  nasal: ['nasal', 'intranasal', 'nose', 'nostril', 'nostrils'],
  buccal: ['buccal', 'cheek'],
  otic: ['otic', 'ear', 'ears', 'auricular'],
});

const FREQ_PATTERNS = Object.freeze({
  once_daily: ['qd', 'q.d.', 'daily', 'once daily', 'once a day', 'every day', 'each day', 'qday'],
  twice_daily: ['bid', 'b.i.d.', 'twice daily', 'twice a day', 'two times daily', '2x daily'],
  three_times_daily: ['tid', 't.i.d.', 'three times daily', 'three times a day', '3x daily'],
  four_times_daily: ['qid', 'q.i.d.', 'four times daily', 'four times a day', '4x daily'],
  every_4_hours: ['q4h', 'q4hr', 'every 4 hours', 'q4hours'],
  every_6_hours: ['q6h', 'q6hr', 'every 6 hours', 'q6hours'],
  every_8_hours: ['q8h', 'q8hr', 'every 8 hours', 'q8hours'],
  every_12_hours: ['q12h', 'q12hr', 'every 12 hours', 'q12hours'],
  as_needed: ['prn', 'p.r.n.', 'as needed', 'as necessary', 'when needed'],
  once: ['once', 'one time', 'single dose', 'stat', 'statim'],
  bedtime: ['qhs', 'h.s.', 'hs', 'at bedtime', 'bedtime'],
  morning: ['qam', 'q.a.m.', 'morning', 'every morning', 'in the morning', 'am', 'a.m.'],
  evening: ['qpm', 'q.p.m.', 'evening', 'every evening', 'in the evening', 'pm', 'p.m.'],
  weekly: ['weekly', 'once weekly', 'every week', 'qweek', 'qwk'],
});

// Optimized Levenshtein with early termination
function levenshteinDistance(str1, str2, maxDistance = 3) {
  const len1 = str1.length;
  const len2 = str2.length;

  if (Math.abs(len1 - len2) > maxDistance) return maxDistance + 1;

  // Use single array for space optimization
  const prev = new Array(len2 + 1);
  const curr = new Array(len2 + 1);

  for (let j = 0; j <= len2; j++) prev[j] = j;

  for (let i = 1; i <= len1; i++) {
    curr[0] = i;
    let minInRow = curr[0];

    for (let j = 1; j <= len2; j++) {
      const cost = str1.charAt(i - 1) === str2.charAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,      // deletion
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost // substitution
      );
      minInRow = Math.min(minInRow, curr[j]);
    }

    if (minInRow > maxDistance) return maxDistance + 1;

    // Swap arrays
    for (let j = 0; j <= len2; j++) prev[j] = curr[j];
  }

  return prev[len2];
}

function semanticSimilarity(term1, term2, threshold = 0.8) {
  const t1 = term1.toLowerCase();
  const t2 = term2.toLowerCase();

  if (t1 === t2) return 1.0;

  // Check semantic groups
  for (const [canonical, synonyms] of Object.entries(SEMANTIC_GROUPS)) {
    const group = [canonical, ...synonyms];
    if (group.includes(t1) && group.includes(t2)) {
      return 0.9;
    }
  }

  // Levenshtein for typos (with early termination)
  const maxLen = Math.max(t1.length, t2.length);
  if (maxLen === 0) return 1.0;

  const distance = levenshteinDistance(t1, t2, Math.floor(maxLen * (1 - threshold)));
  const similarity = 1 - (distance / maxLen);

  return similarity >= threshold ? similarity : 0;
}

function tokenizeWithPOS(input) {
  const tokens = input.toLowerCase().match(/\b\w+(?:\.\w+)?\b/g) || [];
  return tokens.map(token => {
    let pos = 'OTHER';
    if (POS_PATTERNS.NUMBER.test(token)) pos = 'NUMBER';
    else if (POS_PATTERNS.WORD_NUMBER.test(token)) pos = 'WORD_NUMBER';
    else if (POS_PATTERNS.VERB.test(token)) pos = 'VERB';
    else if (POS_PATTERNS.PREPOSITION.test(token)) pos = 'PREPOSITION';
    return { token, pos };
  });
}

function extractNGrams(tokens, n) {
  const ngrams = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).map(t => t.token).join(' '));
  }
  return ngrams;
}

function matchPattern(input, patterns, similarityThreshold = 0.85) {
  const tokens = tokenizeWithPOS(input);
  const ngrams2 = extractNGrams(tokens, 2);
  const ngrams3 = extractNGrams(tokens, 3);
  const allTerms = [...ngrams3, ...ngrams2, ...tokens.map(t => t.token)];

  for (const term of allTerms) {
    for (const [canonical, synonyms] of Object.entries(patterns)) {
      for (const synonym of synonyms) {
        if (semanticSimilarity(term, synonym, similarityThreshold) > similarityThreshold) {
          return canonical;
        }
      }
    }
  }
  return null;
}

// ============================================================================
// PATTERN-BASED EXTRACTION
// ============================================================================

function extractWithPatterns(input) {
  const startTime = performance.now();
  const result = {
    quantity: null,
    unit: null,
    route: null,
    frequency: null,
    drug_name: null,
    duration: null,
    indication: null,
  };

  // Tokenize
  const tokens = tokenizeWithPOS(input);

  // Extract quantity
  const numberTokens = tokens.filter(t => t.pos === 'NUMBER' || t.pos === 'WORD_NUMBER');
  if (numberTokens.length > 0) {
    const qty = numberTokens[0].token;
    const wordToNum = {
      one: '1', two: '2', three: '3', four: '4', five: '5',
      six: '6', seven: '7', eight: '8', nine: '9', ten: '10'
    };
    result.quantity = wordToNum[qty.toLowerCase()] || qty;
  }

  // Extract unit, route, frequency using pattern matching
  result.unit = matchPattern(input, UNIT_PATTERNS, 0.8);
  result.route = matchPattern(input, ROUTE_PATTERNS, 0.85);
  result.frequency = matchPattern(input, FREQ_PATTERNS, 0.85);

  // Extract indication
  const indicationMatch = input.match(/\b(?:for|to treat|to prevent)\s+([\w\s]+?)(?:\.|$|,)/i);
  if (indicationMatch) {
    result.indication = indicationMatch[1].trim();
  }

  // Calculate confidence
  const fields = ['quantity', 'unit', 'route', 'frequency'];
  const extractedCount = fields.filter(f => result[f] !== null).length;
  const hasVerb = tokens.some(t => t.pos === 'VERB');

  let confidence = 'low';
  if (extractedCount >= 3 && hasVerb) confidence = 'high';
  else if (extractedCount >= 2) confidence = 'medium';

  const extractionTime = performance.now() - startTime;

  return {
    ...result,
    success: extractedCount >= CONFIG.minExtractedFields || (result.quantity && result.unit),
    source: 'pattern_fallback',
    confidence,
    confidence_level: confidence === 'high' ? 3 : confidence === 'medium' ? 2 : 1,
    requires_review: confidence !== 'high',
    extracted_fields: extractedCount,
    extraction_time_ms: extractionTime,
  };
}

// ============================================================================
// ML PIPELINE (Optional Neural Fallback)
// ============================================================================

let mlPipeline = null;
let mlPipelinePromise = null;

async function initializeMLPipeline() {
  if (!transformers) {
    logger.debug('Transformers.js not available');
    return null;
  }

  if (mlPipeline) return mlPipeline;
  if (mlPipelinePromise) return mlPipelinePromise;

  if (CONFIG.mlStrategy !== 'transformers' || CONFIG.offlineMode) {
    logger.debug('ML pipeline disabled by configuration');
    return null;
  }

  mlPipelinePromise = (async () => {
    try {
      logger.info('Initializing ML pipeline', { model: CONFIG.modelName });

      const { pipeline, env } = transformers;
      env.allowLocalModels = true;
      env.allowRemoteModels = !CONFIG.offlineMode;
      env.cacheDir = path.join(__dirname, '.cache', 'transformers');

      mlPipeline = await pipeline(
        'text2text-generation',
        CONFIG.modelName,
        {
          quantized: CONFIG.useQuantized,
          revision: 'main',
          device: 'cpu',
          dtype: 'q8',
        }
      );

      logger.info('ML pipeline initialized successfully');
      return mlPipeline;
    } catch (error) {
      logger.error('Failed to initialize ML pipeline', { error: error.message });
      return null;
    }
  })();

  return mlPipelinePromise;
}

// ============================================================================
// HYBRID PARSER
// ============================================================================

function isRustParserFailed(result) {
  if (!result) return true;
  if (result.error !== undefined) return true;
  if (result.success === false) return true;

  const keyFields = ['quantity', 'unit', 'route', 'frequency'];
  const allNull = keyFields.every(field => result[field] === null || result[field] === undefined);
  return allNull;
}

export async function parseWithFallback(input, wasmModule, options = {}) {
  const startTime = performance.now();
  const timeoutMs = options.timeoutMs || CONFIG.timeoutMs;

  // Validate input
  try {
    validateInput(input);
  } catch (error) {
    metrics.recordError(error, 'input_validation');
    return {
      success: false,
      error: error.message,
      error_code: error.code,
      input: input?.substring(0, 100),
      parser_used: 'none',
      parse_time_ms: performance.now() - startTime,
    };
  }

  // Create timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new TimeoutError(
      `Parse timeout after ${timeoutMs}ms`,
      { input: input.substring(0, 100) }
    )), timeoutMs);
  });

  try {
    // Race between parsing and timeout
    const result = await Promise.race([
      _parseWithFallbackInternal(input, wasmModule),
      timeoutPromise,
    ]);

    const totalTime = performance.now() - startTime;
    metrics.recordParse(result, totalTime);

    return result;
  } catch (error) {
    const totalTime = performance.now() - startTime;
    metrics.recordError(error, 'parse_execution');

    return {
      success: false,
      error: error.message,
      error_code: error.code || 'PARSE_ERROR',
      input: input.substring(0, 100),
      parser_used: 'none',
      parse_time_ms: totalTime,
    };
  }
}

async function _parseWithFallbackInternal(input, wasmModule) {
  const startTime = performance.now();

  // Step 1: Try Rust parser
  logger.debug('Attempting Rust parser', { input: input.substring(0, 50) });

  let rustResult;
  let rustTime;

  try {
    const rustStart = performance.now();
    const rustResultRaw = wasmModule.parse_medical_instruction(input);
    rustResult = JSON.parse(rustResultRaw);
    rustTime = performance.now() - rustStart;

    logger.debug('Rust parser result', {
      success: !isRustParserFailed(rustResult),
      duration_ms: rustTime.toFixed(2),
    });
  } catch (error) {
    logger.warn('Rust parser threw exception', { error: error.message });
    rustResult = { success: false, error: error.message };
    rustTime = performance.now() - startTime;
  }

  // If Rust succeeded, return immediately
  if (!isRustParserFailed(rustResult)) {
    return {
      ...rustResult,
      parse_time_ms: rustTime,
      parser_used: 'rust',
    };
  }

  // Step 2: Pattern-based fallback
  logger.debug('Rust failed, attempting pattern fallback');
  const mlStartTime = performance.now();

  const patternResult = extractWithPatterns(input);
  const mlTime = performance.now() - mlStartTime;

  if (patternResult.success) {
    const totalTime = performance.now() - startTime;
    logger.debug('Pattern fallback succeeded', { duration_ms: mlTime.toFixed(2) });

    return {
      ...patternResult,
      rust_error: rustResult.error || null,
      parse_time_ms: totalTime,
      rust_time_ms: rustTime,
      ml_time_ms: mlTime,
      parser_used: 'pattern_fallback',
    };
  }

  // Step 3: Neural ML fallback (if enabled and available)
  if (CONFIG.mlStrategy === 'transformers') {
    const extractor = await initializeMLPipeline();

    if (extractor) {
      try {
        const neuralStart = performance.now();
        const prompt = `extract medication information: ${input}`;

        const output = await extractor(prompt, {
          max_new_tokens: 256,
          temperature: 0.1,
          do_sample: false,
          return_full_text: false,
        });

        const neuralTime = performance.now() - neuralStart;
        const generatedText = output[0]?.generated_text || '';

        // Parse ML output
        const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const totalTime = performance.now() - startTime;

          return {
            quantity: parsed.quantity || null,
            unit: parsed.unit || null,
            route: parsed.route || null,
            frequency: parsed.frequency || null,
            drug_name: parsed.drug_name || null,
            duration: parsed.duration || null,
            indication: parsed.indication || null,
            success: true,
            source: 'ml_neural_fallback',
            confidence: 'medium',
            confidence_level: 2,
            requires_review: true,
            rust_error: rustResult.error || null,
            parse_time_ms: totalTime,
            rust_time_ms: rustTime,
            ml_time_ms: neuralTime,
            parser_used: 'ml_neural_fallback',
          };
        }
      } catch (error) {
        logger.error('Neural ML fallback failed', { error: error.message });
      }
    }
  }

  // All fallbacks failed
  const totalTime = performance.now() - startTime;
  logger.warn('All parsing strategies failed', { input: input.substring(0, 50) });

  return {
    ...rustResult,
    parse_time_ms: totalTime,
    rust_time_ms: rustTime,
    parser_used: 'rust',
    ml_fallback_attempted: true,
    ml_fallback_success: false,
  };
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

export async function parseBatch(inputs, wasmModule, options = {}) {
  const results = [];
  const batchSize = options.batchSize || CONFIG.batchSize;
  const onProgress = options.onProgress || (() => {});

  logger.info('Starting batch processing', {
    total: inputs.length,
    batchSize,
  });

  const startTime = performance.now();

  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    const batchPromises = batch.map(input =>
      parseWithFallback(input, wasmModule, options)
        .catch(error => ({
          success: false,
          error: error.message,
          input: input.substring(0, 100),
        }))
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    onProgress({
      processed: Math.min(i + batchSize, inputs.length),
      total: inputs.length,
      percent: Math.round(((i + batchSize) / inputs.length) * 100),
    });
  }

  const totalTime = performance.now() - startTime;

  logger.info('Batch processing complete', {
    total: inputs.length,
    duration_ms: totalTime.toFixed(2),
    avg_per_item: (totalTime / inputs.length).toFixed(2),
  });

  return {
    results,
    stats: {
      total: inputs.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalTimeMs: totalTime,
    },
  };
}

// ============================================================================
// WASM MODULE INITIALIZATION
// ============================================================================

export async function initializeWasmModule() {
  logger.info('Initializing WASM module');

  try {
    // Verify WASM file exists
    if (!fs.existsSync(CONFIG.wasmPath)) {
      throw new WasmError(
        `WASM binary not found at ${CONFIG.wasmPath}. Run: wasm-pack build --target nodejs`,
        { path: CONFIG.wasmPath }
      );
    }

    // Import and initialize
    const wasmModule = await import('./pkg/medical_data_normalizer.js');

    logger.info('WASM module initialized successfully');

    return wasmModule;
  } catch (error) {
    logger.error('Failed to initialize WASM module', { error: error.message });
    throw error;
  }
}

// ============================================================================
// MAIN EXECUTION (CLI)
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'test';

  logger.info('SigParser Sandbox starting', {
    version: '2.0.0',
    mlStrategy: CONFIG.mlStrategy,
    logLevel: CONFIG.logLevel,
  });

  try {
    const wasmModule = await initializeWasmModule();

    switch (command) {
      case 'test':
        await runTests(wasmModule);
        break;
      case 'parse':
        if (!args[1]) {
          console.error('Usage: node sandbox.js parse "Take 1 tab po qd"');
          process.exit(1);
        }
        const result = await parseWithFallback(args[1], wasmModule);
        console.log(JSON.stringify(result, null, 2));
        break;
      case 'batch':
        if (!args[1]) {
          console.error('Usage: node sandbox.js batch <file.json>');
          process.exit(1);
        }
        await runBatchFile(args[1], wasmModule);
        break;
      case 'stats':
        console.log(JSON.stringify(metrics.getStats(), null, 2));
        break;
      default:
        console.log('Usage: node sandbox.js [test|parse|batch|stats]');
        console.log('  test  - Run test suite');
        console.log('  parse - Parse a single instruction');
        console.log('  batch - Process batch from JSON file');
        console.log('  stats - Show metrics');
    }

    return 0;
  } catch (error) {
    logger.error('Fatal error', {
      error: error.message,
      stack: error.stack,
    });
    return 1;
  }
}

async function runTests(wasmModule) {
  const testCases = [
    { input: 'Take 1 tab po qd', expected: { quantity: '1', unit: 'tab', route: 'oral' } },
    { input: 'Give 500 mg IV BID', expected: { quantity: '500', unit: 'mg', route: 'intravenous' } },
    { input: 'Apply cream topically TID', expected: { unit: 'patch', route: 'topical' } },
    { input: 'Take 2 tablets by mouth daily', expected: { quantity: '2', unit: 'tab', route: 'oral' } },
  ];

  console.log('\nRunning Test Suite\n' + '='.repeat(60));

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const result = await parseWithFallback(testCase.input, wasmModule);

    const success = result.success &&
      (!testCase.expected.quantity || result.quantity === testCase.expected.quantity) &&
      (!testCase.expected.unit || result.unit === testCase.expected.unit) &&
      (!testCase.expected.route || result.route === testCase.expected.route);

    if (success) {
      passed++;
      console.log(`✓ ${testCase.input.substring(0, 40)}`);
    } else {
      failed++;
      console.log(`✗ ${testCase.input.substring(0, 40)}`);
      console.log(`  Expected: ${JSON.stringify(testCase.expected)}`);
      console.log(`  Got: ${JSON.stringify(result)}`);
    }
  }

  console.log('='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`\nMetrics:`);
  console.log(JSON.stringify(metrics.getStats(), null, 2));
}

async function runBatchFile(filePath, wasmModule) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const inputs = Array.isArray(data) ? data : data.instructions;

  if (!inputs || !Array.isArray(inputs)) {
    throw new Error('Invalid batch file format. Expected { instructions: [...] } or [...]');
  }

  const result = await parseBatch(inputs, wasmModule, {
    onProgress: (progress) => {
      console.log(`Progress: ${progress.processed}/${progress.total} (${progress.percent}%)`);
    },
  });

  console.log('\nBatch Results:');
  console.log(JSON.stringify(result.stats, null, 2));

  // Write results to file
  const outputPath = filePath.replace('.json', '_results.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`\nResults written to: ${outputPath}`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(await main());
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  CONFIG,
  Logger,
  MetricsCollector,
  SigParserError,
  ValidationError,
  TimeoutError,
  WasmError,
  metrics,
  logger,
  validateInput,
  extractWithPatterns,
  initializeMLPipeline,
  isRustParserFailed,
};

export default {
  parseWithFallback,
  parseBatch,
  initializeWasmModule,
  metrics,
  CONFIG,
};
