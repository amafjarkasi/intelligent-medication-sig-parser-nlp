//! Confidence scoring module
//!
//! Calculates confidence scores for parsed medication instructions
//! based on completeness of extracted fields.

/// Calculate confidence score (0-100) based on field completeness
pub fn calculate_confidence(
    quantity: Option<&str>,
    unit: Option<&str>,
    route: Option<&str>,
    frequency: Option<&str>,
    drug_name: Option<&str>,
    has_errors: bool,
) -> f64 {
    if has_errors {
        return 0.0;
    }

    let mut score: f64 = 100.0;
    let mut factors = 0;

    // Quantity present (required)
    if quantity.is_some() {
        factors += 1;
    } else {
        score -= 25.0;
    }

    // Unit present (high importance)
    if unit.is_some() {
        factors += 1;
    } else {
        score -= 15.0;
    }

    // Route present (medium importance)
    if route.is_some() {
        factors += 1;
    } else {
        score -= 10.0;
    }

    // Frequency present (medium importance)
    if frequency.is_some() {
        factors += 1;
    } else {
        score -= 10.0;
    }

    // Drug name present (bonus, capped)
    if drug_name.is_some() {
        factors += 1;
        score += 5.0;
    }

    // Penalize if less than 2 factors present
    if factors < 2 {
        score -= 20.0;
    }

    score.min(100.0).max(0.0)
}

/// Check if confidence meets threshold for automatic processing
pub fn is_high_confidence(confidence: f64) -> bool {
    confidence >= 80.0
}

/// Check if confidence is medium (review recommended)
pub fn is_medium_confidence(confidence: f64) -> bool {
    confidence >= 50.0 && confidence < 80.0
}

/// Check if confidence is low (manual review required)
#[allow(dead_code)]
pub fn is_low_confidence(confidence: f64) -> bool {
    confidence < 50.0
}

/// Get confidence level as string
pub fn get_confidence_level(confidence: f64) -> &'static str {
    if is_high_confidence(confidence) {
        "high"
    } else if is_medium_confidence(confidence) {
        "medium"
    } else {
        "low"
    }
}
