//! Normalization module for medical terminology
//!
//! Provides normalization functions for:
//! - Units (tablet → tab, milliliter → ml)
//! - Routes (po → oral, iv → intravenous)
//! - Frequencies (qd → once_daily, bid → twice_daily)
//! - Medications (brand names → generic names)
//! - Unicode normalization, fuzzy matching, misspellings

use crate::modules::medical_data::{
    lookup_frequency, lookup_medication, lookup_route, lookup_unit,
};

fn normalize_text(raw: &str) -> String {
    let normalized: String = raw
        .chars()
        .filter(|c| {
            !c.is_control()
                && (c.is_alphanumeric()
                    || c.is_whitespace()
                    || *c == '.'
                    || *c == '/'
                    || *c == '-'
                    || *c == '_')
        })
        .flat_map(|c| c.to_lowercase())
        .collect();

    // Trim whitespace and normalize multiple spaces
    let trimmed = normalized.split_whitespace().collect::<Vec<_>>().join(" ");

    // Remove common punctuation artifacts
    trimmed
        .replace(" . ", " ")
        .replace(",", "")
        .trim()
        .to_string()
}

pub fn preprocess_for_parsing(input: &str) -> String {
    let normalized = normalize_text(input);
    let tokens: Vec<&str> = normalized.split_whitespace().collect();
    let mut result_tokens: Vec<String> = Vec::new();

    for token in tokens {
        let processed = normalize_token(token);
        result_tokens.push(processed);
    }

    result_tokens.join(" ")
}

fn normalize_token(token: &str) -> String {
    // Handle plurals - convert to singular form
    let singular = match token {
        "puffs" => "puff",
        "drops" => "drop",
        "tablets" => "tablet",
        "capsules" => "capsule",
        "milliliters" => "milliliter",
        "milligrams" => "milligram",
        "grams" => "gram",
        "micrograms" => "microgram",
        "teaspoons" => "teaspoon",
        "tablespoons" => "tablespoon",
        "inhalations" => "inhalation",
        "sprays" => "spray",
        "applications" => "application",
        "patches" => "patch",
        "vials" => "vial",
        "ampules" => "ampule",
        "suppositories" => "suppository",
        _ => token,
    };

    // Apply fuzzy normalization
    if let Some(corrected) = fuzzy_match_unit(singular) {
        return corrected;
    }
    if let Some(corrected) = fuzzy_match_route(singular) {
        return corrected;
    }
    if let Some(corrected) = fuzzy_match_frequency(singular) {
        return corrected;
    }

    singular.to_string()
}

pub fn normalize_unit(raw: &str) -> String {
    let normalized = normalize_text(raw);

    if let Some(unit) = lookup_unit(&normalized) {
        return unit.canonical.to_string();
    }

    // Fuzzy match for misspellings
    if let Some(corrected) = fuzzy_match_unit(&normalized) {
        return corrected;
    }

    normalized
}

pub fn normalize_route(raw: &str) -> String {
    let normalized = normalize_text(raw);

    if let Some(route) = lookup_route(&normalized) {
        return route.canonical.to_string();
    }

    if let Some(corrected) = fuzzy_match_route(&normalized) {
        return corrected;
    }

    normalized
}

pub fn normalize_frequency(raw: &str) -> String {
    let normalized = normalize_text(raw);

    if let Some(freq) = lookup_frequency(&normalized) {
        return freq.canonical.to_string();
    }

    if let Some(corrected) = fuzzy_match_frequency(&normalized) {
        return corrected;
    }

    normalized
}

#[allow(dead_code)]
pub fn normalize_medication(raw: &str) -> Option<String> {
    let normalized = normalize_text(raw);

    if let Some(med) = lookup_medication(&normalized) {
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
            } else {
                lower
            }
        }
    }
}

// ============================================================================
// FUZZY MATCHING (NLP Skill Recommendations)
// ============================================================================

fn levenshtein_distance(s1: &str, s2: &str) -> usize {
    let s1_chars: Vec<char> = s1.chars().collect();
    let s2_chars: Vec<char> = s2.chars().collect();

    let len1 = s1_chars.len();
    let len2 = s2_chars.len();

    if len1 == 0 {
        return len2;
    }
    if len2 == 0 {
        return len1;
    }

    let mut matrix = vec![vec![0usize; len2 + 1]; len1 + 1];

    for (i, row) in matrix.iter_mut().enumerate().take(len1 + 1) {
        row[0] = i;
    }
    for (j, cell) in matrix[0].iter_mut().enumerate().take(len2 + 1) {
        *cell = j;
    }

    for i in 1..=len1 {
        for j in 1..=len2 {
            let cost = if s1_chars[i - 1] == s2_chars[j - 1] {
                0
            } else {
                1
            };
            matrix[i][j] = (matrix[i - 1][j] + 1)
                .min(matrix[i][j - 1] + 1)
                .min(matrix[i - 1][j - 1] + cost);
        }
    }

    matrix[len1][len2]
}

fn fuzzy_match(input: &str, candidates: &[(&str, &str)], threshold: f64) -> Option<String> {
    let input_lower = input.to_lowercase();

    for (misspelled, correct) in candidates {
        let distance = levenshtein_distance(&input_lower, misspelled);
        let max_len = input_lower.len().max(misspelled.len());
        let similarity = 1.0 - (distance as f64 / max_len as f64);

        if similarity >= threshold {
            return Some(correct.to_string());
        }
    }

    None
}

fn fuzzy_match_unit(input: &str) -> Option<String> {
    let misspellings = [
        ("tbalet", "tab"),
        ("tbalets", "tab"),
        ("tablet", "tab"),
        ("tablets", "tab"),
        ("capsle", "cap"),
        ("capsul", "cap"),
        ("capsle", "cap"),
        ("miligram", "mg"),
        ("miligramms", "mg"),
        ("mililiter", "ml"),
        ("mililiters", "ml"),
        ("microgram", "mcg"),
    ];

    fuzzy_match(input, &misspellings, 0.7)
}

fn fuzzy_match_route(input: &str) -> Option<String> {
    let misspellings = [
        ("orral", "oral"),
        ("oraly", "oral"),
        ("perorol", "oral"),
        ("iv", "intravenous"),
        ("ivv", "intravenous"),
        ("intramusc", "intramuscular"),
        ("intramus", "intramuscular"),
        ("subq", "subcutaneous"),
        ("subcut", "subcutaneous"),
        ("topcial", "topical"),
    ];

    fuzzy_match(input, &misspellings, 0.7)
}

fn fuzzy_match_frequency(input: &str) -> Option<String> {
    let misspellings = [
        ("dialy", "daily"),
        ("twicedaily", "twice_daily"),
        ("qd", "once_daily"),
        ("bid", "twice_daily"),
        ("tid", "three_times_daily"),
        ("qid", "four_times_daily"),
        ("prn", "as_needed"),
        ("hs", "at_bedtime"),
    ];

    // Prevent matching valid canonical outputs to wrong misspellings
    let canonical = [
        "once_daily",
        "twice_daily",
        "three_times_daily",
        "four_times_daily",
        "as_needed",
        "at_bedtime",
        "daily",
    ];
    if canonical.contains(&input) {
        return None;
    }

    fuzzy_match(input, &misspellings, 0.75) // Increased threshold to avoid false positives like once/twice
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fuzzy_unit() {
        assert_eq!(fuzzy_match_unit("tbalet"), Some("tab".to_string()));
        assert_eq!(fuzzy_match_unit("miligram"), Some("mg".to_string()));
        assert_eq!(fuzzy_match_unit("tbalets"), Some("tab".to_string()));
        assert_eq!(fuzzy_match_unit("capsle"), Some("cap".to_string()));
        assert_eq!(fuzzy_match_unit("mililiter"), Some("ml".to_string()));
        assert_eq!(fuzzy_match_unit("capsul"), Some("cap".to_string()));
        assert_eq!(fuzzy_match_unit("capsle"), Some("cap".to_string()));
        assert_eq!(fuzzy_match_unit("miligramms"), Some("mg".to_string()));
        assert_eq!(fuzzy_match_unit("mililiters"), Some("ml".to_string()));
        assert_eq!(fuzzy_match_unit("microgram"), Some("mcg".to_string()));
    }

    #[test]
    fn test_fuzzy_route() {
        assert_eq!(fuzzy_match_route("orral"), Some("oral".to_string()));
        assert_eq!(fuzzy_match_route("oraly"), Some("oral".to_string()));
        assert_eq!(fuzzy_match_route("perorol"), Some("oral".to_string()));
        assert_eq!(fuzzy_match_route("ivv"), Some("intravenous".to_string()));
        assert_eq!(
            fuzzy_match_route("intramusc"),
            Some("intramuscular".to_string())
        );
        assert_eq!(
            fuzzy_match_route("intramus"),
            Some("intramuscular".to_string())
        );
        assert_eq!(
            fuzzy_match_route("subcut"),
            Some("subcutaneous".to_string())
        );
        assert_eq!(fuzzy_match_route("topcial"), Some("topical".to_string()));
    }

    #[test]
    fn test_fuzzy_frequency() {
        assert_eq!(
            fuzzy_match_frequency("twicedaily"),
            Some("twice_daily".to_string())
        );
        assert_eq!(fuzzy_match_frequency("dialy"), Some("daily".to_string()));
        assert_eq!(fuzzy_match_frequency("qd"), Some("once_daily".to_string()));
        assert_eq!(
            fuzzy_match_frequency("bid"),
            Some("twice_daily".to_string())
        );
        assert_eq!(
            fuzzy_match_frequency("tid"),
            Some("three_times_daily".to_string())
        );
        assert_eq!(
            fuzzy_match_frequency("qid"),
            Some("four_times_daily".to_string())
        );
        assert_eq!(fuzzy_match_frequency("prn"), Some("as_needed".to_string()));
        assert_eq!(fuzzy_match_frequency("hs"), Some("at_bedtime".to_string()));
    }

    #[test]
    fn test_normalize_text() {
        assert_eq!(normalize_text("  TAKE  1  TAB  "), "take 1 tab");
        assert_eq!(normalize_text("P.O."), "p.o.".to_string());
        assert_eq!(normalize_text(""), "");
        assert_eq!(normalize_text("TEST"), "test");
        assert_eq!(normalize_text("hello  world"), "hello world");
        assert_eq!(normalize_text("a . b"), "a b");
        assert_eq!(normalize_text("1,2,3"), "123");
        assert_eq!(normalize_text("\t\n  "), "");
    }

    #[test]
    fn test_normalize_unit() {
        assert_eq!(normalize_unit("tbalet"), "tab");
        assert_eq!(normalize_unit("mg"), "mg");
        assert_eq!(normalize_unit("ml"), "ml");
        assert_eq!(normalize_unit("capsule"), "cap");
    }

    #[test]
    fn test_normalize_route() {
        assert_eq!(normalize_route("orral"), "oral");
        assert_eq!(normalize_route("po"), "oral");
        assert_eq!(normalize_route("iv"), "intravenous");
        assert_eq!(normalize_route("subq"), "subcutaneous");
    }

    #[test]
    fn test_normalize_frequency() {
        assert_eq!(normalize_frequency("qd"), "once_daily");
        assert_eq!(normalize_frequency("bid"), "twice_daily");
        assert_eq!(normalize_frequency("twicedaily"), "twice_daily");
        assert_eq!(normalize_frequency("dialy"), "daily");
    }

    #[test]
    fn test_normalize_quantity() {
        assert_eq!(normalize_quantity("half"), "0.5");
        assert_eq!(normalize_quantity("one"), "1");
        assert_eq!(normalize_quantity("two"), "2");
        assert_eq!(normalize_quantity("three"), "3");
        assert_eq!(normalize_quantity("1/2"), "0.5");
        assert_eq!(normalize_quantity("3/4"), "0.75");
        assert_eq!(normalize_quantity("abc"), "abc");
    }

    #[test]
    fn test_levenshtein_distance() {
        assert_eq!(levenshtein_distance("", ""), 0);
        assert_eq!(levenshtein_distance("a", "a"), 0);
        assert_eq!(levenshtein_distance("a", "b"), 1);
        assert_eq!(levenshtein_distance("abc", "abc"), 0);
        assert_eq!(levenshtein_distance("abc", "abd"), 1);
        assert_eq!(levenshtein_distance("kitten", "sitting"), 3);
        assert_eq!(levenshtein_distance("flaw", "lawn"), 2);
    }

    #[test]
    fn test_fuzzy_no_match() {
        assert_eq!(fuzzy_match_unit("xyz"), None);
        assert_eq!(fuzzy_match_route("xyz"), None);
        assert_eq!(fuzzy_match_frequency("xyz"), None);
    }

    #[test]
    fn test_normalize_medication() {
        assert_eq!(
            normalize_medication("tylenol"),
            Some("acetaminophen".to_string())
        );
        assert_eq!(normalize_medication("advil"), Some("ibuprofen".to_string()));
        assert_eq!(normalize_medication("unknowndrug"), None);
    }

    #[test]
    fn test_edge_case_unicode() {
        assert_eq!(normalize_text("CAFÉ"), "café");
        assert_eq!(normalize_text("naïve"), "naïve");
        assert_eq!(normalize_text("Ðrug"), "ðrug");
    }

    #[test]
    fn test_edge_case_mixed_case() {
        assert_eq!(normalize_unit("TAB"), "tab");
        assert_eq!(normalize_unit("Tab"), "tab");
        assert_eq!(normalize_unit("mg"), "mg");
        assert_eq!(normalize_route("ORAL"), "oral");
        assert_eq!(normalize_route("Oral"), "oral");
        assert_eq!(normalize_frequency("DAILY"), "once_daily");
    }

    #[test]
    fn test_edge_case_numbers() {
        assert_eq!(normalize_quantity("1.5"), "1.5");
        assert_eq!(normalize_quantity("0.5"), "0.5");
        assert_eq!(normalize_quantity("100"), "100");
        assert_eq!(normalize_quantity("1/4"), "0.25");
        assert_eq!(normalize_quantity("2.5"), "2.5");
    }

    #[test]
    fn test_edge_case_control_characters() {
        assert_eq!(normalize_text("\ttab\t"), "tab");
        assert_eq!(normalize_text("\ntab\n"), "tab");
        assert_eq!(normalize_text("tab\r\n"), "tab");
        assert_eq!(normalize_text("  \t  "), "");
    }

    #[test]
    fn test_edge_case_empty_after_normalization() {
        assert_eq!(normalize_text(",,,"), "");
        assert_eq!(normalize_text("   "), "");
    }

    #[test]
    fn test_edge_case_exact_match_priority() {
        assert_eq!(normalize_unit("mg"), "mg");
        assert_eq!(normalize_route("oral"), "oral");
        assert_eq!(normalize_frequency("once_daily"), "once_daily");
    }

    #[test]
    fn test_edge_case_long_string() {
        let long = "take 1 tablet by mouth twice daily ".repeat(10);
        let result = normalize_text(&long);
        assert!(result.len() < long.len());
        assert!(result.contains("take 1 tablet by mouth twice daily"));
    }

    #[test]
    fn test_edge_case_punctuation() {
        assert_eq!(normalize_text("tab."), "tab.");
        assert_eq!(normalize_text("(tab)"), "tab");
        assert_eq!(normalize_text("tab)"), "tab");
    }
}
