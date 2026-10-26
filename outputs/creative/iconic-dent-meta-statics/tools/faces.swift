import Vision
import AppKit
for path in CommandLine.arguments.dropFirst() {
    guard let img = NSImage(contentsOfFile: path), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { print(path, "ERR"); continue }
    let req = VNDetectFaceRectanglesRequest()
    try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
    let faces = (req.results ?? []).sorted { $0.boundingBox.width > $1.boundingBox.width }
    if let f = faces.first {
        let b = f.boundingBox  // normalised, origin bottom-left
        print(path, cg.width, cg.height, String(format: "%.4f %.4f %.4f %.4f", b.midX, 1 - b.midY, b.width, b.height))
    } else { print(path, "NOFACE") }
}
