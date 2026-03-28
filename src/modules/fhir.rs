//! FHIR R4 Dosage format generation module
//!
//! Converts parsed medication instructions into FHIR-compliant Dosage resources
//! with SNOMED CT coding for routes.

use serde_json::json;

/// Generate FHIR R4 Dosage format from parsed components
pub fn generate_fhir_output(
    quantity: Option<&str>,
    unit: Option<&str>,
    route: Option<&str>,
    frequency: Option<&str>,
    duration: Option<&str>,
) -> serde_json::Value {
    let mut fhir = serde_json::Map::new();

    // Text representation
    let text_parts: Vec<String> = [
        quantity.map(|q| format!("{} {}", q, unit.unwrap_or(""))),
        route.map(|r| r.to_string()),
        frequency.map(|f| f.to_string()),
        duration.map(|d| format!("for {}", d)),
    ]
    .into_iter()
    .flatten()
    .collect();

    if !text_parts.is_empty() {
        fhir.insert("text".to_string(), json!(text_parts.join(" ")));
    }

    // Timing
    if let Some(freq) = frequency {
        let timing = match freq.as_ref() {
            "once_daily" | "daily" => json!({
                "repeat": { "frequency": 1, "period": 1, "periodUnit": "d" }
            }),
            "twice_daily" => json!({
                "repeat": { "frequency": 2, "period": 1, "periodUnit": "d" }
            }),
            "three_times_daily" => json!({
                "repeat": { "frequency": 3, "period": 1, "periodUnit": "d" }
            }),
            "four_times_daily" => json!({
                "repeat": { "frequency": 4, "period": 1, "periodUnit": "d" }
            }),
            "every_4_hours" => json!({
                "repeat": { "frequency": 1, "period": 4, "periodUnit": "h" }
            }),
            "every_6_hours" => json!({
                "repeat": { "frequency": 1, "period": 6, "periodUnit": "h" }
            }),
            "every_8_hours" => json!({
                "repeat": { "frequency": 1, "period": 8, "periodUnit": "h" }
            }),
            "every_12_hours" => json!({
                "repeat": { "frequency": 1, "period": 12, "periodUnit": "h" }
            }),
            "every_24_hours" => json!({
                "repeat": { "frequency": 1, "period": 24, "periodUnit": "h" }
            }),
            "once_weekly" => json!({
                "repeat": { "frequency": 1, "period": 1, "periodUnit": "wk" }
            }),
            "monthly" => json!({
                "repeat": { "frequency": 1, "period": 1, "periodUnit": "mo" }
            }),
            "as_needed" => json!({ "asNeededBoolean": true }),
            "at_bedtime" => json!({
                "repeat": { "when": ["HS"] }
            }),
            _ => json!(null),
        };
        if !timing.is_null() {
            fhir.insert("timing".to_string(), timing);
        }
    }

    // Route with SNOMED CT coding
    if let Some(r) = route {
        let route_code = match r.as_ref() {
            "oral" => ("26643006", "Oral route"),
            "intravenous" => ("47625008", "Intravenous route"),
            "intramuscular" => ("78421000", "Intramuscular route"),
            "subcutaneous" => ("34206005", "Subcutaneous route"),
            "sublingual" => ("37839007", "Sublingual route"),
            "rectal" => ("37161004", "Rectal route"),
            "topical" => ("6064005", "Topical route"),
            "inhalation" => ("447694001", "Inhalation route"),
            "ophthalmic" => ("54485002", "Ophthalmic route"),
            "nasal" => ("46713006", "Nasal route"),
            "otic" => ("10547007", "Otic route"),
            "vaginal" => ("16857009", "Vaginal route"),
            _ => ("", ""),
        };
        if !route_code.0.is_empty() {
            fhir.insert("route".to_string(), json!({
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": route_code.0,
                    "display": route_code.1
                }]
            }));
        }
    }

    // Dose
    if let (Some(q), Some(u)) = (quantity, unit) {
        if let Ok(val) = q.parse::<f64>() {
            fhir.insert("doseAndRate".to_string(), json!([{
                "doseQuantity": {
                    "value": val,
                    "unit": u
                }
            }]));
        }
    }

    json!(fhir)
}
