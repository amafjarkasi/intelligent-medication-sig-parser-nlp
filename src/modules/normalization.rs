//! Normalization module for medical terminology
//!
//! Provides normalization functions for:
//! - Units (tablet → tab, milliliter → ml)
//! - Routes (po → oral, iv → intravenous)
//! - Frequencies (qd → once_daily, bid → twice_daily)
//! - Medications (brand names → generic names)

use crate::modules::medical_data::{
    lookup_frequency, lookup_medication, lookup_route, lookup_unit,
};

pub fn normalize_unit(raw: &str) -> String {
    let lower = raw.to_lowercase();

    if let Some(unit) = lookup_unit(&lower) {
        return unit.canonical.to_string();
    }

    lower
}

pub fn normalize_route(raw: &str) -> String {
    let lower = raw.to_lowercase();

    if let Some(route) = lookup_route(&lower) {
        return route.canonical.to_string();
    }

    lower
}

pub fn normalize_frequency(raw: &str) -> String {
    let lower = raw.to_lowercase();

    if let Some(freq) = lookup_frequency(&lower) {
        return freq.canonical.to_string();
    }

    lower
}

#[allow(dead_code)]
pub fn normalize_medication(raw: &str) -> Option<String> {
    let lower = raw.to_lowercase();

    if let Some(med) = lookup_medication(&lower) {
        return Some(med.generic_name.to_string());
    }

    None
}

pub fn normalize_quantity(raw: &str) -> String {
    let lower = raw.to_lowercase();

    match lower.as_str() {
        "half" => "0.5".to_string(),
        "one" => "1".to_string(),
        "two" => "2".to_string(),
        "three" => "3".to_string(),
        "four" => "4".to_string(),
        "five" => "5".to_string(),
        "six" => "6".to_string(),
        "seven" => "7".to_string(),
        "eight" => "8".to_string(),
        "nine" => "9".to_string(),
        "ten" => "10".to_string(),
        _ => {
            if lower.contains('/') {
                let parts: Vec<&str> = lower.split('/').collect();
                if parts.len() == 2 {
                    if let (Ok(num), Ok(den)) = (parts[0].parse::<f64>(), parts[1].parse::<f64>()) {
                        if den != 0.0 {
                            return format!("{}", (num / den));
                        }
                    }
                }
                lower
            } else if lower.contains('-') && lower.matches('-').count() == 1 {
                lower
            } else {
                lower
            }
        }
    }
}
