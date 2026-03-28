const wasm = require('./pkg/medical_data_normalizer.js');

console.log('=== Comprehensive Medical Data Tests ===\n');

// Test 1: Get medical data statistics
console.log('Test 1 - Medical Data Statistics:');
const stats = JSON.parse(wasm.get_medical_data_stats());
console.log('  Medications:', stats.medications.count);
console.log('  Categories:', JSON.stringify(stats.medications.categories, null, 2));
console.log('  Routes:', stats.routes.count);
console.log('  Units:', stats.units.count);
console.log('  Frequencies:', stats.frequencies.count);

// Test 2: Lookup medication by generic name
console.log('\nTest 2 - Lookup Lisinopril:');
const med1 = JSON.parse(wasm.lookup_medication_by_name('lisinopril'));
console.log('  Found:', med1.found);
console.log('  Generic:', med1.generic_name);
console.log('  Brand names:', med1.brand_names);
console.log('  Category:', med1.category);

// Test 3: Lookup medication by brand name
console.log('\nTest 3 - Lookup Lipitor (brand):');
const med2 = JSON.parse(wasm.lookup_medication_by_name('lipitor'));
console.log('  Found:', med2.found);
console.log('  Generic:', med2.generic_name);

// Test 4: Lookup unknown medication
console.log('\nTest 4 - Lookup Unknown Med:');
const med3 = JSON.parse(wasm.lookup_medication_by_name('unknownmed123'));
console.log('  Found:', med3.found);
console.log('  Error:', med3.error);

// Test 5: Validate medication order
console.log('\nTest 5 - Validate Medication Order:');
const validation1 = JSON.parse(wasm.validate_medication_order_wasm(
    'lisinopril', '10', 'mg', 'oral', 'once_daily'
));
console.log('  Valid:', validation1.is_valid);
console.log('  Errors:', validation1.errors);
console.log('  Warnings:', validation1.warnings);

// Test 6: Validate with dose outside range
console.log('\nTest 6 - Validate High Dose:');
const validation2 = JSON.parse(wasm.validate_medication_order_wasm(
    'lisinopril', '100', 'mg', 'oral', 'once_daily'
));
console.log('  Valid:', validation2.is_valid);
console.log('  Warnings:', validation2.warnings);

// Test 7: Parse with medication recognition
console.log('\nTest 7 - Parse with Drug Name:');
const result1 = JSON.parse(wasm.parse_medical_instruction('Lisinopril 10 mg po qd'));
console.log('  Success:', result1.success);
console.log('  Drug:', result1.drug_name);
console.log('  Qty:', result1.quantity);
console.log('  Validation warnings:', result1.validation.warnings);

// Test 8: Parse with comprehensive validation
console.log('\nTest 8 - Parse Metformin:');
const result2 = JSON.parse(wasm.parse_medical_instruction('Metformin 500 mg po bid'));
console.log('  Success:', result2.success);
console.log('  Drug:', result2.drug_name);
console.log('  Suggestions:', result2.validation.suggestions);

// Test 9: Get all routes
console.log('\nTest 9 - Get All Routes (sample):');
const routes = JSON.parse(wasm.get_all_routes());
console.log('  Count:', routes.count);
console.log('  Sample:', routes.routes.slice(0, 3).map(r => r.canonical));

// Test 10: Get all units
console.log('\nTest 10 - Get All Units (sample):');
const units = JSON.parse(wasm.get_all_units());
console.log('  Count:', units.count);
console.log('  Sample:', units.units.slice(0, 3).map(u => u.canonical));

// Test 11: Get all frequencies
console.log('\nTest 11 - Get All Frequencies (sample):');
const freqs = JSON.parse(wasm.get_all_frequencies());
console.log('  Count:', freqs.count);
console.log('  Sample:', freqs.frequencies.slice(0, 3).map(f => f.canonical));

console.log('\n=== All comprehensive tests completed ===');
