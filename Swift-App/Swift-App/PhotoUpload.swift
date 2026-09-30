import CoreGraphics
import ImageIO
import UIKit

enum PhotoUploadEncoder {
    static let maxUploadBytes = 1_800_000
    static let maxPixelDimension = 1600

    private static let dimensions: [CGFloat] = [1600, 1280, 1024, 768, 640]
    private static let qualities: [CGFloat] = [0.82, 0.68, 0.54, 0.40, 0.28]

    static func downsampledImage(data: Data, maxPixelDimension: Int = maxPixelDimension) -> UIImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        return downsampledImage(source: source, maxPixelDimension: maxPixelDimension)
    }

    static func downsampledImage(url: URL) -> UIImage? {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        return downsampledImage(source: source, maxPixelDimension: maxPixelDimension)
    }

    private static func downsampledImage(source: CGImageSource, maxPixelDimension: Int) -> UIImage? {
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixelDimension
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
            return nil
        }
        return UIImage(cgImage: image)
    }

    static func jpegData(for image: UIImage) -> Data? {
        for dimension in dimensions {
            guard let resizedImage = resizedImage(image, maxPixelDimension: dimension) else { continue }
            for quality in qualities {
                guard let data = resizedImage.jpegData(compressionQuality: quality) else { continue }
                if data.count <= maxUploadBytes { return data }
            }
        }
        return nil
    }

    private static func resizedImage(_ image: UIImage, maxPixelDimension: CGFloat) -> UIImage? {
        let largestDimension = max(image.size.width, image.size.height)
        guard largestDimension > 0 else { return nil }

        let scale = min(1, maxPixelDimension / largestDimension)
        let size = CGSize(
            width: max(1, floor(image.size.width * scale)),
            height: max(1, floor(image.size.height * scale))
        )
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
    }
}
