const wasm = require('./pkg/medical_data_normalizer.js');

console.log('=== Input Validation Tests ===\n');

// Test 1: Valid input
console.log('Test 1 - Valid input:');
const r1 = JSON.parse(wasm.parse_medical_instruction('Take 1 tab po qd'));
console.log('  Success:', r1.success, '| Qty:', r1.quantity, '| Errors:', r1.validation.errors.length);

// Test 2: Empty input
console.log('\nTest 2 - Empty input:');
const r2 = JSON.parse(wasm.parse_medical_instruction(''));
console.log('  Success:', r2.success, '| Error:', r2.error);

// Test 3: Negative quantity
console.log('\nTest 3 - Negative quantity:');
const r3 = JSON.parse(wasm.parse_medical_instruction('-5 tab po qd'));
console.log('  Success:', r3.success, '| Qty:', r3.quantity, '| Errors:', r3.validation.errors);

// Test 4: Zero quantity
console.log('\nTest 4 - Zero quantity:');
const r4 = JSON.parse(wasm.parse_medical_instruction('0 tab po qd'));
console.log('  Success:', r4.success, '| Qty:', r4.quantity, '| Errors:', r4.validation.errors);

// Test 5: SQL injection
console.log('\nTest 5 - SQL injection:');
const r5 = JSON.parse(wasm.parse_medical_instruction("1 tab'; DROP TABLE meds; -- po qd"));
console.log('  Success:', r5.success, '| Error:', r5.error ? 'Yes' : 'No');

// Test 6: XSS attempt
console.log('\nTest 6 - XSS attempt:');
const r6 = JSON.parse(wasm.parse_medical_instruction('<script>alert(1)</script>'));
console.log('  Success:', r6.success, '| Error:', r6.error ? 'Yes' : 'No');

// Test 7: Very large input
console.log('\nTest 7 - Very large input (15K chars):');
const largeInput = 'Take 1 tab po qd ' + 'x'.repeat(15000);
const r7 = JSON.parse(wasm.parse_medical_instruction(largeInput));
console.log('  Success:', r7.success, '| Error:', r7.error);

console.log('\n=== All validation tests completed ===');
