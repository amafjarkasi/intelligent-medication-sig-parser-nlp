//! Normalization module for medical terminology
//!
//! Provides normalization functions for:
//! - Units (tablet → tab, milliliter → ml)
//! - Routes (po → oral, iv → intravenous)
//! - Frequencies (qd → once_daily, bid → twice_daily)
//! - Medications (brand names → generic names)

use crate::modules::medical_data::{
    lookup_unit, lookup_route, lookup_frequency, lookup_medication,
    UNIT_NORMALIZATION, ROUTE_NORMALIZATION, FREQUENCY_NORMALIZATION
};

/// Normalize a unit to its canonical form
///
/// Examples:
/// - "tablet" → "tab"
/// - "milliliter" → "ml"
/// - "cc" → "ml"
pub fn normalize_unit(raw: &str) -> String {
    let lower = raw.to_lowercase();

    // Use comprehensive medical data lookup
    if let Some(unit) = lookup_unit(&lower) {
        return unit.canonical.to_string();
    }

    // Fallback to legacy normalization for backward compatibility
    for (from, to) in UNIT_NORMALIZATION {
        if lower == *from {
            return to.to_string();
        }
    }

    lower
}

/// Normalize a route to its canonical form
///
/// Examples:
/// - "po" → "oral"
/// - "by mouth" → "oral"
/// - "iv" → "intravenous"
pub fn normalize_route(raw: &str) -> String {
    let lower = raw.to_lowercase();

    // Use comprehensive medical data lookup
    if let Some(route) = lookup_route(&lower) {
        return route.canonical.to_string();
    }

    // Fallback to legacy normalization
    for (from, to) in ROUTE_NORMALIZATION {
        if lower == *from {
            return to.to_string();
        }
    }

    "unknown".to_string()
}

/// Normalize a frequency to its canonical form
///
/// Examples:
/// - "qd" → "once_daily"
/// - "bid" → "twice_daily"
/// - "daily" → "once_daily"
pub fn normalize_frequency(raw: &str) -> String {
    let lower = raw.to_lowercase();

    // Use comprehensive medical data lookup
    if let Some(freq) = lookup_frequency(&lower) {
        return freq.canonical.to_string();
    }

    // Fallback to legacy normalization
    for (from, to) in FREQUENCY_NORMALIZATION {
        if lower == *from {
            return to.to_string();
        }
    }

    "unknown".to_string()
}

/// Normalize medication name to generic form
///
/// Examples:
/// - "lipitor" → "atorvastatin"
/// - "tylenol" → "acetaminophen"
pub fn normalize_medication(raw: &str) -> Option<String> {
    let lower = raw.to_lowercase();

    if let Some(med) = lookup_medication(&lower) {
        return Some(med.generic_name.to_string());
    }

    None
}

/// Legacy normalization mappings (kept for backward compatibility)
pub mod legacy {
    /// Normalized unit mapping: raw form -> canonical form
    pub const UNIT_NORMALIZATION: &[(&str, &str)] = &[
        // Volume
        ("cc", "ml"),
        ("ccs", "ml"),
        ("milliliter", "ml"),
        ("milliliters", "ml"),
        // Weight
        ("milligram", "mg"),
        ("milligrams", "mg"),
        ("gram", "g"),
        ("grams", "g"),
        ("microgram", "mcg"),
        ("micrograms", "mcg"),
        // Household
        ("teaspoon", "tsp"),
        ("teaspoons", "tsp"),
        ("tablespoon", "tbsp"),
        ("tablespoons", "tbsp"),
        // Inhalation
        ("inhalation", "puff"),
        ("inhalations", "puffs"),
        // Drops
        ("gtt", "drop"),
        ("gtts", "drops"),
        // Tablets
        ("tablet", "tab"),
        ("tablets", "tabs"),
        // Capsules
        ("capsule", "cap"),
        ("capsules", "caps"),
    ];

    /// Normalized route mapping: raw form -> canonical form
    pub const ROUTE_NORMALIZATION: &[(&str, &str)] = &[
        ("po", "oral"),
        ("p.o.", "oral"),
        ("by mouth", "oral"),
        ("per os", "oral"),
        ("sl", "sublingual"),
        ("s.l.", "sublingual"),
        ("under tongue", "sublingual"),
        ("sublingual", "sublingual"),
        ("iv", "intravenous"),
        ("i.v.", "intravenous"),
        ("iv.", "intravenous"),
        ("intravenous", "intravenous"),
        ("im", "intramuscular"),
        ("i.m.", "intramuscular"),
        ("im.", "intramuscular"),
        ("intramuscular", "intramuscular"),
        ("subq", "subcutaneous"),
        ("sc", "subcutaneous"),
        ("s.c.", "subcutaneous"),
        ("sq", "subcutaneous"),
        ("subcut", "subcutaneous"),
        ("subcutaneous", "subcutaneous"),
        ("pr", "rectal"),
        ("p.r.", "rectal"),
        ("per rectum", "rectal"),
        ("rectal", "rectal"),
        ("rectally", "rectal"),
        ("topical", "topical"),
        ("top", "topical"),
        ("topically", "topical"),
        ("td", "topical"),
        ("transdermal", "topical"),
        ("inhale", "inhalation"),
        ("inhaled", "inhalation"),
        ("inhalation", "inhalation"),
        ("inh", "inhalation"),
        ("nebulized", "inhalation"),
        ("nebulizer", "inhalation"),
        ("ophthalmic", "ophthalmic"),
        ("ophth", "ophthalmic"),
        ("eye", "ophthalmic"),
        ("eyes", "ophthalmic"),
        ("ou", "ophthalmic"),
        ("os", "ophthalmic"),
        ("od", "ophthalmic"),
        ("ng", "enteral"),
        ("ngt", "enteral"),
        ("nasogastric", "enteral"),
        ("g-tube", "enteral"),
        ("g tube", "enteral"),
        ("gtube", "enteral"),
        ("gastrostomy", "enteral"),
        ("j-tube", "enteral"),
        ("j tube", "enteral"),
        ("jtube", "enteral"),
        ("jejunostomy", "enteral"),
        ("nasal", "nasal"),
        ("nose", "nasal"),
        ("intranasal", "nasal"),
        ("ear", "otic"),
        ("ears", "otic"),
        ("otic", "otic"),
        ("auricular", "otic"),
        ("vaginal", "vaginal"),
        ("pv", "vaginal"),
        ("per vagina", "vaginal"),
    ];

    /// Normalized frequency mapping: raw form -> canonical form
    pub const FREQUENCY_NORMALIZATION: &[(&str, &str)] = &[
        ("qd", "once_daily"),
        ("q.d.", "once_daily"),
        ("daily", "once_daily"),
        ("qday", "once_daily"),
        ("every day", "once_daily"),
        ("each day", "once_daily"),
        ("bid", "twice_daily"),
        ("b.i.d.", "twice_daily"),
        ("twice daily", "twice_daily"),
        ("2x daily", "twice_daily"),
        ("two times daily", "twice_daily"),
        ("tid", "three_times_daily"),
        ("t.i.d.", "three_times_daily"),
        ("three times daily", "three_times_daily"),
        ("3x daily", "three_times_daily"),
        ("qid", "four_times_daily"),
        ("q.i.d.", "four_times_daily"),
        ("four times daily", "four_times_daily"),
        ("4x daily", "four_times_daily"),
        ("prn", "as_needed"),
        ("p.r.n.", "as_needed"),
        ("as needed", "as_needed"),
        ("as necessary", "as_needed"),
        ("q4h", "every_4_hours"),
        ("q4hr", "every_4_hours"),
        ("q4hours", "every_4_hours"),
        ("every 4 hours", "every_4_hours"),
        ("every 4 hrs", "every_4_hours"),
        ("every four hours", "every_4_hours"),
        ("q6h", "every_6_hours"),
        ("q6hr", "every_6_hours"),
        ("q6hours", "every_6_hours"),
        ("every 6 hours", "every_6_hours"),
        ("every 6 hrs", "every_6_hours"),
        ("every six hours", "every_6_hours"),
        ("q8h", "every_8_hours"),
        ("q8hr", "every_8_hours"),
        ("q8hours", "every_8_hours"),
        ("every 8 hours", "every_8_hours"),
        ("every 8 hrs", "every_8_hours"),
        ("every eight hours", "every_8_hours"),
        ("q12h", "every_12_hours"),
        ("q12hr", "every_12_hours"),
        ("q12hours", "every_12_hours"),
        ("every 12 hours", "every_12_hours"),
        ("every 12 hrs", "every_12_hours"),
        ("every twelve hours", "every_12_hours"),
        ("q24h", "every_24_hours"),
        ("q24hr", "every_24_hours"),
        ("q24hours", "every_24_hours"),
        ("every 24 hours", "every_24_hours"),
        ("every 24 hrs", "every_24_hours"),
        ("hs", "at_bedtime"),
        ("h.s.", "at_bedtime"),
        ("at bedtime", "at_bedtime"),
        ("bedtime", "at_bedtime"),
        ("qhs", "at_bedtime"),
        ("q.h.s.", "at_bedtime"),
        ("qod", "every_other_day"),
        ("q.o.d.", "every_other_day"),
        ("every other day", "every_other_day"),
        ("weekly", "once_weekly"),
        ("qwk", "once_weekly"),
        ("once weekly", "once_weekly"),
        ("every week", "once_weekly"),
        ("q2wk", "every_two_weeks"),
        ("biweekly", "every_two_weeks"),
        ("every 2 weeks", "every_two_weeks"),
        ("every two weeks", "every_two_weeks"),
        ("monthly", "monthly"),
        ("qmo", "monthly"),
        ("once monthly", "monthly"),
        ("every month", "monthly"),
        ("ac", "before_meals"),
        ("a.c.", "before_meals"),
        ("before meals", "before_meals"),
        ("pc", "after_meals"),
        ("p.c.", "after_meals"),
        ("after meals", "after_meals"),
        ("am", "morning"),
        ("a.m.", "morning"),
        ("morning", "morning"),
        ("qam", "morning"),
        ("q.am.", "morning"),
        ("every morning", "morning"),
        ("pm", "evening"),
        ("p.m.", "evening"),
        ("evening", "evening"),
        ("qpm", "evening"),
        ("q.p.m.", "evening"),
        ("every evening", "evening"),
        ("stat", "once"),
        ("statim", "once"),
        ("immediately", "once"),
        ("now", "once"),
        ("one time", "once"),
        ("once", "once"),
        ("single dose", "once"),
    ];
}
