import Vision
import AppKit
for path in CommandLine.arguments.dropFirst() {
  guard let img = NSImage(contentsOfFile: path), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { print("\(path) ERR"); continue }
  let req = VNDetectFaceRectanglesRequest()
  try? VNImageRequestHandler(cgImage: cg).perform([req])
  let W = Double(cg.width), H = Double(cg.height)
  let faces = (req.results ?? []).sorted { $0.boundingBox.width > $1.boundingBox.width }
  if let f = faces.first { let b = f.boundingBox
    print("\(path) \(Int(W)) \(Int(H)) \(Int(b.minX*W)) \(Int((1-b.maxY)*H)) \(Int(b.width*W)) \(Int(b.height*H))") } else { print("\(path) NOFACE") }
}
