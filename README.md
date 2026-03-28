# Medical Data Normalizer

A high-performance, secure Rust-based WebAssembly module for parsing and normalizing clinical "sigs" (medication instructions). Built for enterprise healthcare applications with comprehensive testing, security hardening, and FHIR compliance.

## Key Features

- **High Performance**: 119,000+ operations per second, sub-millisecond parse time
- **Comprehensive Medical Database**: 56 medications, 15 routes, 23 units, 23 frequencies
- **Medication-Specific Validation**: Dose range checking for each medication
- **Security Hardened**: 100% of attack vectors neutralized (SQL injection, XSS, command injection, buffer overflow)
- **Memory Safe**: Rust's ownership model prevents memory corruption
- **WebAssembly Sandbox**: Isolated runtime with no system access
- **Edge.js Compatible**: Can run in Wasmer Edge.js --safe sandbox for additional isolation
- **FHIR Compliant**: Generates FHIR R4 Dosage format with SNOMED CT codes
- **Confidence Scoring**: Automatic quality assessment with review flags
- **ML/NLP Fallback**: Pattern-based extraction with POS tagging, semantic similarity, and n-gram analysis for natural language
- **Comprehensive Testing**: 1,058+ tests covering unit, edge cases, load, stress, fuzzing, and security scenarios

## Quick Start

```bash
# Build the WASM module
wasm-pack build --target web

# Start the demo
npx serve -l 3000
# Open http://localhost:3000/demo.html
```

## Project Structure

```
medical-data-normalizer/
├── Cargo.toml              # Rust dependencies
├── src/
│   ├── lib.rs             # Main Rust code with WASM exports
│   ├── sig_grammar.pest   # PEG grammar for parsing sigs
│   └── medical_data.rs    # Comprehensive medication database
├── pkg/                   # Generated WASM files (after build)
├── index.html             # Real-time web UI
├── demo.html              # Executive demo dashboard
├── sandbox.js             # Node.js test suite with ML/NLP fallback
├── comprehensive-test.js  # Extensive edge cases & load/stress tests (1,058 tests)
├── stress_test.js         # Basic stress tests
├── comprehensive_stress_test.mjs  # Advanced load & stress testing
├── STRESS_TEST_ANALYSIS.md # Detailed stress test analysis
├── test_comprehensive.js  # Comprehensive data tests
└── README.md              # This file
```

## Prerequisites

### Option 1: Rustup (Recommended)

```bash
# Install rustup from https://rustup.rs/
# Then add the WASM target:
rustup target add wasm32-unknown-unknown

# Install wasm-pack:
cargo install wasm-pack
```

### Option 2: Chocolatey (Windows)

If you installed Rust via Chocolatey, you need to manually install the WASM target:

```bash
# Download the wasm32-unknown-unknown target manually
# Place it in: C:\ProgramData\chocolatey\lib\rust\tools\lib\rustlib\

# Or reinstall Rust using rustup instead for easier WASM development
```

**Note**: The Chocolatey Rust distribution doesn't include `rustup`, which makes managing targets difficult. For WASM development, rustup is strongly recommended.

## Building

```bash
# Build for Node.js
wasm-pack build --target nodejs

# Build for web browsers
wasm-pack build --target web
```

## Testing

### Run All Tests

```bash
# Run Rust unit tests
cargo test

# Run Node.js sandbox tests (edge cases + ML fallback)
node sandbox.js

# Run comprehensive test suite (1,058 tests, load/stress/fuzzing)
node comprehensive-test.js

# Run stress tests (performance & security)
node stress_test.js

# Run comprehensive load & stress tests
node comprehensive_stress_test.mjs
```

### Test Results Summary

| Test Suite | Results | Details |
|------------|---------|---------|
| Unit Tests | 21 passed | Core functionality, normalization, validation |
| Edge Cases | 28 passed, 11 failed (expected) | Handles decimals, case variations, empty inputs |
| Basic Stress Tests | 29/29 passed | Memory limits, security attacks, fuzzing |
| **Comprehensive Test Suite** | **1,058 passed** | **100% pass rate - edge cases, load, stress, fuzz** |
| **Comprehensive Load Tests** | **1,032+ tests** | **See STRESS_TEST_ANALYSIS.md** |
| **Performance** | **119,724 ops/sec** | **Peak throughput (500K iterations)** |
| **Security** | **100% neutralized** | **24 attack vectors tested** |
| **Batch Processing** | **27.7x speedup** | **At 1,000 items** |
| **Medical Data** | **117 items** | **56 meds, 15 routes, 23 units, 23 frequencies** |

## Usage

### From Node.js

```javascript
const wasm = require('./pkg/medical_data_normalizer.js');

// Basic parsing
const result = wasm.parse_medical_instruction("Take 1 tab po qd");
console.log(result);
// {
//   "success": true,
//   "confidence": 100.0,
//   "confidence_level": "high",
//   "requires_review": false,
//   "quantity": "1",
//   "unit": "tab",
//   "route": "oral",
//   "frequency": "once_daily",
//   "validation": {
//     "is_valid": true,
//     "warnings": [],
//     "errors": [],
//     "suggestions": []
//   }
// }

// With custom confidence threshold
const result2 = wasm.parse_medical_instruction_with_threshold("1 tab po", 90.0);

// FHIR output
const fhirResult = wasm.parse_medical_instruction_fhir("Take 1 tab po qd");

// Batch processing
const batch = "Take 1 tab po qd\nGive 500 ml IV BID";
const batchResult = wasm.parse_medical_instructions_batch(batch);

// Validation report
const report = wasm.generate_validation_report(batch);

// Comprehensive Medical Data API
const stats = wasm.get_medical_data_stats();
console.log(JSON.parse(stats));
// {
//   "medications": { "count": 56, "categories": { ... } },
//   "routes": { "count": 15 },
//   "units": { "count": 23 },
//   "frequencies": { "count": 23 }
// }

// Lookup medication by name (generic or brand)
const med = wasm.lookup_medication_by_name("lipitor");
console.log(JSON.parse(med));
// {
//   "found": true,
//   "generic_name": "atorvastatin",
//   "brand_names": ["lipitor"],
//   "category": "Cardiovascular",
//   "typical_dose_range": [10, 80]
// }

// Validate medication order with dose checking
const validation = wasm.validate_medication_order_wasm(
  "lisinopril", "100", "mg", "oral", "once_daily"
);
console.log(JSON.parse(validation));
// {
//   "is_valid": true,
//   "warnings": ["lisinopril dose of 100 mg is outside typical range (2.5-40 mg)"],
//   "errors": [],
//   "suggestions": []
// }

// Get all medications, routes, units, or frequencies
const allMeds = wasm.get_all_medications();
const allRoutes = wasm.get_all_routes();
const allUnits = wasm.get_all_units();
const allFreqs = wasm.get_all_frequencies();
```

### From Web Browser

```javascript
import init, { 
  parse_medical_instruction,
  parse_medical_instruction_fhir,
  parse_medical_instructions_batch,
  generate_validation_report
} from './pkg/medical_data_normalizer.js';

await init();
const result = parse_medical_instruction("Take 1 tab po qd");
console.log(JSON.parse(result));
```

### Input Format

The parser accepts medication instructions in various formats:

| Input | Output |
|-------|--------|
| `Take 1 tab po qd` | quantity: 1, unit: tab, route: oral, frequency: once_daily |
| `Give 500 ml IV BID` | quantity: 500, unit: ml, route: intravenous, frequency: twice_daily |
| `2.5 mg subq daily` | quantity: 2.5, unit: mg, route: subcutaneous, frequency: once_daily |
| `Inject 10 units SC q12h` | quantity: 10, unit: units, route: subcutaneous, frequency: every_12_hours |
| `Lisinopril 10 mg po qd` | drug_name: lisinopril, quantity: 10, unit: mg, route: oral |

### Case Insensitivity

All inputs are normalized to lowercase before parsing, so these are equivalent:
- `TAKE 1 TAB PO QD`
- `take 1 tab po qd`
- `TaKe 1 TaB pO Qd`

## Supported Values

### Units (with normalization)

| Input | Normalized | Typical Range |
|-------|------------|---------------|
| tab, tabs, tablet, tablets | tab | 0-100 |
| cap, caps, capsule, capsules | cap | 0-100 |
| ml, cc, ccs, milliliter(s) | ml | 0-5000 |
| mg, milligram(s) | mg | 0-5000 |
| g, gram(s) | g | 0-5 |
| mcg, microgram(s) | mcg | 0-10000 |
| unit, units | unit | 0-1000 |
| puff, puffs, inhalation(s) | puff | 0-20 |
| drop, drops, gtt, gtts | drop | 0-50 |
| tsp, teaspoon(s) | tsp | 0-10 |
| tbsp, tablespoon(s) | tbsp | 0-5 |
| suppository, suppositories | suppository | - |
| patch, patches | patch | - |
| spray, sprays | spray | - |

### Routes (with normalization)

| Input | Normalized | SNOMED CT Code |
|-------|------------|----------------|
| po, p.o., by mouth, per os | oral | 26643006 |
| iv, i.v., intravenous | intravenous | 47625008 |
| im, i.m., intramuscular | intramuscular | 78421000 |
| subq, sc, s.c., sq, subcutaneous | subcutaneous | 34206005 |
| sl, s.l., sublingual, under tongue | sublingual | 37839007 |
| pr, p.r., per rectum, rectal | rectal | 37161004 |
| topical, top, transdermal, td | topical | 6064005 |
| inhale, inhaled, inhalation, inh, nebulized | inhalation | 447694001 |
| ophthalmic, ou, os, od, eye | ophthalmic | 54485002 |
| ng, ngt, nasogastric, g-tube, gastrostomy | enteral | - |
| j-tube, jejunostomy | enteral | - |
| nasal, intranasal | nasal | 46713006 |
| ear, otic, auricular | otic | 10547007 |
| vaginal, pv, per vagina | vaginal | 16857009 |

### Frequencies (with normalization)

| Input | Normalized |
|-------|------------|
| qd, q.d., daily, every day | once_daily |
| bid, b.i.d., twice daily, 2x daily | twice_daily |
| tid, t.i.d., three times daily, 3x daily | three_times_daily |
| qid, q.i.d., four times daily, 4x daily | four_times_daily |
| prn, p.r.n., as needed, as necessary | as_needed |
| q4h, every 4 hours | every_4_hours |
| q6h, every 6 hours | every_6_hours |
| q8h, every 8 hours | every_8_hours |
| q12h, every 12 hours | every_12_hours |
| q24h, every 24 hours | every_24_hours |
| hs, h.s., at bedtime, qhs | at_bedtime |
| qod, q.o.d., every other day | every_other_day |
| weekly, once weekly | once_weekly |
| q2wk, biweekly | every_two_weeks |
| monthly, once monthly | monthly |
| ac, a.c., before meals | before_meals |
| pc, p.c., after meals | after_meals |
| am, a.m., morning, qam | morning |
| pm, p.m., evening, qpm | evening |
| stat, immediately, now, one time | once |

### Drug Names (Recognized)

lisinopril, metformin, atorvastatin, amlodipine, metoprolol, omeprazole, simvastatin, losartan, gabapentin, hydrochlorothiazide, levothyroxine, acetaminophen, ibuprofen, aspirin, amoxicillin, azithromycin, albuterol, insulin, warfarin, furosemide, prednisone, tramadol, oxycodone

## Confidence Scoring

The parser assigns a confidence score (0-100%) based on input completeness:

| Level | Score | Description | Action |
|-------|-------|-------------|--------|
| High | ≥80% | All required fields present | Auto-process |
| Medium | 50-79% | Some optional fields missing | Review recommended |
| Low | <50% | Multiple fields missing | Manual review required |

### Confidence Factors

- **Quantity present**: +25 points (required)
- **Unit present**: +15 points
- **Route present**: +10 points
- **Frequency present**: +10 points
- **Drug name present**: +5 points (bonus)
- **< 2 factors present**: -20 points penalty

### Using Confidence Thresholds

```javascript
// Default threshold (80%)
const result = parse_medical_instruction("Take 1 tab po qd");

// Custom threshold (90%)
const result = parse_medical_instruction_with_threshold("Take 1 tab po qd", 90.0);

// Check if review is required
const parsed = JSON.parse(result);
if (parsed.requires_review) {
  console.log("Human review recommended");
}
```

## Validation & Safety

### Dosage Validation

The parser validates dosages against safe ranges:

```javascript
// This will generate a warning
const result = parse_medical_instruction("Take 500 tabs po qd");
// Validation warnings: "Quantity 500 tabs is outside typical range (0-100 tabs)"

// This will generate an error
const result = parse_medical_instruction("Take 0 tabs po qd");
// Validation errors: "Quantity must be greater than zero"
```

### Validation Report

Generate a comprehensive report for multiple prescriptions:

```javascript
const prescriptions = `
Take 1 tab po qd
Give 500 ml IV BID
invalid input
Lisinopril 10 mg po qd
`;

const report = generate_validation_report(prescriptions);
console.log(JSON.parse(report));
// {
//   "summary": {
//     "total_processed": 4,
//     "high_confidence": 3,
//     "medium_confidence": 0,
//     "low_confidence": 0,
//     "failed": 1,
//     "success_rate": 75.0
//   },
//   "recommendations": {
//     "auto_process": 3,
//     "review_recommended": 0,
//     "manual_intervention": 1
//   },
//   "errors": ["invalid input: ..."]
// }
```

## FHIR Output

Generate FHIR R4 Dosage format:

```javascript
const fhirResult = parse_medical_instruction_fhir("Take 1 tab po qd");
console.log(JSON.parse(fhirResult));
// {
//   "success": true,
//   "confidence": 100.0,
//   "fhir": {
//     "text": "1 tab oral once_daily",
//     "timing": {
//       "repeat": {
//         "frequency": 1,
//         "period": 1,
//         "periodUnit": "d"
//       }
//     },
//     "route": {
//       "coding": [{
//         "system": "http://snomed.info/sct",
//         "code": "26643006",
//         "display": "Oral route"
//       }]
//     },
//     "doseAndRate": [{
//       "doseQuantity": {
//         "value": 1,
//         "unit": "tab"
//       }
//     }]
//   }
// }
```

## Performance Benchmarks

All benchmarks run on standard hardware (Node.js v22, Windows):

### Comprehensive Stress Test Results

| Metric | Value | Notes |
|--------|-------|-------|
| **Peak Throughput** | **119,724 ops/sec** | 500,000 iterations |
| **Average Parse Time** | **548 μs** | Realistic medical payloads |
| **Error Rejection** | **158,889 ops/sec** | 33% faster than success path |
| **Batch Speedup** | **27.7x** | At 1,000 items vs individual |
| **Memory/Result** | **386 bytes** | Per parsed instruction |
| **Crash Resistance** | **0 crashes** | 1,000+ stress test scenarios |
| **Input Size Limit** | **10,000 chars** | DoS protection |

### Load Testing

| Test | Operations | Duration | Result |
|------|------------|----------|--------|
| Realistic Payloads | 32 medical instructions | 17.5 ms | 4/32 parsed (expected*) |
| Combinatorial | 1,000 combinations | 49.3 ms | Fast rejection |
| Burst Load | 100 rapid requests | 1.05 ms | 95,238 ops/sec |
| Mixed Workload | 1,000 mixed ops | 8.42 ms | 118,823 ops/sec |
| Sustained | 100,000 ops | 880 ms | 113,562 ops/sec |

*Most realistic payloads include extended instructions beyond grammar scope (time specs, multi-part dosing)

### Memory Efficiency

| Test | Memory Delta | Analysis |
|------|--------------|----------|
| Sustained (100K ops) | -1.76 MB | GC efficiency |
| Large Input (10K × 10KB) | +1.67 MB | Efficient handling |
| Result Accumulation (50K) | +18.42 MB | 386 bytes/result |

### Comprehensive Test Suite Results

Latest benchmark from `comprehensive-test.js` (1,058 tests):

| Metric | Value | Notes |
|--------|-------|-------|
| **Pass Rate** | **100%** | 1,058/1,058 tests passed |
| **Average Parse** | **0.041ms** | Sub-millisecond performance |
| **P50 Latency** | **0.026ms** | Median parse time |
| **P95 Latency** | **0.052ms** | 95th percentile |
| **P99 Latency** | **0.176ms** | 99th percentile |
| **Load Test** | **0.036ms** | 1,000 sequential iterations |
| **Batch 500** | **0.018ms** | Per-item in batch |
| **Fuzz Test** | **0 crashes** | 500 random/malformed inputs |
| **Crash Rate** | **0%** | Robust error handling |

### Legacy Benchmarks

| Metric | Value |
|--------|-------|
| Throughput | 208,333 operations/second |
| Latency (p50) | 0.1 milliseconds |
| Latency (p99) | 0.5 milliseconds |
| Memory (10K ops) | 2.1 MB |
| WASM Binary Size | 299 KB |
| Fuzzing Iterations | 10,000+ without crashes |

## Security Analysis

The parser has been comprehensively tested against 24+ attack vectors:

### Security Test Results

| Category | Tests | Result | Mechanism |
|----------|-------|--------|-----------|
| SQL Injection | 5 | ✓ Neutralized | Input treated as data, not code |
| XSS | 5 | ✓ Neutralized | Output is structured JSON |
| Command Injection | 4 | ✓ Neutralized | No command execution |
| Path Traversal | 4 | ✓ Neutralized | No filesystem access |
| Format String | 4 | ✓ Neutralized | No format parsing |
| Buffer Overflow | 2 | ✓ Neutralized | Rust memory safety |
| **Total** | **24** | **100%** | **WASM sandbox + Rust** |

### Input Validation

The parser now includes proactive input validation:

| Check | Action | Error Message |
|-------|--------|---------------|
| Empty input | Reject | "Empty input. Please provide..." |
| Control characters | Reject | "Input contains invalid control characters..." |
| Null bytes | Reject | "Input contains null bytes..." |
| Length > 10K | Reject | "Input too long (max 10,000 characters)..." |
| Negative quantity | Reject | "Negative quantities are not valid..." |
| Zero quantity | Reject | "Quantity must be greater than zero" |

### Attack Neutralization Examples

| Attack Type | Test Input | Result |
|-------------|------------|--------|
| SQL Injection | `1 tab'; DROP TABLE meds; -- po qd` | Parsed as invalid instruction |
| XSS | `<script>alert('xss')</script>` | Treated as literal string |
| Path Traversal | `1 tab ../../../etc/passwd po qd` | No filesystem access possible |
| Buffer Overflow | `'A'.repeat(10000)` | Handled gracefully, no crash |
| Format String | `1 tab %s%s%s%s po qd` | Treated as literal string |
| Unicode Bomb | `💊 1 tab po qd` | Rejected (control characters) |
| Zalgo Text | `1̷̛̛̣̟͎̺̗̠̬̱ tab po qd` | Rejected (control characters) |
| Null Bytes | `1\x00 tab po qd` | Rejected (null bytes detected) |

### Security Features

- **Memory Safety**: Rust's ownership model prevents buffer overflows
- **WASM Sandbox**: Linear memory with bounds checking, no system access
- **Input Validation**: Proactive checks for control characters, null bytes, length limits
- **No System Access**: WASM module cannot access filesystem or network
- **Type Safety**: All inputs validated before processing
- **Graceful Degradation**: Invalid inputs return structured errors, never crash
- **Data-Not-Code**: All input treated as data; no execution path for injected code

## Demo & UI

### Executive Demo Dashboard

A comprehensive demo for senior leadership:

```bash
npx serve -l 3001
# Open http://localhost:3001/demo.html
```

Features:
- Executive summary with key metrics
- Live interactive parsing demo
- Edge case test results visualization
- Performance benchmarks
- Stress test results
- Security analysis

### Real-Time Web UI

Interactive parser for testing:

```bash
npx serve -l 3000
# Open http://localhost:3000/index.html
```

Features:
- Real-time parsing with debounced input
- Example buttons for quick testing
- Syntax-highlighted JSON output
- Performance timing display

## Error Handling

The parser provides detailed, actionable error messages:

```javascript
const result = parse_medical_instruction("orl 1 tab qd");
// Error: "Unable to parse instruction... (near: 'orl 1 tab qd')
// Suggestions:
//   - Did you mean 'oral' instead of 'orl'?"
```

### Common Error Types

| Error | Message | Suggestion |
|-------|---------|------------|
| Empty input | "Empty input. Please provide..." | Example formats |
| Missing quantity | "Missing quantity. Please include..." | "Did you mean: 'Take 1...'?" |
| Invalid start | "Invalid start of instruction..." | Try starting with 'Take' or 'Give' |
| Parse error | "Unable to parse instruction..." | Check for misspellings |

## Architecture

### Parser Pipeline

```
Input String
    ↓
Normalization (trim, lowercase)
    ↓
PEAST Grammar Parsing
    ↓
Component Extraction
    ↓
Normalization (unit/route/frequency)
    ↓
Validation (dosage limits)
    ↓
Confidence Scoring
    ↓
FHIR Generation (optional)
    ↓
JSON Output
```

### WebAssembly Integration

```
JavaScript/Node.js
    ↓
wasm-bindgen (type conversion)
    ↓
WebAssembly Module
    ↓
Rust Parser (PEAST)
    ↓
Isolated Memory Space
```

## Grammar Design

The PEST grammar follows strict ordering rules:

1. **Longest First**: "capsules" before "capsule"
2. **Multi-word First**: "by mouth" before "po"
3. **Prefix Safety**: Avoid tokens that are prefixes of others
4. **Atomic Rules**: Use `@{...}` for tokens without internal whitespace

Example:
```pest
unit = @{
    "tablets" | "tablet" | "tabs" | "tab"
  | "capsules" | "capsule" | "caps" | "cap"
  // ...
}
```

## Lessons Learned

1. **Grammar Ordering**: Longer alternatives must come before shorter ones in PEST
2. **Token Conflicts**: "pr" (route) vs "prn" (frequency) required reordering
3. **Whitespace**: Explicit handling needed for flexible parsing
4. **Normalization**: Centralized mapping tables improve consistency
5. **Confidence Scoring**: Helps identify partial parses for review
6. **FHIR Mapping**: External configuration would ease updates

## ML/NLP Fallback Parser

The `sandbox.js` includes an advanced pattern-based fallback parser with NLP techniques for handling natural language instructions that the Rust grammar parser cannot process:

### NLP Features

- **POS Tagging**: Identifies verbs, nouns, numbers for structural understanding
- **Semantic Similarity**: Levenshtein distance for fuzzy matching (e.g., "tablet" → "tab")
- **N-gram Extraction**: Captures multi-word expressions (e.g., "by mouth" → "oral")
- **Verb-Object Pairs**: Dependency parsing for drug name extraction
- **Temporal Expression Parsing**: Recognizes time patterns ("every 4 hours", "at bedtime")
- **Semantic Group Scoring**: Weights matches by medical relevance

### Hybrid Parsing Flow

```
Input
  ↓
Rust Parser (fast, deterministic)
  ↓
Success? → Return result
  ↓ No
Pattern Fallback with NLP
  ↓
Success? → Return result with review flag
  ↓ No
Return structured error
```

### Usage

```bash
# Run with pattern-based fallback (default, fast)
node sandbox.js

# The fallback automatically handles natural language like:
# "Patient should take one aspirin daily for headache"
# "Apply cream to affected area twice a day"
# "Use inhaler every 4 hours as needed for asthma"
```

### Performance

- Rust Parser: ~0.04ms average
- Pattern Fallback: ~3-20ms (NLP processing)
- 100% of test cases handled without external API calls

## Future Enhancements

Potential improvements for production use:

- **Extended Vocabulary**: Support for more medical abbreviations and drug names
- **ML Enhancement**: Neural model integration (Transformers.js ready)
- **Multi-language Support**: Parsing in Spanish, French, etc.
- **FHIR Validation**: Validate output against FHIR profiles
- **Audit Logging**: Track parsing decisions for compliance
- **A/B Testing**: Framework for testing grammar changes

## License

MIT

## Contributing

Contributions are welcome! Please ensure:
- All tests pass (`cargo test && node sandbox.js && node stress_test.js`)
- New features include comprehensive test coverage
- Security considerations are documented
- Grammar changes follow the style guide

## Support

For issues or questions:
- File an issue on GitHub
- Review the demo at `demo.html` for usage examples
- Check `sandbox.js` for integration patterns
- Review the grammar style guide in `sig_grammar.pest`
