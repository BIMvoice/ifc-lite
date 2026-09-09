// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//! Appearance edits use the same Rust planner in native and browser hosts.
use super::IfcAPI;
use ifc_lite_processing::appearance::{plan_appearance, AppearanceRequest};
use wasm_bindgen::prelude::*;

fn plan_json(content: &[u8], request_json: &str) -> Result<Vec<u8>, String> {
    if request_json.len() > 256 * 1024 {
        return Err("Appearance request exceeds the scope budget".into());
    }
    let request: AppearanceRequest = serde_json::from_str(request_json)
        .map_err(|error| format!("Invalid appearance request: {error}"))?;
    let plan = plan_appearance(content, &request)?;
    encode_bounded(&plan)
}

// A writer ceiling stops serialization before allocating an oversized JSON buffer.
// The host then holds UTF-8 bytes, a JS string and its parsed/structured-cloned graph.
fn encode_bounded(value: &impl serde::Serialize) -> Result<Vec<u8>, String> {
    struct Output(Vec<u8>);
    impl std::io::Write for Output {
        fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
            if bytes.len() > (64 * 1024 * 1024usize).saturating_sub(self.0.len()) {
                return Err(std::io::Error::other("Appearance JSON exceeds 64 MiB. Choose fewer objects or simplify the source mesh."));
            }
            self.0.extend_from_slice(bytes);
            Ok(bytes.len())
        }
        fn flush(&mut self) -> std::io::Result<()> { Ok(()) }
    }
    let mut output = Output(Vec::new());
    serde_json::to_writer(&mut output, value).map_err(|error| format!("Cannot encode appearance plan: {error}"))?;
    Ok(output.0)
}

#[wasm_bindgen]
impl IfcAPI {
    /// Plan image/UV edits against an effective IFC snapshot without mutating it.
    /// JSON input uses AppearanceRequest; output is UTF-8 AppearancePlan JSON.
    /// Call from a worker, then validate sourceRevision and allocator before an
    /// atomic host commit. Preview UVs describe an unsplit canonical mesh item.
    #[wasm_bindgen(js_name = planAppearance)]
    pub fn plan_appearance(&self, content: &[u8], request_json: &str) -> Result<Vec<u8>, JsError> {
        plan_json(content, request_json).map_err(|message| JsError::new(&message))
    }
}

#[cfg(test)]
mod tests {
    use super::{plan_json, encode_bounded};

    #[test]
    fn issue_4243_serialization_stops_at_the_output_budget() {
        // Reused strings keep the test input small while serialized output expands.
        let chunk = "x".repeat(1024 * 1024);
        let fields = vec![&chunk; 65];
        assert!(encode_bounded(&fields).unwrap_err().contains("exceeds 64 MiB"));
        assert_eq!(encode_bounded(&vec!["small"]).unwrap(), br#"["small"]"#);
    }


    #[test]
    fn issue_4243_rejects_malformed_and_oversized_requests_before_source_processing() {
        assert!(plan_json(b"", "{").unwrap_err().contains("Invalid appearance request"));
        assert!(plan_json(b"", &" ".repeat(256 * 1024 + 1)).unwrap_err().contains("scope budget"));
    }
}
