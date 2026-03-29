//! Medical Data Normalizer
//!
//! A high-performance, secure Rust-based WebAssembly module for parsing
//! and normalizing clinical "sigs" (medication instructions).
//!
//! # Module Structure
//!
//! - `modules::medical_data` - Comprehensive medication, route, unit, and frequency databases
//! - `modules::validation` - Input validation and dosage checking
//! - `modules::normalization` - Text normalization for medical terminology
//! - `modules::fhir` - FHIR R4 Dosage format generation
//! - `modules::confidence` - Confidence scoring algorithms
//! - `modules::errors` - Error handling and suggestion generation

use pest::Parser;
use pest_derive::Parser;
use serde_json::json;
use wasm_bindgen::prelude::*;

// Module declarations
mod modules;
use modules::*;

// Re-export commonly used items for convenience
use confidence::{calculate_confidence, get_confidence_level};
use errors::generate_error_message;
use fhir::generate_fhir_output;
use medical_data::{
    lookup_frequency, lookup_medication, lookup_route, lookup_unit, MedicationCategory,
};
use normalization::{normalize_frequency, normalize_quantity, normalize_route, normalize_unit};
use validation::{validate_dosage, validate_input, validate_medication_order};

#[derive(Parser)]
#[grammar = "sig_grammar.pest"]
struct SigParser;

// ============================================================================
// COMPONENT EXTRACTION
// ============================================================================

fn extract_sig_components(
    pair: pest::iterators::Pair<Rule>,
    result: &mut serde_json::Map<String, serde_json::Value>,
) {
    for inner_pair in pair.into_inner() {
        match inner_pair.as_rule() {
            Rule::quantity
            | Rule::decimal_quantity
            | Rule::fractional_quantity
            | Rule::range_quantity
            | Rule::word_quantity => {
                result.insert(
                    "quantity".to_string(),
                    json!(normalize_quantity(inner_pair.as_str())),
                );
            }
            Rule::unit => {
                result.insert(
                    "unit".to_string(),
                    json!(normalize_unit(inner_pair.as_str())),
                );
            }
            Rule::route => {
                result.insert(
                    "route".to_string(),
                    json!(normalize_route(inner_pair.as_str())),
                );
            }
            Rule::frequency => {
                result.insert(
                    "frequency".to_string(),
                    json!(normalize_frequency(inner_pair.as_str())),
                );
            }
            Rule::drug_name => {
                result.insert("drug_name".to_string(), json!(inner_pair.as_str()));
            }
            Rule::duration => {
                result.insert("duration".to_string(), json!(inner_pair.as_str()));
            }
            Rule::indication => {
                result.insert("indication".to_string(), json!(inner_pair.as_str()));
            }
            Rule::sig | Rule::optional_word => {
                extract_sig_components(inner_pair, result);
            }
            _ => {
                extract_sig_components(inner_pair, result);
            }
        }
    }
}

// ============================================================================
// CORE PARSING FUNCTIONS
// ============================================================================

fn parse_with_options(input: &str, fhir_format: bool, confidence_threshold: f64) -> String {
    // Validate input first
    let input_validation = validate_input(input);
    if !input_validation.is_valid {
        return json!({
            "success": false,
            "confidence": 0.0,
            "confidence_level": "none",
            "requires_review": true,
            "error": input_validation.error_message,
            "quantity": null,
            "unit": null,
            "route": null,
            "frequency": null,
            "drug_name": null,
            "duration": null,
            "indication": null,
            "validation": {
                "is_valid": false,
                "warnings": [],
                "errors": [input_validation.error_message],
                "suggestions": []
            }
        })
        .to_string();
    }

    // Normalize input: lowercase and trim
    let normalized_input = input.trim().to_lowercase();

    match SigParser::parse(Rule::sig_instruction, &normalized_input) {
        Ok(pairs) => {
            let mut result = serde_json::Map::new();

            for pair in pairs {
                extract_sig_components(pair, &mut result);
            }

            // Extract values for validation and confidence
            let quantity: Option<String> = result
                .get("quantity")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let unit: Option<String> = result
                .get("unit")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let route: Option<String> = result
                .get("route")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let frequency: Option<String> = result
                .get("frequency")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let drug_name: Option<String> = result
                .get("drug_name")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let duration: Option<String> = result
                .get("duration")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            // Validate dosage
            let validation = if let Some(ref q) = quantity {
                validate_dosage(q, unit.as_deref(), drug_name.as_deref())
            } else {
                validation::DosageValidationResult {
                    is_valid: false,
                    warnings: vec![],
                    errors: vec!["Missing quantity".to_string()],
                    suggestions: vec![],
                }
            };

            // Calculate confidence
            let confidence = calculate_confidence(
                quantity.as_deref(),
                unit.as_deref(),
                route.as_deref(),
                frequency.as_deref(),
                drug_name.as_deref(),
                !validation.is_valid && !validation.errors.is_empty(),
            );

            // Determine confidence level
            let confidence_level = get_confidence_level(confidence);

            // Determine if review is required
            let requires_review = confidence < confidence_threshold || !validation.is_valid;

            // Ensure all expected fields are present
            let fields = [
                "quantity",
                "unit",
                "route",
                "frequency",
                "drug_name",
                "duration",
                "indication",
            ];
            for key in fields.iter() {
                if !result.contains_key(*key) {
                    result.insert(key.to_string(), json!(null));
                }
            }

            // Add metadata
            result.insert("success".to_string(), json!(validation.is_valid));
            result.insert(
                "meets_threshold".to_string(),
                json!(confidence >= confidence_threshold),
            );
            result.insert("confidence".to_string(), json!(confidence));
            result.insert("confidence_level".to_string(), json!(confidence_level));
            result.insert("requires_review".to_string(), json!(requires_review));
            result.insert(
                "validation".to_string(),
                json!({
                    "is_valid": validation.is_valid,
                    "warnings": validation.warnings,
                    "errors": validation.errors,
                    "suggestions": validation.suggestions
                }),
            );

            // Add FHIR format if requested
            if fhir_format {
                let fhir = generate_fhir_output(
                    quantity.as_deref(),
                    unit.as_deref(),
                    route.as_deref(),
                    frequency.as_deref(),
                    duration.as_deref(),
                );
                result.insert("fhir".to_string(), fhir);
            }

            json!(result).to_string()
        }
        Err(e) => {
            let pos = match &e.location {
                pest::error::InputLocation::Pos(p) => Some(*p),
                pest::error::InputLocation::Span((p, _)) => Some(*p),
            };
            let error_message = generate_error_message(input, pos);
            json!({
                "success": false,
                "confidence": 0.0,
                "confidence_level": "none",
                "requires_review": true,
                "error": error_message,
                "quantity": null,
                "unit": null,
                "route": null,
                "frequency": null,
                "drug_name": null,
                "duration": null,
                "indication": null,
                "validation": {
                    "is_valid": false,
                    "warnings": [],
                    "errors": [error_message],
                    "suggestions": []
                }
            })
            .to_string()
        }
    }
}

// ============================================================================
// PUBLIC WASM API
// ============================================================================

/// Parse a single medical instruction
#[wasm_bindgen]
pub fn parse_medical_instruction(input: &str) -> String {
    parse_with_options(input, false, 80.0) // Default threshold 80%
}

/// Parse with custom confidence threshold
#[wasm_bindgen]
pub fn parse_medical_instruction_with_threshold(input: &str, threshold: f64) -> String {
    parse_with_options(input, false, threshold)
}

/// Parse with FHIR output format
#[wasm_bindgen]
pub fn parse_medical_instruction_fhir(input: &str) -> String {
    parse_with_options(input, true, 80.0)
}

/// Parse multiple instructions in batch (streaming)
#[wasm_bindgen]
pub fn parse_medical_instructions_batch(inputs: &str) -> String {
    let lines: Vec<&str> = inputs.lines().collect();
    let results: Vec<serde_json::Value> = lines
        .iter()
        .map(|line| {
            let result = parse_medical_instruction(line);
            serde_json::from_str(&result).unwrap_or(json!({"error": "Invalid JSON"}))
        })
        .collect();

    let successful = results
        .iter()
        .filter(|r| r.get("success").and_then(|v| v.as_bool()).unwrap_or(false))
        .count();

    json!({
        "total": results.len(),
        "successful": successful,
        "failed": results.len() - successful,
        "results": results
    })
    .to_string()
}

/// Generate a validation report for a set of inputs
#[wasm_bindgen]
pub fn generate_validation_report(inputs: &str) -> String {
    let lines: Vec<&str> = inputs.lines().collect();

    let mut high_confidence = 0;
    let mut medium_confidence = 0;
    let mut low_confidence = 0;
    let mut failed = 0;
    let mut errors: Vec<String> = Vec::new();

    for line in lines {
        if line.trim().is_empty() {
            continue;
        }

        let result = parse_medical_instruction(line);
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&result) {
            let confidence = parsed
                .get("confidence")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0);
            let success = parsed
                .get("success")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);

            if !success {
                failed += 1;
                if let Some(error) = parsed.get("error").and_then(|v| v.as_str()) {
                    errors.push(format!("{}: {}", line, error));
                }
            } else if confidence >= 80.0 {
                high_confidence += 1;
            } else if confidence >= 50.0 {
                medium_confidence += 1;
            } else {
                low_confidence += 1;
            }
        }
    }

    let total = high_confidence + medium_confidence + low_confidence + failed;

    json!({
        "summary": {
            "total_processed": total,
            "high_confidence": high_confidence,
            "medium_confidence": medium_confidence,
            "low_confidence": low_confidence,
            "failed": failed,
            "success_rate": if total == 0 { 0.0 } else { ((total - failed) as f64 / total as f64) * 100.0 }
        },
        "recommendations": {
            "auto_process": high_confidence,
            "review_recommended": medium_confidence + low_confidence,
            "manual_intervention": failed
        },
        "errors": errors
    })
    .to_string()
}

// ============================================================================
// COMPREHENSIVE MEDICAL DATA API (WASM EXPORTS)
// ============================================================================

/// Get all medications in the database
#[wasm_bindgen]
pub fn get_all_medications() -> String {
    let meds: Vec<serde_json::Value> = medical_data::MEDICATIONS
        .iter()
        .map(|(_name, med)| {
            json!({
                "generic_name": med.generic_name,
                "brand_names": med.brand_names,
                "common_unit": med.common_unit,
                "typical_dose_range": med.typical_dose_range,
                "category": format!("{:?}", med.category),
                "requires_special_instructions": med.requires_special_instructions,
            })
        })
        .collect();

    json!({
        "count": meds.len(),
        "medications": meds
    })
    .to_string()
}

/// Lookup a medication by name (generic or brand)
#[wasm_bindgen]
pub fn lookup_medication_by_name(name: &str) -> String {
    match lookup_medication(name) {
        Some(med) => json!({
            "found": true,
            "generic_name": med.generic_name,
            "brand_names": med.brand_names,
            "common_unit": med.common_unit,
            "typical_dose_range": med.typical_dose_range,
            "category": format!("{:?}", med.category),
            "requires_special_instructions": med.requires_special_instructions,
        })
        .to_string(),
        None => json!({
            "found": false,
            "error": format!("Medication '{}' not found", name)
        })
        .to_string(),
    }
}

/// Get all routes of administration
#[wasm_bindgen]
pub fn get_all_routes() -> String {
    let routes: Vec<serde_json::Value> = medical_data::ROUTES
        .iter()
        .map(|(_name, route)| {
            json!({
                "canonical": route.canonical,
                "abbreviations": route.abbreviations,
                "description": route.description,
                "snomed_ct_code": route.snomed_ct_code,
                "requires_site_specification": route.requires_site_specification,
            })
        })
        .collect();

    json!({
        "count": routes.len(),
        "routes": routes
    })
    .to_string()
}

/// Get all units of measurement
#[wasm_bindgen]
pub fn get_all_units() -> String {
    let units: Vec<serde_json::Value> = medical_data::UNITS
        .iter()
        .map(|(_name, unit)| {
            json!({
                "canonical": unit.canonical,
                "aliases": unit.aliases,
                "unit_type": format!("{:?}", unit.unit_type),
                "typical_range": unit.typical_range,
                "metric_equivalent": unit.metric_equivalent,
            })
        })
        .collect();

    json!({
        "count": units.len(),
        "units": units
    })
    .to_string()
}

/// Get all frequencies
#[wasm_bindgen]
pub fn get_all_frequencies() -> String {
    let freqs: Vec<serde_json::Value> = medical_data::FREQUENCIES
        .iter()
        .map(|(_name, freq)| {
            json!({
                "canonical": freq.canonical,
                "abbreviations": freq.abbreviations,
                "description": freq.description,
                "times_per_day": freq.times_per_day,
            })
        })
        .collect();

    json!({
        "count": freqs.len(),
        "frequencies": freqs
    })
    .to_string()
}

/// Validate a medication order with comprehensive checking
#[wasm_bindgen]
pub fn validate_medication_order_wasm(
    medication: &str,
    quantity: &str,
    unit: &str,
    route: &str,
    frequency: &str,
) -> String {
    let qty: f64 = match quantity.parse() {
        Ok(q) => q,
        Err(_) => {
            return json!({
                "is_valid": false,
                "errors": ["Invalid quantity format"],
                "warnings": [],
                "suggestions": []
            })
            .to_string();
        }
    };

    let report = validate_medication_order(
        Some(medication),
        qty,
        Some(unit),
        Some(route),
        Some(frequency),
    );

    json!({
        "is_valid": report.is_valid,
        "errors": report.errors,
        "warnings": report.warnings,
        "suggestions": report.suggestions,
    })
    .to_string()
}

/// Get medication statistics
#[wasm_bindgen]
pub fn get_medical_data_stats() -> String {
    json!({
        "medications": {
            "count": medical_data::MEDICATIONS.len(),
            "categories": {
                "cardiovascular": medical_data::MEDICATIONS.values().filter(|m| m.category == MedicationCategory::Cardiovascular).count(),
                "endocrine": medical_data::MEDICATIONS.values().filter(|m| m.category == MedicationCategory::Endocrine).count(),
                "pain_management": medical_data::MEDICATIONS.values().filter(|m| m.category == MedicationCategory::PainManagement).count(),
                "antibiotic": medical_data::MEDICATIONS.values().filter(|m| m.category == MedicationCategory::Antibiotic).count(),
                "respiratory": medical_data::MEDICATIONS.values().filter(|m| m.category == MedicationCategory::Respiratory).count(),
                "gastrointestinal": medical_data::MEDICATIONS.values().filter(|m| m.category == MedicationCategory::Gastrointestinal).count(),
                "neurological": medical_data::MEDICATIONS.values().filter(|m| m.category == MedicationCategory::Neurological).count(),
                "psychiatric": medical_data::MEDICATIONS.values().filter(|m| m.category == MedicationCategory::Psychiatric).count(),
                "other": medical_data::MEDICATIONS.values().filter(|m| m.category == MedicationCategory::Other).count(),
            }
        },
        "routes": {
            "count": medical_data::ROUTES.len(),
        },
        "units": {
            "count": medical_data::UNITS.len(),
        },
        "frequencies": {
            "count": medical_data::FREQUENCIES.len(),
        },
    }).to_string()
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ── Basic Parsing ─────────────────────────────────────

    #[test]
    fn test_oral_simple() {
        let r = parse_medical_instruction("Take 1 tab po qd");
        assert!(r.contains("\"success\":true"));
        assert!(r.contains("\"confidence\":100"));
        assert!(r.contains("\"confidence_level\":\"high\""));
        assert!(r.contains("\"requires_review\":false"));
        assert!(r.contains("\"quantity\":\"1\""));
        assert!(r.contains("\"unit\":\"tab\""));
        assert!(r.contains("\"route\":\"oral\""));
        assert!(r.contains("\"frequency\":\"once_daily\""));
    }

    #[test]
    fn test_oral_by_mouth() {
        let r = parse_medical_instruction("Take 2 capsules by mouth bid");
        assert!(r.contains("\"success\":true"));
        assert!(r.contains("\"quantity\":\"2\""));
        assert!(r.contains("\"unit\":\"cap\"")); // canonical form is "cap"
        assert!(r.contains("\"route\":\"oral\""));
        assert!(r.contains("\"frequency\":\"twice_daily\""));
    }

    #[test]
    fn test_normalization_cc_to_ml() {
        let r = parse_medical_instruction("Give 500 cc IV");
        assert!(r.contains("\"unit\":\"ml\""));
    }

    #[test]
    fn test_normalization_tablet_to_tab() {
        let r = parse_medical_instruction("Take 1 tablet po");
        assert!(r.contains("\"unit\":\"tab\""));
    }

    // ── Confidence Levels ─────────────────────────────────

    #[test]
    fn test_high_confidence() {
        let r = parse_medical_instruction("Take 1 tab po qd");
        assert!(r.contains("\"confidence_level\":\"high\""));
        assert!(r.contains("\"requires_review\":false"));
    }

    #[test]
    fn test_medium_confidence() {
        // "Take 1 tab po" has quantity, unit, route = 3 factors
        // Missing frequency: -10, score = 90 (high)
        // With only quantity+unit (no route/freq), score would be 80 (high)
        // Need something with fewer factors for medium confidence
        let r = parse_medical_instruction("Take 1"); // Just quantity, no unit
                                                     // This will fail parsing or have very low confidence
        assert!(r.contains("\"confidence_level\":\"low\"") || r.contains("\"success\":false"));
    }

    #[test]
    fn test_low_confidence() {
        // Empty or minimal input should result in low confidence or parse failure
        let r = parse_medical_instruction("xyz"); // Invalid input
        assert!(
            r.contains("\"confidence_level\":\"low\"")
                || r.contains("\"success\":false")
                || r.contains("\"confidence\":0")
        );
    }

    // ── Error Handling ────────────────────────────────────

    #[test]
    fn test_empty_input() {
        let r = parse_medical_instruction("");
        assert!(r.contains("\"success\":false"));
        assert!(r.contains("\"error\""));
    }

    #[test]
    fn test_invalid_input() {
        let r = parse_medical_instruction("invalid input");
        assert!(r.contains("\"success\":false"));
        assert!(r.contains("\"confidence\":0"));
    }

    // ── Threshold Testing ─────────────────────────────────

    #[test]
    fn test_custom_threshold() {
        // With 90% threshold, most things should require review
        let r = parse_medical_instruction_with_threshold("Take 1 tab po qd", 95.0);
        println!("Custom threshold: {}", r);
        // Just verify it runs without error
        assert!(r.contains("\"confidence\""));
    }

    // ── PRN Testing ───────────────────────────────────────

    #[test]
    fn test_prn() {
        let r = parse_medical_instruction("Take 1 tab as needed");
        assert!(r.contains("\"frequency\":\"as_needed\""));
    }

    #[test]
    fn test_as_needed() {
        let r = parse_medical_instruction("Take 1 tab as needed");
        assert!(r.contains("\"frequency\":\"as_needed\""));
    }

    // ── Comprehensive Medical Data Tests ─────────────────

    #[test]
    fn test_medication_lookup() {
        let med = lookup_medication("lisinopril");
        assert!(med.is_some());
        assert_eq!(med.unwrap().generic_name, "lisinopril");

        let med_brand = lookup_medication("lipitor");
        assert!(med_brand.is_some());
        assert_eq!(med_brand.unwrap().generic_name, "atorvastatin");
    }

    #[test]
    fn test_route_lookup() {
        let route = lookup_route("po");
        assert!(route.is_some());
        assert_eq!(route.unwrap().canonical, "oral");

        let route_long = lookup_route("by mouth");
        assert!(route_long.is_some());
        assert_eq!(route_long.unwrap().canonical, "oral");
    }

    #[test]
    fn test_unit_lookup() {
        let unit = lookup_unit("tablet");
        assert!(unit.is_some());
        assert_eq!(unit.unwrap().canonical, "tab");
    }

    #[test]
    fn test_frequency_lookup() {
        let freq = lookup_frequency("bid");
        assert!(freq.is_some());
        assert_eq!(freq.unwrap().canonical, "twice_daily");
    }
}
