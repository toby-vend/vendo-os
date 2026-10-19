// cutout <in.jpg> <out.png>  ->  the foreground person on a transparent background (Apple Vision, macOS 14+).
// Edges come out clean enough for a frame break-out; check the render, and don't add a CSS drop-shadow (it becomes
// a blurry box in Figma captures).
import Vision
import CoreImage
import AppKit
let a = CommandLine.arguments
guard a.count == 3, let src = CIImage(contentsOf: URL(fileURLWithPath: a[1])) else { print("usage: cutout in out.png"); exit(1) }
let req = VNGenerateForegroundInstanceMaskRequest()
let h = VNImageRequestHandler(ciImage: src)
try h.perform([req])
guard let r = req.results?.first else { print("NOFOREGROUND"); exit(2) }
let buf = try r.generateMaskedImage(ofInstances: r.allInstances, from: h, croppedToInstancesExtent: false)
let out = CIImage(cvPixelBuffer: buf)
let ctx = CIContext()
try ctx.writePNGRepresentation(of: out, to: URL(fileURLWithPath: a[2]), format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
print("wrote \(a[2])")
