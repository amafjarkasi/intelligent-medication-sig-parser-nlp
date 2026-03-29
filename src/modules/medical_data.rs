//! Comprehensive Medical Data Definitions
//!
//! This module provides a centralized, extensible database of:
//! - Medications (generic and brand names)
//! - Routes of administration
//! - Units of measurement
//! - Frequencies and timing
//! - Indications
//! - Special instructions
//!
//! All data is organized to support easy extension and maintenance.

use once_cell::sync::Lazy;
use std::collections::HashMap;

// ============================================================================
// DOSAGE LIMITS
// ============================================================================
pub const DOSAGE_LIMITS: &[(&str, f64, f64, f64)] = &[
    ("tab", 0.0, 100.0, 1.0),
    ("cap", 0.0, 100.0, 1.0),
    ("mg", 0.0, 5000.0, 500.0),
    ("g", 0.0, 5.0, 1.0),
    ("ml", 0.0, 5000.0, 500.0),
    ("mcg", 0.0, 10000.0, 100.0),
    ("unit", 0.0, 1000.0, 10.0),
    ("puff", 0.0, 20.0, 2.0),
    ("drop", 0.0, 50.0, 2.0),
    ("tsp", 0.0, 10.0, 1.0),
    ("tbsp", 0.0, 5.0, 1.0),
];

// ============================================================================
// MEDICATION DATABASE
// ============================================================================

/// Medication information including common brand names and typical dosing
#[derive(Debug, Clone)]
pub struct Medication {
    pub generic_name: &'static str,
    pub brand_names: &'static [&'static str],
    pub typical_dose_range: (f64, f64), // (min, max) in mg or appropriate unit
    pub common_unit: &'static str,
    pub category: MedicationCategory,
    pub requires_special_instructions: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[allow(dead_code)]
pub enum MedicationCategory {
    Cardiovascular,
    Endocrine,
    PainManagement,
    Antibiotic,
    Antiviral,
    Respiratory,
    Gastrointestinal,
    Neurological,
    Psychiatric,
    Oncology,
    Anticoagulant,
    Diuretic,
    Steroid,
    Vaccine,
    Supplement,
    Other,
}

/// Comprehensive medication database
/// Organized alphabetically for easy maintenance
pub static MEDICATIONS: Lazy<HashMap<&'static str, Medication>> = Lazy::new(|| {
    let mut meds = HashMap::new();

    // A
    meds.insert(
        "acetaminophen",
        Medication {
            generic_name: "acetaminophen",
            brand_names: &["tylenol", "panadol", "ofirmev"],
            typical_dose_range: (325.0, 1000.0),
            common_unit: "mg",
            category: MedicationCategory::PainManagement,
            requires_special_instructions: false,
        },
    );

    meds.insert(
        "acyclovir",
        Medication {
            generic_name: "acyclovir",
            brand_names: &["zovirax", "sitavig"],
            typical_dose_range: (200.0, 800.0),
            common_unit: "mg",
            category: MedicationCategory::Antiviral,
            requires_special_instructions: false,
        },
    );

    meds.insert(
        "albuterol",
        Medication {
            generic_name: "albuterol",
            brand_names: &["proair", "ventolin", "proventil"],
            typical_dose_range: (90.0, 180.0),
            common_unit: "mcg",
            category: MedicationCategory::Respiratory,
            requires_special_instructions: true, // Shake well before use
        },
    );

    meds.insert(
        "allopurinol",
        Medication {
            generic_name: "allopurinol",
            brand_names: &["zyloprim", "aloprim"],
            typical_dose_range: (100.0, 800.0),
            common_unit: "mg",
            category: MedicationCategory::Other,
            requires_special_instructions: false,
        },
    );

    meds.insert(
        "amlodipine",
        Medication {
            generic_name: "amlodipine",
            brand_names: &["norvasc"],
            typical_dose_range: (2.5, 10.0),
            common_unit: "mg",
            category: MedicationCategory::Cardiovascular,
            requires_special_instructions: false,
        },
    );

    meds.insert(
        "amoxicillin",
        Medication {
            generic_name: "amoxicillin",
            brand_names: &["amoxil", "moxatag", "trimox"],
            typical_dose_range: (250.0, 875.0),
            common_unit: "mg",
            category: MedicationCategory::Antibiotic,
            requires_special_instructions: true, // Take with food
        },
    );

    meds.insert(
        "aripiprazole",
        Medication {
            generic_name: "aripiprazole",
            brand_names: &["abilify"],
            typical_dose_range: (2.0, 30.0),
            common_unit: "mg",
            category: MedicationCategory::Psychiatric,
            requires_special_instructions: false,
        },
    );

    meds.insert(
        "aspirin",
        Medication {
            generic_name: "aspirin",
            brand_names: &["bayer", "ecotrin", "bufferin"],
            typical_dose_range: (81.0, 325.0),
            common_unit: "mg",
            category: MedicationCategory::Anticoagulant,
            requires_special_instructions: true, // Take with food
        },
    );

    meds.insert(
        "atorvastatin",
        Medication {
            generic_name: "atorvastatin",
            brand_names: &["lipitor"],
            typical_dose_range: (10.0, 80.0),
            common_unit: "mg",
            category: MedicationCategory::Cardiovascular,
            requires_special_instructions: false,
        },
    );

    meds.insert(
        "azithromycin",
        Medication {
            generic_name: "azithromycin",
            brand_names: &["zithromax", "zmax"],
            typical_dose_range: (250.0, 600.0),
            common_unit: "mg",
            category: MedicationCategory::Antibiotic,
            requires_special_instructions: false,
        },
    );

    // B
    meds.insert(
        "baclofen",
        Medication {
            generic_name: "baclofen",
            brand_names: &["gablofen", "lioresal"],
            typical_dose_range: (5.0, 20.0),
            common_unit: "mg",
            category: MedicationCategory::Neurological,
            requires_special_instructions: false,
        },
    );

    meds.insert(
        "bisacodyl",
        Medication {
            generic_name: "bisacodyl",
            brand_names: &["dulcolax"],
            typical_dose_range: (5.0, 10.0),
            common_unit: "mg",
            category: MedicationCategory::Gastrointestinal,
            requires_special_instructions: true, // Take with water
        },
    );

    // C
    meds.insert(
        "carvedilol",
        Medication {
            generic_name: "carvedilol",
            brand_names: &["coreg"],
            typical_dose_range: (3.125, 25.0),
            common_unit: "mg",
            category: MedicationCategory::Cardiovascular,
            requires_special_instructions: true, // Take with food
        },
    );

    meds.insert(
        "cephalexin",
        Medication {
            generic_name: "cephalexin",
            brand_names: &["keflex"],
            typical_dose_range: (250.0, 1000.0),
            common_unit: "mg",
            category: MedicationCategory::Antibiotic,
            requires_special_instructions: false,
        },
    );

    meds.insert(
        "ciprofloxacin",
        Medication {
            generic_name: "ciprofloxacin",
            brand_names: &["cipro"],
            typical_dose_range: (250.0, 750.0),
            common_unit: "mg",
            category: MedicationCategory::Antibiotic,
            requires_special_instructions: true, // Avoid dairy, sunlight
        },
    );

    meds.insert(
        "clonazepam",
        Medication {
            generic_name: "clonazepam",
            brand_names: &["klonopin"],
            typical_dose_range: (0.25, 2.0),
            common_unit: "mg",
            category: MedicationCategory::Neurological,
            requires_special_instructions: false,
        },
    );

    meds.insert(
        "clopidogrel",
        Medication {
            generic_name: "clopidogrel",
            brand_names: &["plavix"],
            typical_dose_range: (75.0, 75.0),
            common_unit: "mg",
            category: MedicationCategory::Anticoagulant,
            requires_special_instructions: false,
        },
    );

    // D
    meds.insert(
        "diazepam",
        Medication {
            generic_name: "diazepam",
            brand_names: &["valium", "diastat"],
            typical_dose_range: (2.0, 10.0),
            common_unit: "mg",
            category: MedicationCategory::Neurological,
            requires_special_instructions: false,
        },
    );

    meds.insert(
        "digoxin",
        Medication {
            generic_name: "digoxin",
            brand_names: &["lanoxin"],
            typical_dose_range: (62.5, 250.0),
            common_unit: "mcg",
            category: MedicationCategory::Cardiovascular,
            requires_special_instructions: true, // Check pulse
        },
    );

    meds.insert(
        "diltiazem",
        Medication {
            generic_name: "diltiazem",
            brand_names: &["cardizem", "tiazac"],
            typical_dose_range: (30.0, 360.0),
            common_unit: "mg",
            category: MedicationCategory::Cardiovascular,
            requires_special_instructions: false,
        },
    );

    // E
    meds.insert(
        "enalapril",
        Medication {
            generic_name: "enalapril",
            brand_names: &["vasotec"],
            typical_dose_range: (2.5, 40.0),
            common_unit: "mg",
            category: MedicationCategory::Cardiovascular,
            requires_special_instructions: false,
        },
    );

    meds.insert(
        "escitalopram",
        Medication {
            generic_name: "escitalopram",
            brand_names: &["lexapro"],
            typical_dose_range: (5.0, 20.0),
            common_unit: "mg",
            category: MedicationCategory::Psychiatric,
            requires_special_instructions: false,
        },
    );

    // F
    meds.insert(
        "furosemide",
        Medication {
            generic_name: "furosemide",
            brand_names: &["lasix"],
            typical_dose_range: (20.0, 80.0),
            common_unit: "mg",
            category: MedicationCategory::Diuretic,
            requires_special_instructions: true, // Monitor potassium
        },
    );

    // G
    meds.insert(
        "gabapentin",
        Medication {
            generic_name: "gabapentin",
            brand_names: &["neurontin", "gralise", "horizant"],
            typical_dose_range: (100.0, 1800.0),
            common_unit: "mg",
            category: MedicationCategory::Neurological,
            requires_special_instructions: false,
        },
    );

    meds.insert(
        "glipizide",
        Medication {
            generic_name: "glipizide",
            brand_names: &["glucotrol"],
            typical_dose_range: (2.5, 20.0),
            common_unit: "mg",
            category: MedicationCategory::Endocrine,
            requires_special_instructions: true, // Take 30 min before meals
        },
    );

    // H
    meds.insert(
        "heparin",
        Medication {
            generic_name: "heparin",
            brand_names: &[],
            typical_dose_range: (5000.0, 10000.0),
            common_unit: "units",
            category: MedicationCategory::Anticoagulant,
            requires_special_instructions: true, // Monitor PTT
        },
    );

    meds.insert(
        "hydrochlorothiazide",
        Medication {
            generic_name: "hydrochlorothiazide",
            brand_names: &["microzide"],
            typical_dose_range: (12.5, 50.0),
            common_unit: "mg",
            category: MedicationCategory::Diuretic,
            requires_special_instructions: false,
        },
    );

    meds.insert(
        "hydrocodone",
        Medication {
            generic_name: "hydrocodone",
            brand_names: &["hysingla", "zohydro"],
            typical_dose_range: (5.0, 10.0),
            common_unit: "mg",
            category: MedicationCategory::PainManagement,
            requires_special_instructions: true, // Controlled substance
        },
    );

    // I
    meds.insert(
        "ibuprofen",
        Medication {
            generic_name: "ibuprofen",
            brand_names: &["advil", "motrin"],
            typical_dose_range: (200.0, 800.0),
            common_unit: "mg",
            category: MedicationCategory::PainManagement,
            requires_special_instructions: true, // Take with food
        },
    );

    meds.insert(
        "insulin",
        Medication {
            generic_name: "insulin",
            brand_names: &["humalog", "novolog", "lantus", "levemir"],
            typical_dose_range: (2.0, 100.0),
            common_unit: "units",
            category: MedicationCategory::Endocrine,
            requires_special_instructions: true, // Check blood sugar
        },
    );

    // L
    meds.insert(
        "levothyroxine",
        Medication {
            generic_name: "levothyroxine",
            brand_names: &["synthroid", "levoxyl"],
            typical_dose_range: (25.0, 200.0),
            common_unit: "mcg",
            category: MedicationCategory::Endocrine,
            requires_special_instructions: true, // Take on empty stomach
        },
    );

    meds.insert(
        "lisinopril",
        Medication {
            generic_name: "lisinopril",
            brand_names: &["prinivil", "zestril", "qbrelis"],
            typical_dose_range: (2.5, 40.0),
            common_unit: "mg",
            category: MedicationCategory::Cardiovascular,
            requires_special_instructions: false,
        },
    );

    meds.insert(
        "lorazepam",
        Medication {
            generic_name: "lorazepam",
            brand_names: &["ativan"],
            typical_dose_range: (0.5, 2.0),
            common_unit: "mg",
            category: MedicationCategory::Neurological,
            requires_special_instructions: false,
        },
    );

    meds.insert(
        "losartan",
        Medication {
            generic_name: "losartan",
            brand_names: &["cozaar"],
            typical_dose_range: (25.0, 100.0),
            common_unit: "mg",
            category: MedicationCategory::Cardiovascular,
            requires_special_instructions: false,
        },
    );

    // M
    meds.insert(
        "meloxicam",
        Medication {
            generic_name: "meloxicam",
            brand_names: &["mobic"],
            typical_dose_range: (7.5, 15.0),
            common_unit: "mg",
            category: MedicationCategory::PainManagement,
            requires_special_instructions: true, // Take with food
        },
    );

    meds.insert(
        "metformin",
        Medication {
            generic_name: "metformin",
            brand_names: &["glucophage", "fortamet", "glumetza"],
            typical_dose_range: (500.0, 2000.0),
            common_unit: "mg",
            category: MedicationCategory::Endocrine,
            requires_special_instructions: true, // Take with meals
        },
    );

    meds.insert(
        "methylprednisolone",
        Medication {
            generic_name: "methylprednisolone",
            brand_names: &["medrol"],
            typical_dose_range: (4.0, 32.0),
            common_unit: "mg",
            category: MedicationCategory::Steroid,
            requires_special_instructions: true, // Take with food, taper
        },
    );

    meds.insert(
        "metoprolol",
        Medication {
            generic_name: "metoprolol",
            brand_names: &["lopressor", "toprol-xl"],
            typical_dose_range: (25.0, 200.0),
            common_unit: "mg",
            category: MedicationCategory::Cardiovascular,
            requires_special_instructions: false,
        },
    );

    meds.insert(
        "morphine",
        Medication {
            generic_name: "morphine",
            brand_names: &["ms contin", "oramorph", "avinza"],
            typical_dose_range: (5.0, 30.0),
            common_unit: "mg",
            category: MedicationCategory::PainManagement,
            requires_special_instructions: true, // Controlled substance
        },
    );

    // N
    meds.insert(
        "naproxen",
        Medication {
            generic_name: "naproxen",
            brand_names: &["aleve", "naprosyn", "anaprox"],
            typical_dose_range: (220.0, 500.0),
            common_unit: "mg",
            category: MedicationCategory::PainManagement,
            requires_special_instructions: true, // Take with food
        },
    );

    // O
    meds.insert(
        "omeprazole",
        Medication {
            generic_name: "omeprazole",
            brand_names: &["prilosec"],
            typical_dose_range: (10.0, 40.0),
            common_unit: "mg",
            category: MedicationCategory::Gastrointestinal,
            requires_special_instructions: true, // Take before meals
        },
    );

    meds.insert(
        "ondansetron",
        Medication {
            generic_name: "ondansetron",
            brand_names: &["zofran"],
            typical_dose_range: (4.0, 8.0),
            common_unit: "mg",
            category: MedicationCategory::Gastrointestinal,
            requires_special_instructions: false,
        },
    );

    meds.insert(
        "oxycodone",
        Medication {
            generic_name: "oxycodone",
            brand_names: &["oxycontin", "roxicodone"],
            typical_dose_range: (5.0, 30.0),
            common_unit: "mg",
            category: MedicationCategory::PainManagement,
            requires_special_instructions: true, // Controlled substance
        },
    );

    // P
    meds.insert(
        "pantoprazole",
        Medication {
            generic_name: "pantoprazole",
            brand_names: &["protonix"],
            typical_dose_range: (20.0, 40.0),
            common_unit: "mg",
            category: MedicationCategory::Gastrointestinal,
            requires_special_instructions: false,
        },
    );

    meds.insert(
        "prednisone",
        Medication {
            generic_name: "prednisone",
            brand_names: &["rayos"],
            typical_dose_range: (1.0, 80.0),
            common_unit: "mg",
            category: MedicationCategory::Steroid,
            requires_special_instructions: true, // Take with food, taper
        },
    );

    // Q
    meds.insert(
        "quetiapine",
        Medication {
            generic_name: "quetiapine",
            brand_names: &["seroquel"],
            typical_dose_range: (25.0, 400.0),
            common_unit: "mg",
            category: MedicationCategory::Psychiatric,
            requires_special_instructions: false,
        },
    );

    // R - Note: ranitidine (Zantac) removed - withdrawn from market in 2020 (NDMA contamination)

    // S
    meds.insert(
        "sertraline",
        Medication {
            generic_name: "sertraline",
            brand_names: &["zoloft"],
            typical_dose_range: (25.0, 200.0),
            common_unit: "mg",
            category: MedicationCategory::Psychiatric,
            requires_special_instructions: false,
        },
    );

    meds.insert(
        "simvastatin",
        Medication {
            generic_name: "simvastatin",
            brand_names: &["zocor"],
            typical_dose_range: (5.0, 40.0),
            common_unit: "mg",
            category: MedicationCategory::Cardiovascular,
            requires_special_instructions: false,
        },
    );

    meds.insert(
        "spironolactone",
        Medication {
            generic_name: "spironolactone",
            brand_names: &["aldactone"],
            typical_dose_range: (25.0, 100.0),
            common_unit: "mg",
            category: MedicationCategory::Diuretic,
            requires_special_instructions: true, // Monitor potassium
        },
    );

    // T
    meds.insert(
        "tamsulosin",
        Medication {
            generic_name: "tamsulosin",
            brand_names: &["flomax"],
            typical_dose_range: (0.4, 0.8),
            common_unit: "mg",
            category: MedicationCategory::Other,
            requires_special_instructions: true, // Take 30 min after same meal
        },
    );

    meds.insert(
        "tramadol",
        Medication {
            generic_name: "tramadol",
            brand_names: &["ultram", "conzip"],
            typical_dose_range: (50.0, 100.0),
            common_unit: "mg",
            category: MedicationCategory::PainManagement,
            requires_special_instructions: false,
        },
    );

    meds.insert(
        "trazodone",
        Medication {
            generic_name: "trazodone",
            brand_names: &["desyrel", "oleptro"],
            typical_dose_range: (25.0, 150.0),
            common_unit: "mg",
            category: MedicationCategory::Psychiatric,
            requires_special_instructions: false,
        },
    );

    // V
    meds.insert(
        "valsartan",
        Medication {
            generic_name: "valsartan",
            brand_names: &["diovan"],
            typical_dose_range: (40.0, 320.0),
            common_unit: "mg",
            category: MedicationCategory::Cardiovascular,
            requires_special_instructions: false,
        },
    );

    meds.insert(
        "venlafaxine",
        Medication {
            generic_name: "venlafaxine",
            brand_names: &["effexor"],
            typical_dose_range: (37.5, 225.0),
            common_unit: "mg",
            category: MedicationCategory::Psychiatric,
            requires_special_instructions: false,
        },
    );

    // W
    meds.insert(
        "warfarin",
        Medication {
            generic_name: "warfarin",
            brand_names: &["coumadin", "jantoven"],
            typical_dose_range: (1.0, 10.0),
            common_unit: "mg",
            category: MedicationCategory::Anticoagulant,
            requires_special_instructions: true, // Monitor INR
        },
    );

    meds
});

/// Lookup medication by name (generic or brand)
pub fn lookup_medication(name: &str) -> Option<&'static Medication> {
    let lower = name.to_lowercase();

    // Try generic name first
    if let Some(med) = MEDICATIONS.get(lower.as_str()) {
        return Some(med);
    }

    // Search brand names
    MEDICATIONS
        .values()
        .find(|med| med.brand_names.iter().any(|&brand| brand == lower))
}

// ============================================================================
// ROUTES OF ADMINISTRATION
// ============================================================================

#[derive(Debug, Clone)]
pub struct Route {
    pub canonical: &'static str,
    pub abbreviations: &'static [&'static str],
    pub description: &'static str,
    pub snomed_ct_code: Option<&'static str>,
    pub requires_site_specification: bool,
}

pub static ROUTES: Lazy<HashMap<&'static str, Route>> = Lazy::new(|| {
    let mut routes = HashMap::new();

    routes.insert(
        "oral",
        Route {
            canonical: "oral",
            abbreviations: &["po", "p.o.", "per os", "by mouth", "orally"],
            description: "By mouth",
            snomed_ct_code: Some("26643006"),
            requires_site_specification: false,
        },
    );

    routes.insert(
        "intravenous",
        Route {
            canonical: "intravenous",
            abbreviations: &["iv", "i.v.", "intravenously"],
            description: "Into a vein",
            snomed_ct_code: Some("47625008"),
            requires_site_specification: false,
        },
    );

    routes.insert(
        "intramuscular",
        Route {
            canonical: "intramuscular",
            abbreviations: &["im", "i.m.", "intramuscularly"],
            description: "Into a muscle",
            snomed_ct_code: Some("78421000"),
            requires_site_specification: true,
        },
    );

    routes.insert(
        "subcutaneous",
        Route {
            canonical: "subcutaneous",
            abbreviations: &["subcutaneously", "subq", "sc", "s.c.", "sq", "subcut"],
            description: "Under the skin",
            snomed_ct_code: Some("34206005"),
            requires_site_specification: false,
        },
    );

    routes.insert(
        "sublingual",
        Route {
            canonical: "sublingual",
            abbreviations: &["sl", "s.l.", "under tongue", "sub-lingual"],
            description: "Under the tongue",
            snomed_ct_code: Some("37839007"),
            requires_site_specification: false,
        },
    );

    routes.insert(
        "buccal",
        Route {
            canonical: "buccal",
            abbreviations: &["bucc", "between cheek and gum"],
            description: "Between cheek and gum",
            snomed_ct_code: None,
            requires_site_specification: false,
        },
    );

    routes.insert(
        "rectal",
        Route {
            canonical: "rectal",
            abbreviations: &["pr", "p.r.", "per rectum", "rectally"],
            description: "Into the rectum",
            snomed_ct_code: Some("37161004"),
            requires_site_specification: false,
        },
    );

    routes.insert(
        "topical",
        Route {
            canonical: "topical",
            abbreviations: &["top", "topically", "td", "transdermal", "patch"],
            description: "On the skin",
            snomed_ct_code: Some("6064005"),
            requires_site_specification: true,
        },
    );

    routes.insert(
        "inhalation",
        Route {
            canonical: "inhalation",
            abbreviations: &[
                "inh",
                "inhaled",
                "inhale",
                "nebulized",
                "nebulizer",
                "inhaler",
            ],
            description: "Into the lungs",
            snomed_ct_code: Some("447694001"),
            requires_site_specification: false,
        },
    );

    routes.insert(
        "ophthalmic",
        Route {
            canonical: "ophthalmic",
            abbreviations: &["eye", "eyes", "ophth", "ou", "os", "od"],
            description: "Into the eye(s)",
            snomed_ct_code: Some("54485002"),
            requires_site_specification: true,
        },
    );

    routes.insert(
        "otic",
        Route {
            canonical: "otic",
            abbreviations: &["ear", "ears", "auricular", "au", "as", "ad"],
            description: "Into the ear(s)",
            snomed_ct_code: Some("10547007"),
            requires_site_specification: true,
        },
    );

    routes.insert(
        "nasal",
        Route {
            canonical: "nasal",
            abbreviations: &["nose", "intranasal", "nostril"],
            description: "Into the nose",
            snomed_ct_code: Some("46713006"),
            requires_site_specification: true,
        },
    );

    routes.insert(
        "vaginal",
        Route {
            canonical: "vaginal",
            abbreviations: &["pv", "per vagina"],
            description: "Into the vagina",
            snomed_ct_code: Some("16857009"),
            requires_site_specification: false,
        },
    );

    routes.insert(
        "enteral",
        Route {
            canonical: "enteral",
            abbreviations: &[
                "ng",
                "ngt",
                "nasogastric",
                "g-tube",
                "gtube",
                "gastrostomy",
                "j-tube",
                "jtube",
                "jejunostomy",
            ],
            description: "Via feeding tube",
            snomed_ct_code: None,
            requires_site_specification: true,
        },
    );

    routes.insert(
        "intradermal",
        Route {
            canonical: "intradermal",
            abbreviations: &["id", "i.d.", "intradermally"],
            description: "Into the skin",
            snomed_ct_code: None,
            requires_site_specification: false,
        },
    );

    routes
});

/// Lookup route by any of its abbreviations
pub fn lookup_route(name: &str) -> Option<&'static Route> {
    let lower = name.to_lowercase();

    for (_, route) in ROUTES.iter() {
        if route.canonical == lower {
            return Some(route);
        }
        if route.abbreviations.iter().any(|&abbr| abbr == lower) {
            return Some(route);
        }
    }

    None
}

// ============================================================================
// UNITS OF MEASUREMENT
// ============================================================================

#[derive(Debug, Clone)]
pub struct Unit {
    pub canonical: &'static str,
    pub aliases: &'static [&'static str],
    pub unit_type: UnitType,
    pub typical_range: (f64, f64),      // (min, max) typical dose
    pub metric_equivalent: Option<f64>, // Conversion factor to base unit
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UnitType {
    Mass,
    Volume,
    Count,
    Household,
    International,
}

pub static UNITS: Lazy<HashMap<&'static str, Unit>> = Lazy::new(|| {
    let mut units = HashMap::new();

    // Mass units
    units.insert(
        "mg",
        Unit {
            canonical: "mg",
            aliases: &["milligram", "milligrams"],
            unit_type: UnitType::Mass,
            typical_range: (1.0, 5000.0),
            metric_equivalent: Some(1.0),
        },
    );

    units.insert(
        "g",
        Unit {
            canonical: "g",
            aliases: &["gram", "grams", "gm"],
            unit_type: UnitType::Mass,
            typical_range: (0.1, 5.0),
            metric_equivalent: Some(1000.0),
        },
    );

    units.insert(
        "mcg",
        Unit {
            canonical: "mcg",
            aliases: &["microgram", "micrograms", "ug"],
            unit_type: UnitType::Mass,
            typical_range: (1.0, 1000.0),
            metric_equivalent: Some(0.001),
        },
    );

    units.insert(
        "kg",
        Unit {
            canonical: "kg",
            aliases: &["kilogram", "kilograms"],
            unit_type: UnitType::Mass,
            typical_range: (0.001, 0.1),
            metric_equivalent: Some(1000000.0),
        },
    );

    units.insert(
        "grain",
        Unit {
            canonical: "grain",
            aliases: &["grains", "gr"],
            unit_type: UnitType::Mass,
            typical_range: (1.0, 10.0),
            metric_equivalent: Some(64.8),
        },
    );

    // Volume units
    units.insert(
        "ml",
        Unit {
            canonical: "ml",
            aliases: &["milliliter", "milliliters", "cc", "ccs"],
            unit_type: UnitType::Volume,
            typical_range: (0.1, 5000.0),
            metric_equivalent: Some(1.0),
        },
    );

    units.insert(
        "l",
        Unit {
            canonical: "l",
            aliases: &["liter", "liters", "litre", "litres"],
            unit_type: UnitType::Volume,
            typical_range: (0.1, 5.0),
            metric_equivalent: Some(1000.0),
        },
    );

    units.insert(
        "oz",
        Unit {
            canonical: "oz",
            aliases: &["ounce", "ounces", "fluid ounce", "fl oz"],
            unit_type: UnitType::Volume,
            typical_range: (0.1, 32.0),
            metric_equivalent: Some(29.57),
        },
    );

    units.insert(
        "pt",
        Unit {
            canonical: "pt",
            aliases: &["pint", "pints"],
            unit_type: UnitType::Volume,
            typical_range: (0.1, 2.0),
            metric_equivalent: Some(473.18),
        },
    );

    units.insert(
        "qt",
        Unit {
            canonical: "qt",
            aliases: &["quart", "quarts"],
            unit_type: UnitType::Volume,
            typical_range: (0.1, 2.0),
            metric_equivalent: Some(946.35),
        },
    );

    units.insert(
        "gal",
        Unit {
            canonical: "gal",
            aliases: &["gallon", "gallons"],
            unit_type: UnitType::Volume,
            typical_range: (0.1, 1.0),
            metric_equivalent: Some(3785.41),
        },
    );

    // Count units
    units.insert(
        "tab",
        Unit {
            canonical: "tab",
            aliases: &["tablet", "tablets", "tabs"],
            unit_type: UnitType::Count,
            typical_range: (0.5, 10.0),
            metric_equivalent: None,
        },
    );

    units.insert(
        "cap",
        Unit {
            canonical: "cap",
            aliases: &["capsule", "capsules", "caps"],
            unit_type: UnitType::Count,
            typical_range: (0.5, 10.0),
            metric_equivalent: None,
        },
    );

    units.insert(
        "pill",
        Unit {
            canonical: "pill",
            aliases: &["pills"],
            unit_type: UnitType::Count,
            typical_range: (0.5, 10.0),
            metric_equivalent: None,
        },
    );

    units.insert(
        "suppository",
        Unit {
            canonical: "suppository",
            aliases: &["supp", "suppositories"],
            unit_type: UnitType::Count,
            typical_range: (1.0, 2.0),
            metric_equivalent: None,
        },
    );

    units.insert(
        "patch",
        Unit {
            canonical: "patch",
            aliases: &["patches"],
            unit_type: UnitType::Count,
            typical_range: (0.5, 2.0),
            metric_equivalent: None,
        },
    );

    units.insert(
        "puff",
        Unit {
            canonical: "puff",
            aliases: &["puffs", "inhalation", "inhalations"],
            unit_type: UnitType::Count,
            typical_range: (1.0, 4.0),
            metric_equivalent: None,
        },
    );

    units.insert(
        "drop",
        Unit {
            canonical: "drop",
            aliases: &["drops", "gtt", "gtts"],
            unit_type: UnitType::Count,
            typical_range: (1.0, 4.0),
            metric_equivalent: None,
        },
    );

    units.insert(
        "spray",
        Unit {
            canonical: "spray",
            aliases: &["sprays"],
            unit_type: UnitType::Count,
            typical_range: (1.0, 4.0),
            metric_equivalent: None,
        },
    );

    units.insert(
        "unit",
        Unit {
            canonical: "unit",
            aliases: &[
                "units",
                "u",
                "iu",
                "international unit",
                "international units",
            ],
            unit_type: UnitType::International,
            typical_range: (1.0, 100.0),
            metric_equivalent: None,
        },
    );

    // Household units
    units.insert(
        "tsp",
        Unit {
            canonical: "tsp",
            aliases: &["teaspoon", "teaspoons"],
            unit_type: UnitType::Household,
            typical_range: (0.5, 4.0),
            metric_equivalent: Some(5.0),
        },
    );

    units.insert(
        "tbsp",
        Unit {
            canonical: "tbsp",
            aliases: &["tablespoon", "tablespoons"],
            unit_type: UnitType::Household,
            typical_range: (0.5, 4.0),
            metric_equivalent: Some(15.0),
        },
    );

    units.insert(
        "cup",
        Unit {
            canonical: "cup",
            aliases: &["cups"],
            unit_type: UnitType::Household,
            typical_range: (0.25, 2.0),
            metric_equivalent: Some(240.0),
        },
    );

    units
});

/// Lookup unit by name or alias
pub fn lookup_unit(name: &str) -> Option<&'static Unit> {
    let lower = name.to_lowercase();

    for (_, unit) in UNITS.iter() {
        if unit.canonical == lower {
            return Some(unit);
        }
        if unit.aliases.iter().any(|&alias| alias == lower) {
            return Some(unit);
        }
    }

    None
}

/// Get all unit aliases for a canonical unit
#[allow(dead_code)]
pub fn get_unit_aliases(canonical: &str) -> Option<&'static [&'static str]> {
    UNITS.get(canonical).map(|u| u.aliases)
}

// ============================================================================
// FREQUENCIES
// ============================================================================

#[derive(Debug, Clone)]
pub struct Frequency {
    pub canonical: &'static str,
    pub abbreviations: &'static [&'static str],
    pub description: &'static str,
    pub times_per_day: f64,
    pub fhir_timing: Option<&'static str>,
}

pub static FREQUENCIES: Lazy<HashMap<&'static str, Frequency>> = Lazy::new(|| {
    let mut freqs = HashMap::new();

    freqs.insert(
        "once_daily",
        Frequency {
            canonical: "once_daily",
            abbreviations: &["qd", "q.d.", "daily", "qday", "every day", "each day"],
            description: "Once per day",
            times_per_day: 1.0,
            fhir_timing: Some(
                "{\"repeat\": {\"frequency\": 1, \"period\": 1, \"periodUnit\": \"d\"}}",
            ),
        },
    );

    freqs.insert(
        "twice_daily",
        Frequency {
            canonical: "twice_daily",
            abbreviations: &[
                "bid",
                "b.i.d.",
                "twice daily",
                "twice a day",
                "2x daily",
                "two times daily",
            ],
            description: "Twice per day",
            times_per_day: 2.0,
            fhir_timing: Some(
                "{\"repeat\": {\"frequency\": 2, \"period\": 1, \"periodUnit\": \"d\"}}",
            ),
        },
    );

    freqs.insert(
        "three_times_daily",
        Frequency {
            canonical: "three_times_daily",
            abbreviations: &[
                "tid",
                "t.i.d.",
                "three times daily",
                "three times a day",
                "3x daily",
            ],
            description: "Three times per day",
            times_per_day: 3.0,
            fhir_timing: Some(
                "{\"repeat\": {\"frequency\": 3, \"period\": 1, \"periodUnit\": \"d\"}}",
            ),
        },
    );

    freqs.insert(
        "four_times_daily",
        Frequency {
            canonical: "four_times_daily",
            abbreviations: &["qid", "q.i.d.", "four times daily", "4x daily"],
            description: "Four times per day",
            times_per_day: 4.0,
            fhir_timing: Some(
                "{\"repeat\": {\"frequency\": 4, \"period\": 1, \"periodUnit\": \"d\"}}",
            ),
        },
    );

    freqs.insert(
        "every_4_hours",
        Frequency {
            canonical: "every_4_hours",
            abbreviations: &[
                "q4h",
                "q4hr",
                "q4hours",
                "every 4 hours",
                "every 4 hrs",
                "every four hours",
            ],
            description: "Every 4 hours",
            times_per_day: 6.0,
            fhir_timing: Some(
                "{\"repeat\": {\"frequency\": 1, \"period\": 4, \"periodUnit\": \"h\"}}",
            ),
        },
    );

    freqs.insert(
        "every_6_hours",
        Frequency {
            canonical: "every_6_hours",
            abbreviations: &[
                "q6h",
                "q6hr",
                "q6hours",
                "every 6 hours",
                "every 6 hrs",
                "every six hours",
            ],
            description: "Every 6 hours",
            times_per_day: 4.0,
            fhir_timing: Some(
                "{\"repeat\": {\"frequency\": 1, \"period\": 6, \"periodUnit\": \"h\"}}",
            ),
        },
    );

    freqs.insert(
        "every_8_hours",
        Frequency {
            canonical: "every_8_hours",
            abbreviations: &[
                "q8h",
                "q8hr",
                "q8hours",
                "every 8 hours",
                "every 8 hrs",
                "every eight hours",
            ],
            description: "Every 8 hours",
            times_per_day: 3.0,
            fhir_timing: Some(
                "{\"repeat\": {\"frequency\": 1, \"period\": 8, \"periodUnit\": \"h\"}}",
            ),
        },
    );

    freqs.insert(
        "every_12_hours",
        Frequency {
            canonical: "every_12_hours",
            abbreviations: &[
                "q12h",
                "q12hr",
                "q12hours",
                "every 12 hours",
                "every 12 hrs",
                "every twelve hours",
            ],
            description: "Every 12 hours",
            times_per_day: 2.0,
            fhir_timing: Some(
                "{\"repeat\": {\"frequency\": 1, \"period\": 12, \"periodUnit\": \"h\"}}",
            ),
        },
    );

    freqs.insert(
        "every_24_hours",
        Frequency {
            canonical: "every_24_hours",
            abbreviations: &[
                "q24h",
                "q24hr",
                "q24hours",
                "every 24 hours",
                "every 24 hrs",
            ],
            description: "Every 24 hours",
            times_per_day: 1.0,
            fhir_timing: Some(
                "{\"repeat\": {\"frequency\": 1, \"period\": 24, \"periodUnit\": \"h\"}}",
            ),
        },
    );

    freqs.insert(
        "every_72_hours",
        Frequency {
            canonical: "every_72_hours",
            abbreviations: &[
                "q72h",
                "q72hr",
                "every 72 hours",
                "every 72 hrs",
                "every three days",
            ],
            description: "Every 72 hours",
            times_per_day: 0.33,
            fhir_timing: None,
        },
    );

    freqs.insert(
        "as_needed",
        Frequency {
            canonical: "as_needed",
            abbreviations: &["prn", "p.r.n.", "as needed", "as necessary", "when needed"],
            description: "As needed",
            times_per_day: 0.0,
            fhir_timing: Some("{\"asNeededBoolean\": true}"),
        },
    );

    freqs.insert(
        "at_bedtime",
        Frequency {
            canonical: "at_bedtime",
            abbreviations: &["hs", "h.s.", "at bedtime", "bedtime", "qhs", "q.h.s."],
            description: "At bedtime",
            times_per_day: 1.0,
            fhir_timing: Some("{\"repeat\": {\"when\": [\"HS\"]}}"),
        },
    );

    freqs.insert(
        "morning",
        Frequency {
            canonical: "morning",
            abbreviations: &[
                "am",
                "a.m.",
                "morning",
                "qam",
                "q.a.m.",
                "every morning",
                "in the morning",
            ],
            description: "In the morning",
            times_per_day: 1.0,
            fhir_timing: Some("{\"repeat\": {\"when\": [\"MORN\"]}}"),
        },
    );

    freqs.insert(
        "evening",
        Frequency {
            canonical: "evening",
            abbreviations: &[
                "pm",
                "p.m.",
                "evening",
                "qpm",
                "q.p.m.",
                "every evening",
                "in the evening",
            ],
            description: "In the evening",
            times_per_day: 1.0,
            fhir_timing: Some("{\"repeat\": {\"when\": [\"EVE\"]}}"),
        },
    );

    freqs.insert(
        "every_other_day",
        Frequency {
            canonical: "every_other_day",
            abbreviations: &["qod", "q.o.d.", "every other day", "every 2nd day"],
            description: "Every other day",
            times_per_day: 0.5,
            fhir_timing: None,
        },
    );

    freqs.insert(
        "once_weekly",
        Frequency {
            canonical: "once_weekly",
            abbreviations: &["weekly", "qwk", "once weekly", "every week"],
            description: "Once per week",
            times_per_day: 0.14,
            fhir_timing: Some(
                "{\"repeat\": {\"frequency\": 1, \"period\": 1, \"periodUnit\": \"wk\"}}",
            ),
        },
    );

    freqs.insert(
        "twice_weekly",
        Frequency {
            canonical: "twice_weekly",
            abbreviations: &["2x weekly", "twice weekly", "two times weekly"],
            description: "Twice per week",
            times_per_day: 0.29,
            fhir_timing: None,
        },
    );

    freqs.insert(
        "every_two_weeks",
        Frequency {
            canonical: "every_two_weeks",
            abbreviations: &["q2wk", "biweekly", "every 2 weeks", "every two weeks"],
            description: "Every two weeks",
            times_per_day: 0.07,
            fhir_timing: None,
        },
    );

    freqs.insert(
        "monthly",
        Frequency {
            canonical: "monthly",
            abbreviations: &["qmo", "once monthly", "every month", "qmonth"],
            description: "Once per month",
            times_per_day: 0.03,
            fhir_timing: Some(
                "{\"repeat\": {\"frequency\": 1, \"period\": 1, \"periodUnit\": \"mo\"}}",
            ),
        },
    );

    freqs.insert(
        "before_meals",
        Frequency {
            canonical: "before_meals",
            abbreviations: &["ac", "a.c.", "before meals", "before each meal"],
            description: "Before meals",
            times_per_day: 3.0,
            fhir_timing: Some("{\"repeat\": {\"when\": [\"AC\"]}}"),
        },
    );

    freqs.insert(
        "after_meals",
        Frequency {
            canonical: "after_meals",
            abbreviations: &["pc", "p.c.", "after meals", "after each meal"],
            description: "After meals",
            times_per_day: 3.0,
            fhir_timing: Some("{\"repeat\": {\"when\": [\"PC\"]}}"),
        },
    );

    freqs.insert(
        "with_meals",
        Frequency {
            canonical: "with_meals",
            abbreviations: &["with meals", "with food", "with each meal"],
            description: "With meals",
            times_per_day: 3.0,
            fhir_timing: None,
        },
    );

    freqs.insert(
        "once",
        Frequency {
            canonical: "once",
            abbreviations: &[
                "stat",
                "statim",
                "immediately",
                "now",
                "one time",
                "single dose",
                "one dose",
            ],
            description: "One time only",
            times_per_day: 1.0,
            fhir_timing: Some(
                "{\"repeat\": {\"frequency\": 1, \"period\": 0, \"periodUnit\": \"d\"}}",
            ),
        },
    );

    freqs
});

/// Lookup frequency by abbreviation
pub fn lookup_frequency(name: &str) -> Option<&'static Frequency> {
    let lower = name.to_lowercase();

    for (_, freq) in FREQUENCIES.iter() {
        if freq.canonical == lower {
            return Some(freq);
        }
        if freq.abbreviations.iter().any(|&abbr| abbr == lower) {
            return Some(freq);
        }
    }

    None
}

// ============================================================================
// INDICATIONS
// ============================================================================

#[allow(dead_code)]
pub static INDICATIONS: &[&str] = &[
    "pain",
    "fever",
    "inflammation",
    "infection",
    "bacteria",
    "virus",
    "hypertension",
    "high blood pressure",
    "bp",
    "heart",
    "diabetes",
    "blood sugar",
    "glucose",
    "cholesterol",
    "lipids",
    "anxiety",
    "depression",
    "mood",
    "sleep",
    "insomnia",
    "seizure",
    "epilepsy",
    "convulsion",
    "nausea",
    "vomiting",
    "upset stomach",
    "gerd",
    "reflux",
    "heartburn",
    "constipation",
    "diarrhea",
    "asthma",
    "copd",
    "breathing",
    "wheezing",
    "allergies",
    "allergic",
    "reaction",
    "blood clot",
    "clotting",
    "inr",
    "thyroid",
    "gout",
    "migraine",
    "headache",
    "nerve pain",
    "neuropathy",
    "muscle spasm",
    "spasticity",
];

// ============================================================================
// SPECIAL INSTRUCTIONS
// ============================================================================

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct SpecialInstruction {
    pub keyword: &'static str,
    pub instruction: &'static str,
    pub priority: InstructionPriority,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[allow(dead_code)]
pub enum InstructionPriority {
    Critical,  // Must be followed
    Important, // Should be followed
    Helpful,   // Nice to know
}

#[allow(dead_code)]
pub static SPECIAL_INSTRUCTIONS: Lazy<HashMap<&'static str, SpecialInstruction>> =
    Lazy::new(|| {
        let mut instrs = HashMap::new();

        instrs.insert(
            "with_food",
            SpecialInstruction {
                keyword: "with food",
                instruction: "Take with food to reduce stomach upset",
                priority: InstructionPriority::Important,
            },
        );

        instrs.insert(
            "with_meals",
            SpecialInstruction {
                keyword: "with meals",
                instruction: "Take with meals",
                priority: InstructionPriority::Important,
            },
        );

        instrs.insert(
            "empty_stomach",
            SpecialInstruction {
                keyword: "on empty stomach",
                instruction: "Take on an empty stomach (1 hour before or 2 hours after meals)",
                priority: InstructionPriority::Critical,
            },
        );

        instrs.insert(
            "before_meals",
            SpecialInstruction {
                keyword: "before meals",
                instruction: "Take 30 minutes before meals",
                priority: InstructionPriority::Important,
            },
        );

        instrs.insert(
            "after_meals",
            SpecialInstruction {
                keyword: "after meals",
                instruction: "Take after meals",
                priority: InstructionPriority::Important,
            },
        );

        instrs.insert(
            "plenty_water",
            SpecialInstruction {
                keyword: "plenty of water",
                instruction: "Take with plenty of water",
                priority: InstructionPriority::Important,
            },
        );

        instrs.insert(
            "full_glass",
            SpecialInstruction {
                keyword: "full glass",
                instruction: "Take with a full glass of water",
                priority: InstructionPriority::Important,
            },
        );

        instrs.insert(
            "shake_well",
            SpecialInstruction {
                keyword: "shake well",
                instruction: "Shake well before each use",
                priority: InstructionPriority::Critical,
            },
        );

        instrs.insert(
            "refrigerate",
            SpecialInstruction {
                keyword: "refrigerate",
                instruction: "Store in refrigerator",
                priority: InstructionPriority::Critical,
            },
        );

        instrs.insert(
            "room_temp",
            SpecialInstruction {
                keyword: "room temperature",
                instruction: "Store at room temperature",
                priority: InstructionPriority::Important,
            },
        );

        instrs.insert(
            "protect_light",
            SpecialInstruction {
                keyword: "protect from light",
                instruction: "Protect from light",
                priority: InstructionPriority::Important,
            },
        );

        instrs.insert(
            "avoid_sun",
            SpecialInstruction {
                keyword: "avoid sun",
                instruction: "Avoid prolonged sun exposure",
                priority: InstructionPriority::Important,
            },
        );

        instrs.insert(
            "avoid_dairy",
            SpecialInstruction {
                keyword: "avoid dairy",
                instruction: "Avoid dairy products within 2 hours",
                priority: InstructionPriority::Important,
            },
        );

        instrs.insert(
            "avoid_alcohol",
            SpecialInstruction {
                keyword: "avoid alcohol",
                instruction: "Avoid alcohol while taking this medication",
                priority: InstructionPriority::Critical,
            },
        );

        instrs.insert(
            "do_not_crush",
            SpecialInstruction {
                keyword: "do not crush",
                instruction: "Do not crush, chew, or break tablet",
                priority: InstructionPriority::Critical,
            },
        );

        instrs.insert(
            "controlled",
            SpecialInstruction {
                keyword: "controlled substance",
                instruction: "Controlled substance - use with caution",
                priority: InstructionPriority::Critical,
            },
        );

        instrs.insert(
            "taper",
            SpecialInstruction {
                keyword: "taper",
                instruction: "Do not stop abruptly - taper dose as directed",
                priority: InstructionPriority::Critical,
            },
        );

        instrs
    });
