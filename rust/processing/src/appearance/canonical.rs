// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
use super::{source::Source, AppearanceItem, AppearanceRequest};
use crate::element::{
    produce_element_meshes, ElementJobKind, ElementMeshJob, MeshProductionContext,
    MeshProductionOptions,
};
use crate::types::mesh::MeshData;
use ifc_lite_geometry::{ ImageTextureRef, ResolvedTextureMap, TextureSource};
use rustc_hash::FxHashMap;

/// Raw tessellation is not the final vertex contract: placement/source welding
/// may merge corners. Run the canonical funnel for BOTH appearances, proving
/// triangle-corner geometry equality before returning a source-to-target binding.
pub(super) fn align_source_corners(
    source: &mut Source<'_>,
    product_id: u32,
    items: &mut [AppearanceItem],
    textures: &FxHashMap<u32, ResolvedTextureMap>,
    request: &AppearanceRequest,
) -> Result<(), String> {
    let before = produce(source, product_id, textures)?;
    // Clone only selected items' maps; direct eligibility guarantees these are
    // the product's complete Body and no mapped sibling may contribute geometry.
    let replacements = items
        .iter()
        .map(|item| {
            (
                item.geometry_item_id,
                ResolvedTextureMap {
                    texture_id: request.next_express_id,
                    texture: TextureSource::Image(ImageTextureRef {
                        url: request.image_uri.clone(),
                        repeat_s: request.repeat_s,
                        repeat_t: request.repeat_t,
                    }),
                    tex_coords: item
                        .tex_coords
                        .iter()
                        .map(|p| p.map(|v| v as f32))
                        .collect(),
                    tex_coord_index: Some(item.tex_coord_index.clone()),
                },
            )
        })
        .collect();
    let after = produce(source, product_id, &replacements)?;
    if before.len() != items.len() || after.len() != items.len() {
        return Err("Canonical representation was split, combined, or rejected".into());
    }
    for item in items {
        let old = one_item(&before, item.geometry_item_id)?;
        let new = one_item(&after, item.geometry_item_id)?;
        let uvs = new
            .uvs
            .as_ref()
            .ok_or("Canonical geometry did not attach the planned UVs")?;
        if old.indices.len() != new.indices.len()
            || old.origin != new.origin
            || uvs.len() != new.positions.len() / 3 * 2
            || new.normals.len() != new.positions.len()
            || new.normals.iter().any(|v| !v.is_finite())
        {
            return Err("Canonical geometry changed source corner correspondence".into());
        }
        for (&a, &b) in old.indices.iter().zip(&new.indices) {
            let a = a as usize * 3;
            let b = b as usize * 3;
            if old.positions.get(a..a + 3) != new.positions.get(b..b + 3)
            {
                return Err("Appearance would change canonical triangle geometry".into());
            }
        }
        // UV seams participate in the canonical weld key. Removing a seam can
        // select a different near-coplanar normal representative without moving
        // any triangle. Ship that exact target shading instead of a tolerance.
        item.target_corner_normals = new.indices.iter().flat_map(|&i| {
            let i = i as usize * 3;
            [new.normals[i], new.normals[i + 2], -new.normals[i + 1]]
        }).collect();
        item.source_indices.clone_from(&old.indices);
        item.target_indices.clone_from(&new.indices);
        item.preview_corner_uvs = new
            .indices
            .iter()
            .flat_map(|&i| [uvs[i as usize * 2], uvs[i as usize * 2 + 1]])
            .collect();
    }
    Ok(())
}

fn one_item(meshes: &[MeshData], id: u32) -> Result<&MeshData, String> {
    let mut matches = meshes
        .iter()
        .filter(|mesh| mesh.geometry_item_id == Some(id));
    let mesh = matches
        .next()
        .ok_or("Canonical representation item is missing")?;
    if matches.next().is_some() {
        return Err("Canonical representation item was split".into());
    }
    Ok(mesh)
}

fn produce(
    source: &mut Source<'_>,
    product_id: u32,
    textures: &FxHashMap<u32, ResolvedTextureMap>,
) -> Result<Vec<MeshData>, String> {
    let product = source.entity(product_id)?;
    source.validate_world_placement(&product)?;
    let scale = source.decoder.length_unit_scale();
    if !scale.is_finite() || scale <= 0. {
        return Err("Invalid model length unit scale".into());
    }
    let context = source.context.as_ref().ok_or("Missing canonical load context")?;
    if context.layers.is_sliceable(product_id) {
        return Err("Material-layer slicing is unsupported for appearance authoring".into());
    }
    let router = context.router();
    let voids = FxHashMap::default();
    let styles = FxHashMap::default();
    let colours = FxHashMap::default();
    let materials = FxHashMap::default();
    let context = MeshProductionContext {
        void_index: &voids,
        geometry_style_index: &styles,
        indexed_colour_full: &colours,
        element_material_colors: &materials,
        texture_index: textures,
        site_local_rotation: None,
    };
    let produced = produce_element_meshes(
        &ElementMeshJob {
            id: product_id,
            ifc_type: product.ifc_type,
            entity: &product,
            kind: ElementJobKind::Product,
            element_color: None,
            metadata: None,
        },
        &context,
        &MeshProductionOptions::default(),
        &mut source.decoder,
        &router,
    );
    if !produced.csg_failures.is_empty() {
        return Err("Canonical geometry reported a processing failure".into());
    }
    Ok(produced.meshes)
}
