//! Module exports for medical data normalizer
//!
//! This module organizes the codebase into logical components:
//! - medical_data: Comprehensive medication, route, unit, and frequency databases
//! - validation: Dosage and medication order validation logic
//! - normalization: Text normalization for units, routes, and frequencies
//! - fhir: FHIR R4 Dosage format generation
//! - confidence: Confidence scoring algorithms
//! - errors: Error handling and suggestion generation

pub mod confidence;
pub mod errors;
pub mod fhir;
pub mod medical_data;
pub mod normalization;
pub mod validation;
