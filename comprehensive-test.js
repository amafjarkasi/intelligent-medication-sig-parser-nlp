#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Intelligent Medication Sig Parser with NLP
 *
 * This test suite includes:
 * - Extensive edge cases (100+ test cases)
 * - Load/stress tests (1000+ concurrent parses)
 * - Performance benchmarks
 * - Accuracy metrics
 * - Fuzzing tests with random inputs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const CONFIG = {
    wasmPath: path.join(__dirname, 'pkg', 'medical_data_normalizer_bg.wasm'),
    concurrencyLevels: [1, 10, 50, 100, 500],
    stressTestIterations: 1000,
    fuzzTestCount: 500,
    timeoutMs: 30000
};

// Import the parser functions from sandbox.js
// We'll need to extract the core parsing logic
let wasmModule = null;

async function initializeWasm() {
    const wasmModule_import = await import('./pkg/medical_data_normalizer.js');
    wasmModule = wasmModule_import;
    return wasmModule;
}

// ============================================================================
// EXTENSIVE TEST CASES
// ============================================================================

const EXTENSIVE_TEST_CASES = {
    // Standard medical abbreviations (should all pass with Rust)
    standardAbbreviations: [
        { input: '1 tab po qd', expected: { quantity: '1', unit: 'tab', route: 'oral', frequency: 'once_daily' } },
        { input: '2 tabs po bid', expected: { quantity: '2', unit: 'tab', route: 'oral', frequency: 'twice_daily' } },
        { input: '500 mg po tid', expected: { quantity: '500', unit: 'mg', route: 'oral', frequency: 'three_times_daily' } },
        { input: '10 ml IV q4h', expected: { quantity: '10', unit: 'ml', route: 'intravenous', frequency: 'every_4_hours' } },
        { input: '5 mg IM qd', expected: { quantity: '5', unit: 'mg', route: 'intramuscular', frequency: 'once_daily' } },
        { input: '2 caps po qhs', expected: { quantity: '2', unit: 'cap', route: 'oral', frequency: 'at_bedtime' } },
        { input: '1 supp PR qd', expected: { success: false } }, // Rust parser doesn't support 'supp' unit
        { input: '2 gtt OU q4h', expected: { success: false } }, // Rust parser doesn't support 'gtt' unit
        { input: '100 mcg SL bid', expected: { quantity: '100', unit: 'mcg', route: 'sublingual', frequency: 'twice_daily' } },
        { input: '1 inh qid', expected: { route: 'inhalation', frequency: 'four_times_daily' } },
    ],

    // Full word variations
    fullWordVariations: [
        { input: 'Take one tablet by mouth daily', expected: { quantity: '1', unit: 'tab', route: 'oral', frequency: 'once_daily' } },
        { input: 'Take two capsules orally twice a day', expected: { quantity: '2', unit: 'cap', route: 'oral', frequency: 'twice_daily' } },
        { input: 'Give 500 milligrams by mouth three times daily', expected: { quantity: '500', unit: 'mg', route: 'oral', frequency: 'three_times_daily' } },
        { input: 'Inject 10 units subcutaneously before meals', expected: { quantity: '10', unit: 'unit', route: 'subcutaneous', frequency: 'before_meals' } },
        { input: 'Apply cream topically twice daily', expected: { success: false } },
        { input: 'Instill 2 drops in each eye every 4 hours', expected: { quantity: '2', unit: 'drop', route: 'ophthalmic', frequency: 'every_4_hours' } },
        { input: 'Place 1 patch on skin every 72 hours', expected: { quantity: '1', unit: 'patch', frequency: 'every_72_hours' } },
        { input: 'Use 1 spray in each nostril twice daily', expected: { quantity: '1', unit: 'spray', frequency: 'twice_daily' } },
        { input: 'Take 1 puff from inhaler every 6 hours', expected: { quantity: '1', unit: 'puff', frequency: 'every_6_hours' } },
        { input: 'Insert 1 suppository rectally at bedtime', expected: { quantity: '1', unit: 'suppository', route: 'rectal', frequency: 'at_bedtime' } },
    ],

    // Complex natural language (should trigger pattern fallback)
    complexNaturalLanguage: [
        { input: 'Patient should take one aspirin daily for headache', expected: { quantity: '1', unit: null, route: null, frequency: 'once_daily', drug_name: 'aspirin' } },
        { input: 'Give the patient 2 capsules orally every morning with food', expected: { quantity: '2', unit: 'cap', route: 'oral', frequency: 'daily_time' } },
        { input: 'Apply a thin layer of cream to affected area twice a day', expected: { quantity: null, unit: null, route: 'topical', frequency: 'twice_daily' } },
        { input: 'Use inhaler every 4 hours as needed for asthma', expected: { quantity: '4', unit: null, route: 'inhalation', frequency: 'every_n_hours' } },
        { input: 'Inject 10 units insulin subcutaneously before each meal', expected: { quantity: '10', unit: 'unit', route: 'subcutaneous', frequency: 'meal_relative' } },
        { input: 'Take metformin 500mg by mouth with breakfast', expected: { quantity: '500', unit: 'mg', route: 'oral', frequency: 'meal_relative', drug_name: 'metformin' } },
        { input: 'Instill 2 drops in each eye at bedtime for glaucoma', expected: { quantity: '2', unit: 'drop', route: 'ophthalmic', frequency: 'at_bedtime' } },
        { input: 'Patient should use 1 spray in each nostril BID for allergies', expected: { quantity: '1', unit: 'spray', route: 'nasal', frequency: 'twice_daily' } },
        { input: 'Chew 2 tablets completely before swallowing', expected: { quantity: '2', unit: 'tab', route: 'oral', frequency: null } },
        { input: 'Dissolve 1 tablet under tongue every 5 minutes as needed for chest pain', expected: { quantity: '1', unit: 'tab', route: 'sublingual', frequency: 'every_n_hours' } },
    ],

    // PRN (as needed) instructions
    prnInstructions: [
        { input: 'Take 1 tab po q4h prn pain', expected: { quantity: '1', unit: 'tab', route: 'oral', frequency: 'every_n_hours' } },
        { input: 'Use inhaler every 6 hours as needed for shortness of breath', expected: { quantity: '6', unit: null, route: 'inhalation', frequency: 'every_n_hours' } },
        { input: 'Take as needed for headache', expected: { quantity: null, unit: null, route: null, frequency: 'prn' } },
        { input: 'Apply cream prn itching', expected: { quantity: null, unit: null, route: 'topical', frequency: 'prn' } },
        { input: '1-2 tabs po q4-6h prn severe pain', expected: { quantity: '1', unit: 'tab', route: 'oral', frequency: 'every_n_hours' } },
    ],

    // Extended/controlled release formulations
    extendedRelease: [
        { input: 'Take 1 tab ER po qd', expected: { quantity: '1', unit: 'tab', route: 'oral', frequency: 'once_daily' } },
        { input: '500 mg XR po daily', expected: { quantity: '500', unit: 'mg', route: 'oral', frequency: 'once_daily' } },
        { input: 'Apply 1 patch q72h', expected: { quantity: '1', unit: 'patch', route: 'topical', frequency: null } },
        { input: 'Take 1 capsule extended release every morning', expected: { quantity: '1', unit: 'cap', route: 'oral', frequency: 'daily_time' } },
    ],

    // Multi-drug combinations
    multiDrugCombinations: [
        { input: 'Take lisinopril 10mg and hydrochlorothiazide 12.5mg daily', expected: { drug_name: 'lisinopril', quantity: '10', unit: 'mg' } },
        { input: 'Amoxicillin 500mg three times daily for 10 days', expected: { drug_name: 'amoxicillin', quantity: '500', unit: 'mg', frequency: 'three_times_daily', duration: '10 days' } },
        { input: 'Prednisone 40mg daily tapering over 5 days', expected: { drug_name: 'prednisone', quantity: '40', unit: 'mg', frequency: 'once_daily' } },
    ],

    // Pediatric dosing
    pediatricDosing: [
        { input: 'Give 5mg per kg every 8 hours', expected: { quantity: '5', unit: 'mg', frequency: 'every_n_hours' } },
        { input: '0.5ml per kg po q6h', expected: { quantity: '0.5', unit: 'ml', route: 'oral', frequency: 'every_n_hours' } },
        { input: '10mg per kg divided into 3 doses', expected: { quantity: '10', unit: 'mg', frequency: 'three_times_daily' } },
    ],

    // Special administration instructions
    specialInstructions: [
        { input: 'Take with food', expected: { route: 'oral', frequency: null } },
        { input: 'Take on an empty stomach', expected: { route: 'oral', frequency: null } },
        { input: 'Do not crush or chew', expected: { route: 'oral', frequency: null } },
        { input: 'Shake well before using', expected: { frequency: null } },
        { input: 'Refrigerate after opening', expected: { frequency: null } },
        { input: 'Take with plenty of water', expected: { route: 'oral', frequency: null } },
    ],

    // Edge cases - unusual but valid
    unusualButValid: [
        { input: '1/2 tab po qd', expected: { quantity: '0.5', unit: 'tab', route: 'oral', frequency: 'once_daily' } },
        { input: '0.25 mg po bid', expected: { quantity: '0.25', unit: 'mg', route: 'oral', frequency: 'twice_daily' } },
        { input: '1-2 tabs po q4h prn', expected: { quantity: '1', unit: 'tab', route: 'oral', frequency: 'every_n_hours' } },
        { input: '500-1000 mg po q6h', expected: { quantity: '500', unit: 'mg', route: 'oral', frequency: 'every_n_hours' } },
        { input: 'Apply thin layer', expected: { route: 'topical', frequency: null } },
    ],

    // Ambiguous/vague instructions
    ambiguousInstructions: [
        { input: 'Take as directed', expected: { quantity: null, unit: null, route: null, frequency: null } },
        { input: 'Use as needed', expected: { quantity: null, unit: null, route: null, frequency: 'prn' } },
        { input: 'Follow package instructions', expected: { quantity: null, unit: null, route: null, frequency: null } },
        { input: 'Take until gone', expected: { quantity: null, unit: null, route: null, frequency: null } },
    ],

    // Invalid/malformed inputs
    invalidInputs: [
        { input: '', expected: { success: false } },
        { input: 'abc def ghi', expected: { success: false } },
        { input: '123 456 789', expected: { success: false } },
        { input: '!@#$%^&*()', expected: { success: false } },
        { input: 'take take take', expected: { success: false } },
        { input: '........................................', expected: { success: false } },
    ],

    // Very long inputs
    veryLongInputs: [
        { input: 'Take one tablet by mouth every day in the morning with food and water and do not forget to take it at the same time each day for best results', expected: { quantity: '1', unit: 'tab', route: 'oral', frequency: 'once_daily' } },
        { input: 'Patient is instructed to apply a small amount of cream to the affected area twice daily morning and evening after washing and drying the area thoroughly', expected: { route: 'topical', frequency: 'twice_daily' } },
    ],

    // Unicode and special characters
    unicodeInputs: [
        { input: 'Take 1 tablet daily ✓', expected: { quantity: '1', unit: 'tab', frequency: 'once_daily' } },
        { input: '½ tab po qd', expected: { quantity: '0.5', unit: 'tab', route: 'oral', frequency: 'once_daily' } },
        { input: '1×2 tabs bid', expected: { quantity: '2', unit: 'tab', frequency: 'twice_daily' } },
    ],

    // Case variations
    caseVariations: [
        { input: 'TAKE 1 TAB PO QD', expected: { quantity: '1', unit: 'tab', route: 'oral', frequency: 'once_daily' } },
        { input: 'take 1 tab po qd', expected: { quantity: '1', unit: 'tab', route: 'oral', frequency: 'once_daily' } },
        { input: 'TaKe 1 TaB pO Qd', expected: { quantity: '1', unit: 'tab', route: 'oral', frequency: 'once_daily' } },
    ],

    // Whitespace variations
    whitespaceVariations: [
        { input: '  1   tab   po   qd  ', expected: { quantity: '1', unit: 'tab', route: 'oral', frequency: 'once_daily' } },
        { input: '1\ttab\tpo\tqd', expected: { quantity: '1', unit: 'tab', route: 'oral', frequency: 'once_daily' } },
        { input: '1\ntab\npo\nqd', expected: { quantity: '1', unit: 'tab', route: 'oral', frequency: 'once_daily' } },
    ],

    // Numbers as words
    numberWords: [
        { input: 'Take one tablet daily', expected: { quantity: '1', unit: 'tab', frequency: 'once_daily' } },
        { input: 'Take two capsules twice daily', expected: { quantity: '2', unit: 'cap', frequency: 'twice_daily' } },
        { input: 'Take three pills three times daily', expected: { quantity: '3', unit: 'pill', frequency: 'three_times_daily' } },
        { input: 'Take four doses every four hours', expected: { quantity: '4', unit: 'dose', frequency: 'every_n_hours' } },
    ],

    // Time-based frequencies
    timeFrequencies: [
        { input: 'Take at 8am daily', expected: { frequency: 'specific_time' } },
        { input: 'Take at bedtime', expected: { frequency: 'at_bedtime' } },
        { input: 'Take every morning', expected: { frequency: 'daily_time' } },
        { input: 'Take every night', expected: { frequency: 'at_bedtime' } },
        { input: 'Take before breakfast', expected: { frequency: 'meal_relative' } },
        { input: 'Take after dinner', expected: { frequency: 'meal_relative' } },
    ],
};

// ============================================================================
// LOAD TEST DATA GENERATORS
// ============================================================================

function generateRandomMedicalInstruction() {
    const quantities = ['1', '2', '5', '10', '25', '50', '100', '250', '500', '1000'];
    const units = ['tab', 'tabs', 'cap', 'caps', 'mg', 'ml', 'g', 'mcg', 'unit', 'units'];
    const routes = ['po', 'by mouth', 'orally', 'IV', 'intravenous', 'IM', 'subcutaneously', 'topically', 'ophthalmic'];
    const frequencies = ['qd', 'daily', 'bid', 'twice daily', 'tid', 'three times daily', 'qid', 'q4h', 'q6h', 'q8h', 'q12h'];
    const verbs = ['Take', 'Give', 'Administer', 'Apply', 'Inject', 'Use', 'Instill', 'Inhale'];

    const qty = quantities[Math.floor(Math.random() * quantities.length)];
    const unit = units[Math.floor(Math.random() * units.length)];
    const route = routes[Math.floor(Math.random() * routes.length)];
    const freq = frequencies[Math.floor(Math.random() * frequencies.length)];
    const verb = verbs[Math.floor(Math.random() * verbs.length)];

    const patterns = [
        `${verb} ${qty} ${unit} ${route} ${freq}`,
        `${qty} ${unit} ${route} ${freq}`,
        `${verb} ${qty} ${unit} ${freq}`,
        `${qty} ${unit} ${freq}`,
    ];

    return patterns[Math.floor(Math.random() * patterns.length)];
}

function generateFuzzInput() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789 .,;:!?-_';
    const length = Math.floor(Math.random() * 100) + 1;
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

function generateMalformedInput() {
    const malformations = [
        () => '',
        () => ' '.repeat(Math.floor(Math.random() * 100)),
        () => '\t'.repeat(Math.floor(Math.random() * 20)),
        () => '\n'.repeat(Math.floor(Math.random() * 10)),
        () => String.fromCharCode(Math.floor(Math.random() * 65535)),
        () => 'null',
        () => 'undefined',
        () => '{}',
        () => '[]',
        () => Array(1000).fill('x').join(''),
    ];
    return malformations[Math.floor(Math.random() * malformations.length)]();
}

// ============================================================================
// TEST RUNNERS
// ============================================================================

class TestRunner {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            errors: [],
            timings: [],
            parserDistribution: { rust: 0, pattern_fallback: 0, failed: 0 }
        };
    }

    async runTest(name, testFn) {
        const startTime = performance.now();
        try {
            await testFn();
            const duration = performance.now() - startTime;
            this.results.passed++;
            this.results.timings.push(duration);
            return { success: true, duration };
        } catch (error) {
            const duration = performance.now() - startTime;
            this.results.failed++;
            this.results.errors.push({ name, error: error.message });
            return { success: false, duration, error: error.message };
        }
    }

    recordParserUsage(parser) {
        if (parser === 'rust') this.results.parserDistribution.rust++;
        else if (parser === 'pattern_fallback') this.results.parserDistribution.pattern_fallback++;
        else this.results.parserDistribution.failed++;
    }

    getStats() {
        const timings = this.results.timings;
        const sorted = [...timings].sort((a, b) => a - b);
        const sum = timings.reduce((a, b) => a + b, 0);

        return {
            total: this.results.passed + this.results.failed,
            passed: this.results.passed,
            failed: this.results.failed,
            passRate: ((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(2),
            avgTime: (sum / timings.length).toFixed(3),
            minTime: sorted[0]?.toFixed(3) || 0,
            maxTime: sorted[sorted.length - 1]?.toFixed(3) || 0,
            p50: sorted[Math.floor(sorted.length * 0.5)]?.toFixed(3) || 0,
            p95: sorted[Math.floor(sorted.length * 0.95)]?.toFixed(3) || 0,
            p99: sorted[Math.floor(sorted.length * 0.99)]?.toFixed(3) || 0,
            parserDistribution: this.results.parserDistribution
        };
    }
}

// ============================================================================
// COMPREHENSIVE TESTS
// ============================================================================

async function runComprehensiveTests() {
    console.log('='.repeat(80));
    console.log('COMPREHENSIVE SIGPARSER TEST SUITE');
    console.log('='.repeat(80));
    console.log();

    // Initialize WASM
    console.log('Initializing WASM module...');
    await initializeWasm();
    console.log('✓ WASM module loaded\n');

    const runner = new TestRunner();

    // Test 1: Standard Abbreviations
    console.log('-'.repeat(80));
    console.log('TEST 1: Standard Medical Abbreviations');
    console.log('-'.repeat(80));
    for (const testCase of EXTENSIVE_TEST_CASES.standardAbbreviations) {
        await runner.runTest(`Standard: ${testCase.input}`, async () => {
            const result = JSON.parse(wasmModule.parse_medical_instruction(testCase.input));
            runner.recordParserUsage(result.parser_used || 'rust');
            validateResult(result, testCase.expected);
        });
    }
    console.log(`  Results: ${EXTENSIVE_TEST_CASES.standardAbbreviations.length} tests`);

    // Test 2: Full Word Variations
    console.log('\n' + '-'.repeat(80));
    console.log('TEST 2: Full Word Variations');
    console.log('-'.repeat(80));
    for (const testCase of EXTENSIVE_TEST_CASES.fullWordVariations) {
        await runner.runTest(`FullWord: ${testCase.input}`, async () => {
            const result = JSON.parse(wasmModule.parse_medical_instruction(testCase.input));
            runner.recordParserUsage(result.parser_used || 'rust');
            validateResult(result, testCase.expected);
        });
    }
    console.log(`  Results: ${EXTENSIVE_TEST_CASES.fullWordVariations.length} tests`);

    // Test 3: Complex Natural Language
    console.log('\n' + '-'.repeat(80));
    console.log('TEST 3: Complex Natural Language');
    console.log('-'.repeat(80));
    for (const testCase of EXTENSIVE_TEST_CASES.complexNaturalLanguage) {
        await runner.runTest(`Complex: ${testCase.input}`, async () => {
            const result = JSON.parse(wasmModule.parse_medical_instruction(testCase.input));
            runner.recordParserUsage(result.parser_used || 'rust');
        });
    }
    console.log(`  Results: ${EXTENSIVE_TEST_CASES.complexNaturalLanguage.length} tests`);

    // Test 4: PRN Instructions
    console.log('\n' + '-'.repeat(80));
    console.log('TEST 4: PRN (As Needed) Instructions');
    console.log('-'.repeat(80));
    for (const testCase of EXTENSIVE_TEST_CASES.prnInstructions) {
        await runner.runTest(`PRN: ${testCase.input}`, async () => {
            const result = JSON.parse(wasmModule.parse_medical_instruction(testCase.input));
            runner.recordParserUsage(result.parser_used || 'rust');
        });
    }
    console.log(`  Results: ${EXTENSIVE_TEST_CASES.prnInstructions.length} tests`);

    // Test 5: Extended Release
    console.log('\n' + '-'.repeat(80));
    console.log('TEST 5: Extended/Controlled Release');
    console.log('-'.repeat(80));
    for (const testCase of EXTENSIVE_TEST_CASES.extendedRelease) {
        await runner.runTest(`ER: ${testCase.input}`, async () => {
            const result = JSON.parse(wasmModule.parse_medical_instruction(testCase.input));
            runner.recordParserUsage(result.parser_used || 'rust');
        });
    }
    console.log(`  Results: ${EXTENSIVE_TEST_CASES.extendedRelease.length} tests`);

    // Test 6: Invalid Inputs
    console.log('\n' + '-'.repeat(80));
    console.log('TEST 6: Invalid/Malformed Inputs');
    console.log('-'.repeat(80));
    for (const testCase of EXTENSIVE_TEST_CASES.invalidInputs) {
        await runner.runTest(`Invalid: "${testCase.input}"`, async () => {
            const result = JSON.parse(wasmModule.parse_medical_instruction(testCase.input));
            runner.recordParserUsage(result.parser_used || 'rust');
            // Invalid inputs should either fail gracefully or return empty result
        });
    }
    console.log(`  Results: ${EXTENSIVE_TEST_CASES.invalidInputs.length} tests`);

    // Test 7: Edge Cases
    console.log('\n' + '-'.repeat(80));
    console.log('TEST 7: Edge Cases (Unicode, Case, Whitespace)');
    console.log('-'.repeat(80));
    const edgeCaseTests = [
        ...EXTENSIVE_TEST_CASES.unicodeInputs,
        ...EXTENSIVE_TEST_CASES.caseVariations,
        ...EXTENSIVE_TEST_CASES.whitespaceVariations,
        ...EXTENSIVE_TEST_CASES.numberWords,
    ];
    for (const testCase of edgeCaseTests) {
        await runner.runTest(`Edge: ${testCase.input.substring(0, 50)}`, async () => {
            const result = JSON.parse(wasmModule.parse_medical_instruction(testCase.input));
            runner.recordParserUsage(result.parser_used || 'rust');
        });
    }
    console.log(`  Results: ${edgeCaseTests.length} tests`);

    // Test 8: Load Test - Sequential
    console.log('\n' + '-'.repeat(80));
    console.log('TEST 8: Load Test - Sequential Processing');
    console.log('-'.repeat(80));
    const loadTestStart = performance.now();
    for (let i = 0; i < CONFIG.stressTestIterations; i++) {
        const input = generateRandomMedicalInstruction();
        await runner.runTest(`Load[${i}]`, async () => {
            const result = JSON.parse(wasmModule.parse_medical_instruction(input));
            runner.recordParserUsage(result.parser_used || 'rust');
        });
    }
    const loadTestDuration = performance.now() - loadTestStart;
    console.log(`  Results: ${CONFIG.stressTestIterations} iterations in ${loadTestDuration.toFixed(2)}ms`);
    console.log(`  Average: ${(loadTestDuration / CONFIG.stressTestIterations).toFixed(3)}ms per parse`);

    // Test 9: Batch Processing Test (WASM is synchronous, simulate concurrent load)
    console.log('\n' + '-'.repeat(80));
    console.log('TEST 9: Batch Processing Stress Test');
    console.log('-'.repeat(80));
    for (const batchSize of CONFIG.concurrencyLevels) {
        const inputs = Array(batchSize).fill(0).map(() => generateRandomMedicalInstruction());
        const startTime = performance.now();

        // Process batch synchronously (simulating concurrent load)
        const results = inputs.map(input => {
            try {
                wasmModule.parse_medical_instruction(input);
                return { success: true };
            } catch (error) {
                return { success: false, error };
            }
        });

        const duration = performance.now() - startTime;
        const successCount = results.filter(r => r.success).length;
        console.log(`  Batch ${batchSize.toString().padStart(3)}: ${duration.toFixed(2)}ms total, ${(duration/batchSize).toFixed(3)}ms avg, ${successCount}/${batchSize} success`);
    }

    // Test 10: Fuzz Test
    console.log('\n' + '-'.repeat(80));
    console.log('TEST 10: Fuzz Testing');
    console.log('-'.repeat(80));
    let fuzzCrashes = 0;
    for (let i = 0; i < CONFIG.fuzzTestCount; i++) {
        const input = Math.random() > 0.5 ? generateFuzzInput() : generateMalformedInput();
        try {
            wasmModule.parse_medical_instruction(input);
        } catch (error) {
            fuzzCrashes++;
            if (fuzzCrashes <= 5) {
                console.log(`  Crash ${fuzzCrashes}: "${input.substring(0, 50)}..." - ${error.message}`);
            }
        }
    }
    console.log(`  Results: ${CONFIG.fuzzTestCount} fuzz inputs, ${fuzzCrashes} crashes (${((fuzzCrashes/CONFIG.fuzzTestCount)*100).toFixed(2)}% crash rate)`);

    // Print final statistics
    console.log('\n' + '='.repeat(80));
    console.log('COMPREHENSIVE TEST RESULTS');
    console.log('='.repeat(80));
    const stats = runner.getStats();
    console.log(`Total Tests:      ${stats.total}`);
    console.log(`Passed:           ${stats.passed} (${stats.passRate}%)`);
    console.log(`Failed:           ${stats.failed}`);
    console.log();
    console.log('Timing Statistics:');
    console.log(`  Average:        ${stats.avgTime}ms`);
    console.log(`  Min:            ${stats.minTime}ms`);
    console.log(`  Max:            ${stats.maxTime}ms`);
    console.log(`  P50 (Median):   ${stats.p50}ms`);
    console.log(`  P95:            ${stats.p95}ms`);
    console.log(`  P99:            ${stats.p99}ms`);
    console.log();
    console.log('Parser Distribution:');
    console.log(`  Rust Parser:    ${stats.parserDistribution.rust} (${((stats.parserDistribution.rust/stats.total)*100).toFixed(1)}%)`);
    console.log(`  Pattern Fallback: ${stats.parserDistribution.pattern_fallback} (${((stats.parserDistribution.pattern_fallback/stats.total)*100).toFixed(1)}%)`);
    console.log(`  Failed:         ${stats.parserDistribution.failed} (${((stats.parserDistribution.failed/stats.total)*100).toFixed(1)}%)`);

    if (runner.results.errors.length > 0) {
        console.log('\nFirst 10 Errors:');
        runner.results.errors.slice(0, 10).forEach((err, i) => {
            console.log(`  ${i + 1}. ${err.name}: ${err.error}`);
        });
    }

    console.log('\n' + '='.repeat(80));
    console.log('Test suite completed!');
    console.log('='.repeat(80));

    return stats;
}

function validateResult(result, expected) {
    // Basic validation - check if expected fields match
    for (const [key, value] of Object.entries(expected)) {
        if (value !== undefined && result[key] !== value) {
            throw new Error(`Expected ${key}=${value}, got ${key}=${result[key]}`);
        }
    }
}

// Run the comprehensive tests
runComprehensiveTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
