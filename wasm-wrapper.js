import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let _wasmModule = null;
let _initPromise = null;

async function loadWasm() {
  if (_wasmModule) return _wasmModule;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    _wasmModule = await import('./pkg/medical_data_normalizer.js');
    return _wasmModule;
  })();

  return _initPromise;
}

function ensureLoaded(wasm) {
  if (!wasm) {
    throw new Error('WASM module not initialized. Call init() first.');
  }
}

function parseJsonResponse(raw) {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return { success: false, error: 'Invalid JSON response from WASM parser' };
    }
  }
  return raw;
}

export async function init() {
  return loadWasm();
}

export async function parseSingle(input, wasm) {
  const mod = wasm || (await loadWasm());
  ensureLoaded(mod);
  return parseJsonResponse(mod.parse_medical_instruction(input));
}

export async function parseWithThreshold(input, threshold, wasm) {
  const mod = wasm || (await loadWasm());
  ensureLoaded(mod);
  return parseJsonResponse(mod.parse_medical_instruction_with_threshold(input, threshold));
}

export async function parseFhir(input, wasm) {
  const mod = wasm || (await loadWasm());
  ensureLoaded(mod);
  return parseJsonResponse(mod.parse_medical_instruction_fhir(input));
}

export async function parseBatch(inputs, wasm) {
  const mod = wasm || (await loadWasm());
  ensureLoaded(mod);

  const inputStr = Array.isArray(inputs) ? inputs.join('\n') : inputs;
  return parseJsonResponse(mod.parse_medical_instructions_batch(inputStr));
}

export async function validateOrder(medication, quantity, unit, route, frequency, wasm) {
  const mod = wasm || (await loadWasm());
  ensureLoaded(mod);
  return parseJsonResponse(
    mod.validate_medication_order_wasm(medication, String(quantity), unit, route, frequency)
  );
}

export async function getMedications(wasm) {
  const mod = wasm || (await loadWasm());
  ensureLoaded(mod);
  return parseJsonResponse(mod.get_all_medications());
}

export async function lookupMedication(name, wasm) {
  const mod = wasm || (await loadWasm());
  ensureLoaded(mod);
  return parseJsonResponse(mod.lookup_medication_by_name(name));
}

export async function getRoutes(wasm) {
  const mod = wasm || (await loadWasm());
  ensureLoaded(mod);
  return parseJsonResponse(mod.get_all_routes());
}

export async function getUnits(wasm) {
  const mod = wasm || (await loadWasm());
  ensureLoaded(mod);
  return parseJsonResponse(mod.get_all_units());
}

export async function getFrequencies(wasm) {
  const mod = wasm || (await loadWasm());
  ensureLoaded(mod);
  return parseJsonResponse(mod.get_all_frequencies());
}

export async function getStats(wasm) {
  const mod = wasm || (await loadWasm());
  ensureLoaded(mod);
  return parseJsonResponse(mod.get_medical_data_stats());
}

export async function generateReport(inputs, wasm) {
  const mod = wasm || (await loadWasm());
  ensureLoaded(mod);
  return parseJsonResponse(mod.generate_validation_report(inputs));
}

export function getWasmModule() {
  return _wasmModule;
}
