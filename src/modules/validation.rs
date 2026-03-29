//! Validation module for medication orders and dosages
//!
//! Provides comprehensive validation including:
//! - Input validation (security, format, length)
//! - Dosage validation (ranges, medication-specific limits)
//! - Unit validation
//! - Route validation
//! - Frequency validation

use crate::modules::medical_data::{
    lookup_frequency, lookup_medication, lookup_route, lookup_unit, DOSAGE_LIMITS,
};

/// Validation report for a complete medication order
#[derive(Debug, Clone)]
pub struct ValidationReport {
    pub is_valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub suggestions: Vec<String>,
}

/// Input validation result
#[derive(Debug, Clone)]
pub struct InputValidationResult {
    pub is_valid: bool,
    pub error_message: Option<String>,
}

/// Validate raw input for security and data quality
pub fn validate_input(input: &str) -> InputValidationResult {
    // Check for empty input
    if input.trim().is_empty() {
        return InputValidationResult {
            is_valid: false,
            error_message: Some("Empty input. Please provide a medication instruction like 'Take 1 tablet by mouth daily'.".to_string()),
        };
    }

    // Check for control characters (security/data quality)
    if input
        .chars()
        .any(|c| c.is_ascii_control() && c != '\t' && c != '\n' && c != '\r')
    {
        return InputValidationResult {
            is_valid: false,
            error_message: Some(
                "Input contains invalid control characters. Please use only printable characters."
                    .to_string(),
            ),
        };
    }

    // Check for reasonable length (prevent DoS)
    if input.len() > 10000 {
        return InputValidationResult {
            is_valid: false,
            error_message: Some("Input too long (max 10,000 characters). Please provide a concise medication instruction.".to_string()),
        };
    }

    // Check for null bytes
    if input.contains('\0') {
        return InputValidationResult {
            is_valid: false,
            error_message: Some(
                "Input contains null bytes. Please provide valid text.".to_string(),
            ),
        };
    }

    InputValidationResult {
        is_valid: true,
        error_message: None,
    }
}

/// Validation result with detailed feedback
#[derive(Debug, Clone)]
pub struct DosageValidationResult {
    pub is_valid: bool,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
    pub suggestions: Vec<String>,
}

/// Validate dosage quantity and unit
pub fn validate_dosage(
    quantity: &str,
    unit: Option<&str>,
    medication: Option<&str>,
) -> DosageValidationResult {
    let mut result = DosageValidationResult {
        is_valid: true,
        warnings: Vec::new(),
        errors: Vec::new(),
        suggestions: Vec::new(),
    };

    let qty: f64 = match quantity.parse() {
        Ok(q) => q,
        Err(_) => {
            result
                .errors
                .push(format!("Invalid quantity: '{}'", quantity));
            result.is_valid = false;
            return result;
        }
    };

    // Check for negative or zero
    if qty <= 0.0 {
        result
            .errors
            .push("Quantity must be greater than zero".to_string());
        result.is_valid = false;
    }

    // Check for negative sign in original string (catches -0, -0.0, etc.)
    if quantity.starts_with('-') {
        result
            .errors
            .push("Negative quantities are not valid for medication dosing".to_string());
        result.is_valid = false;
    }

    // Check for extremely small quantities (likely errors)
    if qty > 0.0 && qty < 0.001 {
        result.warnings.push(format!(
            "Quantity '{}' is extremely small. Please verify this is correct.",
            quantity
        ));
    }

    // Check for extremely large numbers
    if qty > 1000000.0 {
        result.warnings.push(format!(
            "Quantity '{}' is unusually large. Please verify.",
            quantity
        ));
    }

    // Medication-specific validation using comprehensive database
    if let Some(med_name) = medication {
        if let Some(med) = lookup_medication(med_name) {
            let unit_str = unit.unwrap_or(med.common_unit);
            if unit_str == med.common_unit
                && (qty < med.typical_dose_range.0 || qty > med.typical_dose_range.1)
            {
                result.warnings.push(format!(
                    "{} dose of {} {} is outside typical range ({}-{} {})",
                    med.generic_name,
                    qty,
                    unit_str,
                    med.typical_dose_range.0,
                    med.typical_dose_range.1,
                    med.common_unit
                ));
            }

            if med.requires_special_instructions {
                result.suggestions.push(format!(
                    "{} may have special administration requirements",
                    med.generic_name
                ));
            }
        }
    }

    // Unit-specific validation using comprehensive database
    if let Some(u) = unit {
        if let Some(unit_def) = lookup_unit(u) {
            if qty < unit_def.typical_range.0 || qty > unit_def.typical_range.1 {
                result.warnings.push(format!(
                    "Quantity {} {} is outside typical range ({}-{} {})",
                    qty, u, unit_def.typical_range.0, unit_def.typical_range.1, unit_def.canonical
                ));
            }
        } else {
            // Fallback to legacy validation
            let unit_lower = u.to_lowercase();
            for (unit_name, min, max, typical) in DOSAGE_LIMITS {
                if unit_lower == *unit_name {
                    if qty < *min || qty > *max {
                        result.warnings.push(format!(
                            "Quantity {} {} is outside typical range ({}-{} {})",
                            qty, u, min, max, u
                        ));
                    }
                    // Suggest typical dose if far from it
                    let ratio = qty / typical;
                    if !(0.1..=10.0).contains(&ratio) {
                        result.suggestions.push(format!(
                            "Typical dose for {} is around {} {}",
                            u, typical, u
                        ));
                    }
                    break;
                }
            }
        }
    }

    result
}

/// Validate a complete medication order
pub fn validate_medication_order(
    medication: Option<&str>,
    quantity: f64,
    unit: Option<&str>,
    route: Option<&str>,
    frequency: Option<&str>,
) -> ValidationReport {
    let mut report = ValidationReport {
        is_valid: true,
        errors: Vec::new(),
        warnings: Vec::new(),
        suggestions: Vec::new(),
    };

    // Validate medication
    if let Some(med_name) = medication {
        if let Some(med) = lookup_medication(med_name) {
            // Check dose range
            let unit_str = unit.unwrap_or(med.common_unit);
            if unit_str == med.common_unit
                && (quantity < med.typical_dose_range.0 || quantity > med.typical_dose_range.1)
            {
                report.warnings.push(format!(
                    "{} dose of {} {} is outside typical range ({}-{} {})",
                    med.generic_name,
                    quantity,
                    unit_str,
                    med.typical_dose_range.0,
                    med.typical_dose_range.1,
                    med.common_unit
                ));
            }

            // Add special instructions if required
            if med.requires_special_instructions {
                report.suggestions.push(format!(
                    "{} may have special administration requirements",
                    med.generic_name
                ));
            }
        }
    }

    // Validate quantity
    if quantity <= 0.0 {
        report
            .errors
            .push("Quantity must be greater than zero".to_string());
        report.is_valid = false;
    }

    if quantity > 10000.0 {
        report
            .warnings
            .push("Quantity is unusually large".to_string());
    }

    // Validate unit
    if let Some(u) = unit {
        if lookup_unit(u).is_none() {
            report.warnings.push(format!("Unrecognized unit: {}", u));
        }
    }

    // Validate route
    if let Some(r) = route {
        if lookup_route(r).is_none() {
            report.warnings.push(format!("Unrecognized route: {}", r));
        }
    }

    // Validate frequency
    if let Some(f) = frequency {
        if lookup_frequency(f).is_none() {
            report
                .warnings
                .push(format!("Unrecognized frequency: {}", f));
        }
    }

    report
}
