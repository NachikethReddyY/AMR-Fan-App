import Foundation
import ImageIO
import UIKit

@main
struct PhotoUploadChecks {
    static func main() throws {
        let width = 6000
        let height = 4000
        var state: UInt64 = 1
        var pixels = Data(count: width * height * 4)
        pixels.withUnsafeMutableBytes { (buffer: UnsafeMutableRawBufferPointer) in
            for offset in stride(from: 0, to: buffer.count, by: 4) {
                state = state &* 6364136223846793005 &+ 1
                buffer[offset] = UInt8(truncatingIfNeeded: state >> 32)
                buffer[offset + 1] = UInt8(truncatingIfNeeded: state >> 40)
                buffer[offset + 2] = UInt8(truncatingIfNeeded: state >> 48)
                buffer[offset + 3] = 255
            }
        }
        let provider = CGDataProvider(data: pixels as CFData)!
        let source = CGImage(
            width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32,
            bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue),
            provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent
        )!
        let image = UIImage(cgImage: source)
        let previousData = image.jpegData(compressionQuality: 0.82)!
        precondition(previousData.count > 2_000_000)

        let encoded = PhotoUploadEncoder.jpegData(for: image)!
        precondition(encoded.count <= PhotoUploadEncoder.maxUploadBytes)
        let encodedSource = CGImageSourceCreateWithData(encoded as CFData, nil)!
        let metadata = CGImageSourceCopyPropertiesAtIndex(encodedSource, 0, nil)! as NSDictionary
        precondition((metadata[kCGImagePropertyPixelWidth] as! Int) <= PhotoUploadEncoder.maxPixelDimension)
        precondition((metadata[kCGImagePropertyPixelHeight] as! Int) <= PhotoUploadEncoder.maxPixelDimension)

        let downsampled = PhotoUploadEncoder.downsampledImage(data: previousData)!
        precondition(downsampled.cgImage!.width <= PhotoUploadEncoder.maxPixelDimension)
        precondition(downsampled.cgImage!.height <= PhotoUploadEncoder.maxPixelDimension)
        precondition(PhotoUploadEncoder.downsampledImage(data: Data("invalid".utf8)) == nil)

        let fileURL = FileManager.default.temporaryDirectory.appendingPathComponent("photo-upload-check-\(UUID().uuidString).jpg")
        defer { try? FileManager.default.removeItem(at: fileURL) }
        try previousData.write(to: fileURL)
        let fileImage = PhotoUploadEncoder.downsampledImage(url: fileURL)!
        precondition(fileImage.cgImage!.width <= PhotoUploadEncoder.maxPixelDimension)
        precondition(fileImage.cgImage!.height <= PhotoUploadEncoder.maxPixelDimension)

        let small = UIGraphicsImageRenderer(size: CGSize(width: 80, height: 60)).image { context in
            UIColor.green.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 80, height: 60))
        }
        let smallData = PhotoUploadEncoder.jpegData(for: small)!
        precondition(smallData.count <= PhotoUploadEncoder.maxUploadBytes)
        print("PhotoUploadChecks passed: 24MP fixed-quality JPEG \(previousData.count) bytes; bounded JPEG \(encoded.count) bytes; data/file gallery downsample, invalid data and small image passed")
    }
}
