// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
use super::{embedded_raster_dimensions, raster_image_dimensions};
#[test]
fn issue_4243_budget_headers_before_decoding_pixels() {
    let mut bytes = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut bytes, 2, 3);
        encoder.set_color(png::ColorType::Rgba);
        let mut writer = encoder.write_header().unwrap();
        writer.write_image_data(&[0; 24]).unwrap();
    }
    let literal = format!("0{}", bytes.iter().map(|b| format!("{b:02X}")).collect::<String>());
    assert_eq!(embedded_raster_dimensions(&literal), Some((2, 3)));
    assert_eq!(raster_image_dimensions(&bytes[..16]), None);
    assert_eq!(embedded_raster_dimensions("0xyz"), None);
    // Reading dimensions must not require the complete compressed pixel stream.
    let jpeg = [0xff,0xd8,0xff,0xc0,0,11,8,0,2,0,3,1,1,0x11,0,0xff,0xda,0,8,1,1,0,0,63,0];
    assert_eq!(raster_image_dimensions(&jpeg), Some((3, 2)));
}

#[test]
fn issue_4243_large_raster_header_is_inspected_without_allocating_its_pixels() {
    let mut bytes = Vec::new();
    { let _writer = png::Encoder::new(&mut bytes, 16_384, 16_384).write_header().unwrap(); }
    bytes.truncate(33); // Keep signature + IHDR, excluding writer-drop IEND.
    // Empty IDAT lets the header reader stop before a missing pixel stream.
    bytes.extend_from_slice(&[0,0,0,0,b'I',b'D',b'A',b'T',0x35,0xaf,0x06,0x1e]);
    assert_eq!(raster_image_dimensions(&bytes), Some((16_384, 16_384)));
}
