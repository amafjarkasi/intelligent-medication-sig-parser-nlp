//! Error handling and suggestion generation module
//!
//! Provides detailed error messages and suggestions for common mistakes
//! in medication instructions.

/// Common misspellings and their corrections
const SUGGESTIONS: &[(&str, &str)] = &[
    ("orl", "oral"),
    ("by mout", "by mouth"),
    ("tabl", "tablet"),
    ("tabelt", "tablet"),
    ("capsul", "capsule"),
    ("daly", "daily"),
    ("dailey", "daily"),
    ("bidaily", "twice daily"),
    ("injection", "inject"),
    ("pil", "tablet"),
];

/// Generate a user-friendly error message with suggestions
/// This is a generic version that doesn't depend on PEST types
pub fn generate_error_message(input: &str, error_pos: Option<usize>) -> String {
    let pos = error_pos.unwrap_or(0);

    // Get context around error
    let context_start = pos.saturating_sub(20);
    let context_end = (pos + 20).min(input.len());
    let context = &input[context_start..context_end];

    // Determine likely issue and generate suggestions
    let (message, suggestions): (&str, Vec<String>) = if input.trim().is_empty() {
        (
            "Empty input. Please provide a medication instruction like 'Take 1 tablet by mouth daily'.",
            vec!["Example: Take 1 tab po qd".to_string(), "Example: Give 500 mg IV BID".to_string()],
        )
    } else if !input.chars().any(|c| c.is_ascii_digit()) {
        (
            "Missing quantity. Please include a number (e.g., 'Take 1 tablet...').",
            vec![
                "Did you mean: 'Take 1 tab...'?".to_string(),
                "Did you mean: 'Give 2 capsules...'?".to_string(),
            ],
        )
    } else if input.len() < 3 {
        (
            "Input too short. Please provide a complete medication instruction.",
            vec![],
        )
    } else if pos == 0 {
        (
            "Invalid start of instruction. Try starting with a number or action word like 'Take' or 'Give'.",
            vec!["Try: 'Take 1...'".to_string(), "Try: 'Give 2...'".to_string(), "Try: '1 tab...'".to_string()],
        )
    } else {
        // Check for common misspellings in context
        let mut found_suggestions: Vec<String> = Vec::new();
        let context_lower = context.to_lowercase();
        for (misspelled, correction) in SUGGESTIONS {
            if context_lower.contains(misspelled) {
                found_suggestions.push(format!(
                    "Did you mean '{}' instead of '{}'?",
                    correction, misspelled
                ));
            }
        }

        (
            "Unable to parse instruction. Expected format: '<action> <quantity> <unit> <route> <frequency>'",
            found_suggestions,
        )
    };

    if suggestions.is_empty() {
        format!("{} (near: '{}')", message, context)
    } else {
        format!(
            "{} (near: '{}')\nSuggestions:\n  - {}",
            message,
            context,
            suggestions.join("\n  - ")
        )
    }
}
